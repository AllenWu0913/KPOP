"""Self-hosted accounts. Passwords, sessions and invitations never leave SQLite."""
from contextlib import contextmanager
import hashlib
import hmac
import re
import secrets
import sqlite3
import threading
import time
import uuid

from store import AppError, text

AUTH_SCHEMA = '''
CREATE TABLE IF NOT EXISTS accounts (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trip_access (
 trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('owner','editor')),
 PRIMARY KEY(trip_id,user_id)
);
CREATE TABLE IF NOT EXISTS account_sessions (
 digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trip_invites (
 id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
 digest TEXT NOT NULL UNIQUE, expires INTEGER NOT NULL,
 used_by TEXT REFERENCES accounts(id), revoked INTEGER NOT NULL DEFAULT 0
);
'''


def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def username(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z0-9_.-]{3,40}', value):
        raise AppError('帳號請使用 3～40 個英文字母、數字、點、底線或減號。')
    return value.lower()


def password_hash(password):
    if not isinstance(password, str) or not 12 <= len(password) <= 128:
        raise AppError('密碼請使用 12～128 個字元。')
    salt = secrets.token_hex(16)
    result = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=32768, r=8, p=1, maxmem=64*1024*1024)
    return salt + ':' + result.hex()


def password_matches(password, encoded):
    if not isinstance(password, str) or len(password) > 128:
        return False
    salt, expected = encoded.split(':')
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=32768, r=8, p=1, maxmem=64*1024*1024)
    return hmac.compare_digest(actual.hex(), expected)


