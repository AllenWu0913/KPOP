"""Local administration only. Never put passwords in command-line arguments."""
import argparse
from getpass import getpass
from pathlib import Path

from auth import Accounts, username
from store import AppError, Store

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description='旅伴分帳：本機帳號管理')
    parser.add_argument('command', choices=['init-admin', 'reset-password', 'claim-trips'])
    parser.add_argument('--db', type=Path, default=ROOT / 'data' / 'trips.sqlite3')
    args = parser.parse_args()
    store = Store(args.db)
    accounts = Accounts(store)
    try:
        login = username(input('帳號（英文或數字，至少 3 碼）：').strip())
        if args.command == 'claim-trips':
            with store.session(write=True) as conn:
                user = conn.execute('SELECT id FROM accounts WHERE username=?', (login,)).fetchone()
                if not user:
                    raise AppError('找不到帳號。')
                count = conn.execute("INSERT INTO trip_access SELECT id, ?, 'owner' FROM trips WHERE id NOT IN (SELECT trip_id FROM trip_access)", (user['id'],)).rowcount
            print(f'已將 {count} 個未分配權限的舊旅程交給此帳號。')
            return
        name = input('顯示名稱：').strip() if args.command == 'init-admin' else ''
        password = getpass('密碼（至少 12 碼，輸入時不顯示）：')
        if password != getpass('再次輸入密碼：'):
            raise AppError('兩次密碼不一致。')
        if args.command == 'init-admin':
            accounts.init_owner(login, name, password)
            print('帳號已建立，現有旅程已歸你管理。其他人需使用旅程邀請註冊。')
        else:
            accounts.reset_password(login, password)
            print('密碼已更新，這個帳號的所有裝置需重新登入。')
    except (AppError, EOFError, KeyboardInterrupt) as error:
        raise SystemExit(str(error) or '已取消。') from None


if __name__ == '__main__':
    main()
