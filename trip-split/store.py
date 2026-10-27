"""SQLite storage and exact, integer-based expense splitting. Python stdlib only."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
import re
import sqlite3
import uuid

CURRENCIES = {
    'TWD': {'name': '新台幣', 'decimals': 2},
    'JPY': {'name': '日圓', 'decimals': 0},
    'USD': {'name': '美元', 'decimals': 2},
    'EUR': {'name': '歐元', 'decimals': 2},
    'HKD': {'name': '港幣', 'decimals': 2},
    'KRW': {'name': '韓元', 'decimals': 0},
}
CATEGORIES = {
    'food': '餐飲', 'transport': '交通', 'stay': '住宿',
    'tickets': '門票活動', 'shopping': '購物', 'other': '其他',
}
MAX_AMOUNT = 10**12


class AppError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')


def text(value, label, limit=80, required=True):
    if not isinstance(value, str):
        raise AppError(f'{label}格式不正確。')
    result = value.strip()
    if (required and not result) or len(result) > limit or '\x00' in result:
        raise AppError(f'{label}請填寫 1～{limit} 個字。' if required else f'{label}最多 {limit} 個字。')
    return result


def day(value, required=True):
    if value == '' and not required:
        return ''
    try:
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError
        return date.fromisoformat(value).isoformat()
    except ValueError:
        raise AppError('請填寫有效日期，例如 2026-10-27。') from None


def money(value, currency, allow_zero=False):
    if type(value) not in (str, int):
        raise AppError('金額請以數字填寫。')
    digits = CURRENCIES[currency]['decimals']
    pattern = r'\d{1,12}' + (rf'(?:\.\d{{1,{digits}}})?' if digits else '')
    raw = str(value).strip()
    if not re.fullmatch(pattern, raw, flags=re.ASCII):
        raise AppError(f'{currency} 金額最多支援 {digits} 位小數，且不可為負數。')
    minor = int(Decimal(raw) * (10 ** digits))
    if minor > MAX_AMOUNT or minor < (0 if allow_zero else 1):
        raise AppError('金額須大於零，且不可超過系統上限。')
    return minor


def allocate(total, weights):
    """Largest remainder; stable member ordering makes fractional cents reproducible."""
    denominator = sum(weight for _, weight in weights)
    shares = [total * weight // denominator for _, weight in weights]
    remainder = total - sum(shares)
    ranked = sorted(range(len(weights)), key=lambda i: (-(total * weights[i][1] % denominator), i))
    for i in ranked[:remainder]:
        shares[i] += 1
    return shares


def suggest_transfers(balances):
    """Greedily simplify net balances; never claim a globally minimum transfer count."""
    creditors = [[entry['member_id'], entry['net']] for entry in balances if entry['net'] > 0]
    debtors = [[entry['member_id'], -entry['net']] for entry in balances if entry['net'] < 0]
    creditors.sort(key=lambda item: (-item[1], item[0]))
    debtors.sort(key=lambda item: (-item[1], item[0]))
    result, i, j = [], 0, 0
    while i < len(debtors) and j < len(creditors):
        amount = min(debtors[i][1], creditors[j][1])
        result.append({'payer_id': debtors[i][0], 'payee_id': creditors[j][0], 'amount': amount})
        debtors[i][1] -= amount
        creditors[j][1] -= amount
        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1
    return result


class Store:
    def __init__(self, path):
        self.path = Path(path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.session() as conn:
            version = conn.execute('PRAGMA user_version').fetchone()[0]
            if version > 1:
                raise RuntimeError('資料庫版本較新，請使用對應版本的程式。')
            conn.execute('PRAGMA journal_mode = WAL')
            conn.executescript(Path(__file__).with_name('schema.sql').read_text(encoding='utf-8'))

    @contextmanager
    def session(self, write=False):
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        try:
            if write:
                conn.execute('BEGIN IMMEDIATE')
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _trip(self, conn, trip_id):
        row = conn.execute('SELECT * FROM trips WHERE id = ?', (trip_id,)).fetchone()
        if not row:
            raise AppError('找不到這個旅程，可能已被刪除。', 404)
        return dict(row)

    def _members(self, conn, trip_id):
        return [dict(row) for row in conn.execute('SELECT * FROM members WHERE trip_id = ? ORDER BY sort_order, id', (trip_id,))]

    def _touch(self, conn, trip_id):
        conn.execute('UPDATE trips SET updated_at = ? WHERE id = ?', (now(), trip_id))

    def list_trips(self, user_id=None):
        scope = 'WHERE t.id IN (SELECT trip_id FROM trip_access WHERE user_id=?)' if user_id is not None else ''
        with self.session() as conn:
            return [dict(row) for row in conn.execute('''
                SELECT t.*, (SELECT COUNT(*) FROM members m WHERE m.trip_id=t.id) AS member_count,
                (SELECT COALESCE(SUM(e.amount),0) FROM expenses e WHERE e.trip_id=t.id) AS total,
                (SELECT COUNT(*) FROM expenses e WHERE e.trip_id=t.id) AS expense_count
                FROM trips t
            ''' + scope + ' ORDER BY t.updated_at DESC, t.id', (user_id,) if user_id is not None else ())]

    def create_trip(self, payload, owner_id=None):
        name = text(payload.get('name'), '旅程名稱')
        destination = text(payload.get('destination', ''), '目的地', required=False)
        start_date = day(payload.get('start_date', ''), required=False)
        currency = payload.get('currency', 'TWD')
        if not isinstance(currency, str) or currency not in CURRENCIES:
            raise AppError('不支援這個幣別。')
        raw_members = payload.get('members')
        if not isinstance(raw_members, list) or not 2 <= len(raw_members) <= 50:
            raise AppError('請加入 2～50 位成員。')
        names = [text(value, '成員姓名', 30) for value in raw_members]
        if len({value.casefold() for value in names}) != len(names):
            raise AppError('成員姓名不可重複，可加上暱稱區分。')
        trip_id, timestamp = str(uuid.uuid4()), now()
        with self.session(write=True) as conn:
            conn.execute('INSERT INTO trips VALUES (?,?,?,?,?,?,?)', (trip_id, name, destination, start_date, currency, timestamp, timestamp))
            conn.executemany('INSERT INTO members VALUES (?,?,?,?)', [(str(uuid.uuid4()), trip_id, value, index) for index, value in enumerate(names)])
            if owner_id is not None:
                conn.execute("INSERT INTO trip_access VALUES (?,?,'owner')", (trip_id, owner_id))
        return trip_id

    def update_trip(self, trip_id, payload):
        with self.session(write=True) as conn:
            trip = self._trip(conn, trip_id)
            name = text(payload.get('name'), '旅程名稱')
            destination = text(payload.get('destination', ''), '目的地', required=False)
            start_date = day(payload.get('start_date', ''), required=False)
            currency = payload.get('currency', trip['currency'])
            if not isinstance(currency, str) or currency not in CURRENCIES:
                raise AppError('不支援這個幣別。')
            if currency != trip['currency'] and (
                conn.execute('SELECT 1 FROM expenses WHERE trip_id=? LIMIT 1', (trip_id,)).fetchone()
                or conn.execute('SELECT 1 FROM settlements WHERE trip_id=? LIMIT 1', (trip_id,)).fetchone()
            ):
                raise AppError('已有帳目後不可變更幣別，請另外建立旅程。')
            conn.execute('UPDATE trips SET name=?,destination=?,start_date=?,currency=?,updated_at=? WHERE id=?', (name, destination, start_date, currency, now(), trip_id))

    def delete_trip(self, trip_id):
        with self.session(write=True) as conn:
            self._trip(conn, trip_id)
            # Explicit order preserves member RESTRICT constraints during a full-trip delete.
            conn.execute('DELETE FROM settlements WHERE trip_id=?', (trip_id,))
            conn.execute('DELETE FROM expenses WHERE trip_id=?', (trip_id,))
            conn.execute('DELETE FROM members WHERE trip_id=?', (trip_id,))
            conn.execute('DELETE FROM trips WHERE id=?', (trip_id,))

    def add_member(self, trip_id, payload):
        with self.session(write=True) as conn:
            self._trip(conn, trip_id)
            members = self._members(conn, trip_id)
            if len(members) >= 50:
                raise AppError('每個旅程最多 50 位成員。')
            name = text(payload.get('name'), '成員姓名', 30)
            if name.casefold() in {m['name'].casefold() for m in members}:
                raise AppError('這個姓名已經存在。')
            member_id = str(uuid.uuid4())
            conn.execute('INSERT INTO members VALUES (?,?,?,?)', (member_id, trip_id, name, max(m['sort_order'] for m in members) + 1))
            self._touch(conn, trip_id)
            return member_id

    def update_member(self, trip_id, member_id, payload):
        with self.session(write=True) as conn:
            members = self._members(conn, trip_id)
            if member_id not in {m['id'] for m in members}:
                raise AppError('找不到這位成員。', 404)
            name = text(payload.get('name'), '成員姓名', 30)
            if name.casefold() in {m['name'].casefold() for m in members if m['id'] != member_id}:
                raise AppError('這個姓名已經存在。')
            conn.execute('UPDATE members SET name=? WHERE id=?', (name, member_id))
            self._touch(conn, trip_id)

    def delete_member(self, trip_id, member_id):
        with self.session(write=True) as conn:
            members = self._members(conn, trip_id)
            if member_id not in {m['id'] for m in members}:
                raise AppError('找不到這位成員。', 404)
            if len(members) <= 2:
                raise AppError('旅程至少需保留兩位成員。')
            used = conn.execute('SELECT 1 FROM expense_payments WHERE member_id=? UNION ALL SELECT 1 FROM expense_shares WHERE member_id=? UNION ALL SELECT 1 FROM settlements WHERE payer_id=? OR payee_id=? LIMIT 1', (member_id, member_id, member_id, member_id)).fetchone()
            if used:
                raise AppError('這位成員已有帳目或還款紀錄，請先移除相關紀錄；也可以只修改姓名。')
            conn.execute('DELETE FROM members WHERE id=?', (member_id,))
            self._touch(conn, trip_id)

    def _entries(self, payload, key, member_order):
        entries = payload.get(key)
        if not isinstance(entries, list) or not 1 <= len(entries) <= len(member_order):
            raise AppError('請選擇有效的付款人與分攤成員。')
        ids = []
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get('member_id'), str) or entry['member_id'] not in member_order:
                raise AppError('付款人或分攤成員不屬於這個旅程。')
            ids.append(entry['member_id'])
        if len(set(ids)) != len(ids):
            raise AppError('同一位成員不可重複填寫。')
        return sorted(entries, key=lambda entry: member_order[entry['member_id']])

    def save_expense(self, trip_id, payload, expense_id=None):
        with self.session(write=True) as conn:
            trip = self._trip(conn, trip_id)
            if expense_id:
                existing = conn.execute('SELECT * FROM expenses WHERE id=? AND trip_id=?', (expense_id, trip_id)).fetchone()
                if not existing:
                    raise AppError('找不到這筆支出。', 404)
                if payload.get('version') != existing['updated_at']:
                    raise AppError('這筆支出已被更新，請關閉視窗並重新載入後再編輯。', 409)
                client_id = existing['client_id']
            else:
                client_id = text(payload.get('client_id'), '儲存識別碼', 100)
                repeated = conn.execute('SELECT id FROM expenses WHERE trip_id=? AND client_id=?', (trip_id, client_id)).fetchone()
                if repeated:
                    return repeated['id']
            title = text(payload.get('title'), '支出名稱')
            amount = money(payload.get('amount'), trip['currency'])
            spent_on = day(payload.get('spent_on'))
            category = payload.get('category', 'other')
            if not isinstance(category, str) or category not in CATEGORIES:
                raise AppError('支出分類不正確。')
            note = text(payload.get('note', ''), '備註', 1000, required=False)
            mode = payload.get('split_mode', 'equal')
            if mode not in ('equal', 'units', 'exact'):
                raise AppError('分攤方式不正確。')
            members = self._members(conn, trip_id)
            member_order = {entry['id']: index for index, entry in enumerate(members)}
            raw_payments = self._entries(payload, 'payments', member_order)
            payments = [(entry['member_id'], money(entry.get('amount'), trip['currency'])) for entry in raw_payments]
            if sum(value for _, value in payments) != amount:
                raise AppError('各付款人的代墊金額合計，必須等於這筆支出的總金額。')
            raw_shares = self._entries(payload, 'shares', member_order)
            weights = []
            if mode == 'exact':
                share_amounts = [money(entry.get('value'), trip['currency'], allow_zero=True) for entry in raw_shares]
                if sum(share_amounts) != amount:
                    raise AppError('各成員指定的分攤金額合計，必須等於總金額。')
                weights = [None] * len(raw_shares)
            else:
                for entry in raw_shares:
                    raw_weight = '1' if mode == 'equal' else str(entry.get('value', ''))
                    if not re.fullmatch(r'[1-9][0-9]{0,3}', raw_weight, re.ASCII) or int(raw_weight) > 1000:
                        raise AppError('份數請填 1～1000 的整數；例如大人 2 份、小孩 1 份。')
                    weights.append(int(raw_weight))
                share_amounts = allocate(amount, [(entry['member_id'], weight) for entry, weight in zip(raw_shares, weights)])
            timestamp = now()
            if expense_id:
                conn.execute('UPDATE expenses SET title=?,amount=?,spent_on=?,category=?,note=?,split_mode=?,updated_at=? WHERE id=?', (title, amount, spent_on, category, note, mode, timestamp, expense_id))
                conn.execute('DELETE FROM expense_payments WHERE expense_id=?', (expense_id,))
                conn.execute('DELETE FROM expense_shares WHERE expense_id=?', (expense_id,))
            else:
                expense_id = str(uuid.uuid4())
                conn.execute('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?)', (expense_id, trip_id, title, amount, spent_on, category, note, mode, client_id, timestamp, timestamp))
            conn.executemany('INSERT INTO expense_payments VALUES (?,?,?)', [(expense_id, member_id, value) for member_id, value in payments])
            conn.executemany('INSERT INTO expense_shares VALUES (?,?,?,?)', [(expense_id, entry['member_id'], value, weight) for entry, value, weight in zip(raw_shares, share_amounts, weights)])
            self._touch(conn, trip_id)
            return expense_id

    def delete_expense(self, trip_id, expense_id, version):
        with self.session(write=True) as conn:
            row = conn.execute('SELECT updated_at FROM expenses WHERE trip_id=? AND id=?', (trip_id, expense_id)).fetchone()
            if not row:
                raise AppError('找不到這筆支出。', 404)
            if version != row['updated_at']:
                raise AppError('這筆支出已更新，請重新載入後再刪除。', 409)
            conn.execute('DELETE FROM expenses WHERE id=?', (expense_id,))
            self._touch(conn, trip_id)

    def _balances(self, conn, trip_id, members):
        values = {m['id']: {'member_id': m['id'], 'name': m['name'], 'paid': 0, 'share': 0, 'sent': 0, 'received': 0, 'net': 0} for m in members}
        for row in conn.execute('SELECT p.member_id,SUM(p.amount) AS value FROM expense_payments p JOIN expenses e ON e.id=p.expense_id WHERE e.trip_id=? GROUP BY p.member_id', (trip_id,)):
            values[row['member_id']]['paid'] = row['value']
        for row in conn.execute('SELECT s.member_id,SUM(s.amount) AS value FROM expense_shares s JOIN expenses e ON e.id=s.expense_id WHERE e.trip_id=? GROUP BY s.member_id', (trip_id,)):
            values[row['member_id']]['share'] = row['value']
        for row in conn.execute('SELECT payer_id,payee_id,amount FROM settlements WHERE trip_id=?', (trip_id,)):
            values[row['payer_id']]['sent'] += row['amount']
            values[row['payee_id']]['received'] += row['amount']
        for entry in values.values():
            entry['net'] = entry['paid'] - entry['share'] + entry['sent'] - entry['received']
        return list(values.values())

    def add_settlement(self, trip_id, payload):
        with self.session(write=True) as conn:
            trip = self._trip(conn, trip_id)
            client_id = text(payload.get('client_id'), '儲存識別碼', 100)
            repeated = conn.execute('SELECT id FROM settlements WHERE trip_id=? AND client_id=?', (trip_id, client_id)).fetchone()
            if repeated:
                return repeated['id']
            balances = {entry['member_id']: entry for entry in self._balances(conn, trip_id, self._members(conn, trip_id))}
            payer, payee = payload.get('payer_id'), payload.get('payee_id')
            if not isinstance(payer, str) or not isinstance(payee, str) or payer not in balances or payee not in balances or payer == payee:
                raise AppError('請選擇這個旅程中不同的付款人與收款人。')
            amount = money(payload.get('amount'), trip['currency'])
            maximum = min(-balances[payer]['net'], balances[payee]['net'])
            if amount > maximum:
                raise AppError('還款金額超過目前應付／應收金額，請重新整理結算結果。', 409)
            settlement_id = str(uuid.uuid4())
            conn.execute('INSERT INTO settlements VALUES (?,?,?,?,?,?,?,?,?)', (settlement_id, trip_id, payer, payee, amount, day(payload.get('paid_on')), text(payload.get('note', ''), '備註', 1000, required=False), client_id, now()))
            self._touch(conn, trip_id)
            return settlement_id

    def delete_settlement(self, trip_id, settlement_id):
        with self.session(write=True) as conn:
            row = conn.execute('SELECT id FROM settlements WHERE id=? AND trip_id=?', (settlement_id, trip_id)).fetchone()
            if not row:
                raise AppError('找不到這筆還款紀錄。', 404)
            conn.execute('DELETE FROM settlements WHERE id=?', (settlement_id,))
            self._touch(conn, trip_id)

    def get_trip(self, trip_id):
        with self.session() as conn:
            conn.execute('BEGIN')
            trip = self._trip(conn, trip_id)
            members = self._members(conn, trip_id)
            expenses = [dict(row) for row in conn.execute('SELECT * FROM expenses WHERE trip_id=? ORDER BY spent_on DESC, created_at DESC, id', (trip_id,))]
            by_id = {entry['id']: entry for entry in expenses}
            for entry in expenses:
                entry['payments'], entry['shares'] = [], []
            for key, table in [('payments', 'expense_payments'), ('shares', 'expense_shares')]:
                for row in conn.execute(f'SELECT p.* FROM {table} p JOIN expenses e ON e.id=p.expense_id JOIN members m ON m.id=p.member_id WHERE e.trip_id=? ORDER BY m.sort_order, m.id', (trip_id,)):
                    by_id[row['expense_id']][key].append(dict(row))
            settlements = [dict(row) for row in conn.execute('SELECT * FROM settlements WHERE trip_id=? ORDER BY paid_on DESC,created_at DESC', (trip_id,))]
            balances = self._balances(conn, trip_id, members)
            transfers = suggest_transfers(balances)
            return {'trip': trip, 'members': members, 'expenses': expenses, 'settlements': settlements, 'balances': balances, 'transfers': transfers, 'total': sum(entry['amount'] for entry in expenses), 'outstanding': sum(entry['amount'] for entry in transfers)}