class Accounts:
    def __init__(self, store):
        self.store = store
        with store.session() as conn:
            conn.executescript(AUTH_SCHEMA)
        self.lock = threading.Lock()
        self.attempts = {}
        self.workers = threading.BoundedSemaphore(4)
        self.dummy_password = password_hash(secrets.token_urlsafe(24))

    @contextmanager
    def limit(self, peer, label):
        current = time.monotonic()
        with self.lock:
            self.attempts = {key: values for key, values in self.attempts.items() if values and values[-1] > current - 300}
            keys = [('peer:' + peer, 40), ('user:' + str(label)[:80].lower(), 10)]
            prepared = {}
            for key, maximum in keys:
                values = [t for t in self.attempts.get(key, []) if t > current - 300]
                if len(values) >= maximum or len(self.attempts) > 2048:
                    raise AppError('登入嘗試太頻繁，請等五分鐘後再試。', 429)
                prepared[key] = values
            for key, values in prepared.items():
                self.attempts[key] = values + [current]
        if not self.workers.acquire(blocking=False):
            raise AppError('登入服務忙碌中，請稍後再試。', 429)
        try:
            yield
        finally:
            self.workers.release()

    def public(self, row):
        return {key: row[key] for key in ('id', 'username', 'name')}

    def init_owner(self, login, name, password):
        login, name, encoded = username(login), text(name, '顯示名稱', 30), password_hash(password)
        user_id = str(uuid.uuid4())
        with self.store.session(write=True) as conn:
            if conn.execute('SELECT 1 FROM accounts LIMIT 1').fetchone():
                raise AppError('已有帳號，不可重複初始化。請使用 reset-password 重設密碼。')
            conn.execute('INSERT INTO accounts VALUES (?,?,?,?)', (user_id, login, name, encoded))
            conn.execute("INSERT INTO trip_access SELECT id, ?, 'owner' FROM trips", (user_id,))
        return user_id

    def reset_password(self, login, password):
        login, encoded = username(login), password_hash(password)
        with self.store.session(write=True) as conn:
            user = conn.execute('SELECT id FROM accounts WHERE username=?', (login,)).fetchone()
            if not user:
                raise AppError('找不到帳號。', 404)
            conn.execute('UPDATE accounts SET password=? WHERE id=?', (encoded, user['id']))
            conn.execute('DELETE FROM account_sessions WHERE user_id=?', (user['id'],))

    def _session(self, conn, user):
        token = secrets.token_urlsafe(32)
        expires = int(time.time()) + 14*86400
        conn.execute('DELETE FROM account_sessions WHERE expires<=?', (int(time.time()),))
        conn.execute('INSERT INTO account_sessions VALUES (?,?,?)', (digest(token), user['id'], expires))
        return {'user': self.public(user), 'token': token, 'expires': expires}

    def login(self, payload, peer):
        login = username(payload.get('username'))
        with self.limit(peer, login):
            with self.store.session() as conn:
                user = conn.execute('SELECT * FROM accounts WHERE username=?', (login,)).fetchone()
            valid = password_matches(payload.get('password'), user['password'] if user else self.dummy_password)
            if not user or not valid:
                raise AppError('帳號或密碼不正確。', 401)
            with self.store.session(write=True) as conn:
                # A local password reset must invalidate an in-flight old-password login too.
                current = conn.execute('SELECT * FROM accounts WHERE id=?', (user['id'],)).fetchone()
                if not current or current['password'] != user['password']:
                    raise AppError('密碼已變更，請重新登入。', 401)
                return self._session(conn, user)

    def authenticate(self, authorization):
        if not authorization.startswith('Bearer ') or len(authorization) > 150:
            raise AppError('請先登入。', 401)
        with self.store.session() as conn:
            row = conn.execute('''SELECT a.* FROM account_sessions s JOIN accounts a ON a.id=s.user_id
                WHERE s.digest=? AND s.expires>?''', (digest(authorization[7:]), int(time.time()))).fetchone()
            if not row:
                raise AppError('登入已到期，請重新登入。', 401)
            return self.public(row)

    def logout(self, authorization):
        with self.store.session(write=True) as conn:
            conn.execute('DELETE FROM account_sessions WHERE digest=?', (digest(authorization[7:]),))

    def role(self, trip_id, user_id, owner=False):
        with self.store.session() as conn:
            row = conn.execute('SELECT role FROM trip_access WHERE trip_id=? AND user_id=?', (trip_id, user_id)).fetchone()
        if not row:
            raise AppError('找不到旅程，或你尚未獲得存取權。', 404)
        if owner and row['role'] != 'owner':
            raise AppError('只有旅程建立者可以執行此操作。', 403)
        return row['role']

    def _invite(self, conn, token):
        if not isinstance(token, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{40,60}', token):
            raise AppError('邀請碼無效、已使用或已到期。', 400)
        row = conn.execute('SELECT * FROM trip_invites WHERE digest=? AND expires>? AND used_by IS NULL AND revoked=0', (digest(token), int(time.time()))).fetchone()
        if not row:
            raise AppError('邀請碼無效、已使用或已到期。', 400)
        return row

    def register(self, payload, peer):
        login, name = username(payload.get('username')), text(payload.get('name'), '顯示名稱', 30)
        with self.limit(peer, login):
            with self.store.session() as conn:
                self._invite(conn, payload.get('invite'))
            encoded = password_hash(payload.get('password'))
            with self.store.session(write=True) as conn:
                invite = self._invite(conn, payload.get('invite'))
                user_id = str(uuid.uuid4())
                try:
                    conn.execute('INSERT INTO accounts VALUES (?,?,?,?)', (user_id, login, name, encoded))
                except sqlite3.IntegrityError:
                    raise AppError('這個帳號已被使用，請改用其他帳號，或直接登入。', 409) from None
                conn.execute("INSERT INTO trip_access VALUES (?,?,'editor')", (invite['trip_id'], user_id))
                conn.execute('UPDATE trip_invites SET used_by=? WHERE id=?', (user_id, invite['id']))
                user = {'id': user_id, 'username': login, 'name': name}
                return {**self._session(conn, user), 'trip_id': invite['trip_id']}

    def join(self, token, user_id):
        with self.store.session(write=True) as conn:
            invite = self._invite(conn, token)
            conn.execute("INSERT OR IGNORE INTO trip_access VALUES (?,?,'editor')", (invite['trip_id'], user_id))
            conn.execute('UPDATE trip_invites SET used_by=? WHERE id=?', (user_id, invite['id']))
            return invite['trip_id']

    def invite(self, trip_id, user_id):
        self.role(trip_id, user_id, owner=True)
        token, invite_id, expires = secrets.token_urlsafe(32), str(uuid.uuid4()), int(time.time()) + 7*86400
        with self.store.session(write=True) as conn:
            conn.execute('DELETE FROM trip_invites WHERE expires<=?', (int(time.time()),))
            count = conn.execute('SELECT COUNT(*) FROM trip_invites WHERE trip_id=? AND used_by IS NULL AND revoked=0', (trip_id,)).fetchone()[0]
            if count >= 100:
                raise AppError('有效邀請已達上限，請先撤銷舊邀請。')
            conn.execute('INSERT INTO trip_invites (id,trip_id,digest,expires) VALUES (?,?,?,?)', (invite_id, trip_id, digest(token), expires))
        return {'invite': token, 'expires': expires}

    def access_list(self, trip_id, user_id):
        self.role(trip_id, user_id, owner=True)
        with self.store.session() as conn:
            return [dict(row) for row in conn.execute('SELECT a.id,a.name,a.username,t.role FROM accounts a JOIN trip_access t ON a.id=t.user_id WHERE t.trip_id=? ORDER BY t.role DESC,a.username', (trip_id,))]

    def revoke(self, trip_id, user_id, target=None):
        self.role(trip_id, user_id, owner=True)
        with self.store.session(write=True) as conn:
            if target:
                conn.execute("DELETE FROM trip_access WHERE trip_id=? AND user_id=? AND role='editor'", (trip_id, target))
            else:
                conn.execute('UPDATE trip_invites SET revoked=1 WHERE trip_id=?', (trip_id,))
