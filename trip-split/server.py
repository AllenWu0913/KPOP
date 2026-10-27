"""SQLite travel ledger: loopback, trusted LAN, or account-authenticated HTTPS tunnel."""
from __future__ import annotations

import argparse
import csv
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import re
import secrets
import socket
import sqlite3
import sys
from urllib.parse import parse_qs, urlsplit

from store import AppError, CATEGORIES, CURRENCIES, Store
from auth import Accounts

ROOT = Path(__file__).resolve().parent
STATIC_FILES = {'/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/config.js': 'config.js', '/style.css': 'style.css', '/favicon.svg': 'favicon.svg'}
CONTENT_TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml'}


def local_addresses():
    addresses = set()
    try:
        for entry in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = entry[4][0]
            if not address.startswith('127.'):
                addresses.add(address)
    except OSError:
        pass
    return sorted(addresses)


def decimal_amount(value, currency):
    digits = CURRENCIES[currency]['decimals']
    return f'{value // 10**digits}.{value % 10**digits:0{digits}d}' if digits else str(value)


def csv_export(data):
    out = io.StringIO(newline='')
    writer = csv.writer(out)
    writer.writerow(['類型', '日期', '名稱', '幣別', '金額', '付款明細', '分攤明細', '備註'])
    names = {entry['id']: entry['name'] for entry in data['members']}
    currency = data['trip']['currency']

    def safe(value):
        value = str(value)
        return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) else value

    for expense in data['expenses']:
        payments = '；'.join(names[p['member_id']] + ' ' + decimal_amount(p['amount'], currency) for p in expense['payments'])
        shares = '；'.join(names[p['member_id']] + ' ' + decimal_amount(p['amount'], currency) for p in expense['shares'])
        writer.writerow([safe(value) for value in ['支出', expense['spent_on'], expense['title'], currency, decimal_amount(expense['amount'], currency), payments, shares, expense['note']]])
    for settlement in data['settlements']:
        label = names[settlement['payer_id']] + ' → ' + names[settlement['payee_id']]
        writer.writerow([safe(value) for value in ['還款', settlement['paid_on'], label, currency, decimal_amount(settlement['amount'], currency), label, '', settlement['note']]])
    return ('\ufeff' + out.getvalue()).encode('utf-8')


class TripServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, store, *, lan=False, token='', internet=None):
        super().__init__(address, Handler)
        self.store, self.lan, self.token = store, lan, token
        self.internet = internet
        self.accounts = Accounts(store) if internet is not None else None
        self.origins = set(internet['allowed_origins']) if internet else set()
        if internet:
            self.origins.add(internet['public_url'])
        self.addresses = local_addresses()
        self.allowed_hosts = {'localhost', '127.0.0.1', '::1', *self.addresses}
        if address[0] not in ('', '0.0.0.0'):
            self.allowed_hosts.add(address[0])
        if internet:
            self.allowed_hosts.add(urlsplit(internet['public_url']).hostname)

    def config(self):
        port = self.server_address[1]
        return {'currencies': CURRENCIES, 'categories': CATEGORIES, 'lan': self.lan, 'auth_required': bool(self.token), 'account_auth': self.accounts is not None, 'share_urls': [f'http://{ip}:{port}/' for ip in self.addresses] if self.lan else []}


class Handler(BaseHTTPRequestHandler):
    server_version = 'TravelSplit/1.0'

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def log_request(self, code='-', size='-'):
        # Keep access keys in query strings out of request logs.
        sys.stderr.write(f'{self.command} {urlsplit(self.path).path} {code}\n')

    def send_bytes(self, value, content_type, status=200, filename=None):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(value)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        origin = self.headers.get('Origin')
        if self.server.internet and origin in self.server.origins:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            if self.command == 'OPTIONS':
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
                self.send_header('Access-Control-Max-Age', '600')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'")
        if filename:
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(value)

    def send_json(self, value, status=200):
        self.send_bytes(json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8'), 'application/json; charset=utf-8', status)

    def _guard(self):
        raw_host = self.headers.get('Host', '')
        try:
            host = urlsplit('http://' + raw_host).hostname
        except ValueError:
            host = None
        if host not in self.server.allowed_hosts:
            raise AppError('不允許這個主機位址。請使用啟動視窗顯示的網址。', 403)
        origin = self.headers.get('Origin')
        same_local = origin == 'http://' + raw_host and (not self.server.internet or host in ('localhost', '127.0.0.1', '::1'))
        if origin and not same_local and origin not in self.server.origins:
            raise AppError('不接受來自其他網站的資料請求。', 403)
        if self.server.token and not secrets.compare_digest(self.headers.get('X-Trip-Key', '').encode('utf-8'), self.server.token.encode('utf-8')):
            raise AppError('請使用包含連線金鑰的分享網址，或輸入金鑰。', 401)

    def _body(self):
        if self.headers.get('Content-Type', '').split(';', 1)[0].strip().lower() != 'application/json':
            raise AppError('請使用 JSON 格式送出資料。', 415)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 256_000:
                raise ValueError
        except ValueError:
            raise AppError('送出的資料大小不正確。', 413) from None
        try:
            value = json.loads(self.rfile.read(length))
            if not isinstance(value, dict):
                raise ValueError
            return value
        except (ValueError, UnicodeError):
            raise AppError('無法讀取送出的 JSON 資料。') from None

    def _dispatch(self):
        parsed = urlsplit(self.path)
        path, method = parsed.path, self.command
        if method == 'GET' and path == '/api/config':
            if self.server.internet:
                self._guard()
            self.send_json(self.server.config())
            return
        if method == 'GET' and path in STATIC_FILES:
            if path == '/config.js':
                # This server serves its own API. Only the GitHub-hosted copy needs an apiBase.
                self.send_bytes(b"window.TRIP_CONFIG = {apiBase: ''};", CONTENT_TYPES['.js'])
                return
            file = ROOT / 'static' / STATIC_FILES[path]
            self.send_bytes(file.read_bytes(), CONTENT_TYPES[file.suffix])
            return
        self._guard()
        store = self.server.store
        accounts = self.server.accounts
        user = None
        if accounts:
            if method == 'POST' and path in ('/api/auth/login', '/api/auth/register'):
                function = accounts.login if path.endswith('/login') else accounts.register
                self.send_json(function(self._body(), self.client_address[0]))
                return
            user = accounts.authenticate(self.headers.get('Authorization', ''))
            if method == 'GET' and path == '/api/auth/me':
                self.send_json({'user': user})
                return
            if method == 'POST' and path == '/api/auth/logout':
                accounts.logout(self.headers.get('Authorization', ''))
                self.send_json({'ok': True})
                return
            if method == 'POST' and path == '/api/join':
                trip_id = accounts.join(self._body().get('invite'), user['id'])
                self.send_json({'trip_id': trip_id})
                return

        def detail(trip_id):
            data = store.get_trip(trip_id)
            if accounts:
                data['role'] = accounts.role(trip_id, user['id'])
            return data

        if path == '/api/trips':
            if method == 'GET':
                self.send_json({'trips': store.list_trips(user['id'] if user else None)})
                return
            if method == 'POST':
                trip_id = store.create_trip(self._body(), owner_id=user['id'] if user else None)
                self.send_json(detail(trip_id), 201)
                return
        matched = re.fullmatch(r'/api/trips/([a-zA-Z0-9-]+)(?:/(members|expenses|settlements|export|invites|access)(?:/([a-zA-Z0-9-]+))?)?', path)
        if not matched:
            raise AppError('找不到這個頁面或功能。', 404)
        trip_id, section, item_id = matched.groups()
        if accounts:
            accounts.role(trip_id, user['id'], owner=(section in ('invites', 'access') or (section is None and method in ('PUT', 'DELETE'))))
        if section in ('invites', 'access'):
            if not accounts:
                raise AppError('此功能僅用於個別帳號模式。', 400)
            if section == 'invites' and method == 'POST' and not item_id:
                self.send_json(accounts.invite(trip_id, user['id']), 201)
            elif section == 'invites' and method == 'DELETE' and not item_id:
                accounts.revoke(trip_id, user['id'])
                self.send_json({'ok': True})
            elif section == 'access' and method == 'GET' and not item_id:
                self.send_json({'users': accounts.access_list(trip_id, user['id'])})
            elif section == 'access' and method == 'DELETE' and item_id:
                accounts.revoke(trip_id, user['id'], item_id)
                self.send_json({'ok': True})
            else:
                raise AppError('不支援此操作。', 405)
            return
        if section is None:
            if method == 'GET':
                self.send_json(detail(trip_id))
                return
            if method == 'PUT':
                store.update_trip(trip_id, self._body())
            elif method == 'DELETE':
                store.delete_trip(trip_id)
                self.send_json({'ok': True})
                return
            else:
                raise AppError('不支援這個操作。', 405)
        elif section == 'members':
            if method == 'POST' and not item_id:
                store.add_member(trip_id, self._body())
            elif method == 'PUT' and item_id:
                store.update_member(trip_id, item_id, self._body())
            elif method == 'DELETE' and item_id:
                store.delete_member(trip_id, item_id)
            else:
                raise AppError('不支援這個成員操作。', 405)
        elif section == 'expenses':
            if method == 'POST' and not item_id:
                store.save_expense(trip_id, self._body())
            elif method == 'PUT' and item_id:
                store.save_expense(trip_id, self._body(), item_id)
            elif method == 'DELETE' and item_id:
                store.delete_expense(trip_id, item_id, self._body().get('version'))
            else:
                raise AppError('不支援這個帳目操作。', 405)
        elif section == 'settlements':
            if method == 'POST' and not item_id:
                store.add_settlement(trip_id, self._body())
            elif method == 'DELETE' and item_id:
                store.delete_settlement(trip_id, item_id)
            else:
                raise AppError('不支援這個還款操作。', 405)
        elif section == 'export' and method == 'GET' and not item_id:
            data = store.get_trip(trip_id)
            if parse_qs(parsed.query).get('format', ['csv'])[0] == 'json':
                self.send_bytes(json.dumps({'format_version': 1, **data}, ensure_ascii=False, indent=2).encode('utf-8'), 'application/json; charset=utf-8', filename=f'trip-{trip_id}.json')
            else:
                self.send_bytes(csv_export(data), 'text/csv; charset=utf-8', filename=f'trip-{trip_id}.csv')
            return
        else:
            raise AppError('不支援這個操作。', 405)
        self.send_json(detail(trip_id))

    def do_OPTIONS(self):
        try:
            self._guard()
            requested = {h.strip().lower() for h in self.headers.get('Access-Control-Request-Headers', '').split(',') if h.strip()}
            if not self.server.internet or not requested <= {'authorization', 'content-type'} or self.headers.get('Access-Control-Request-Method') not in ('GET', 'POST', 'PUT', 'DELETE'):
                raise AppError('不允許此跨網站請求。', 403)
            self.send_bytes(b'', 'text/plain', 204)
        except AppError as error:
            self.send_json({'error': str(error)}, error.status)

    def _handle(self):
        try:
            self._dispatch()
        except AppError as error:
            self.send_json({'error': str(error)}, error.status)
        except sqlite3.IntegrityError:
            self.send_json({'error': '資料有關聯衝突，請重新整理後再試。'}, 409)
        except sqlite3.OperationalError:
            self.send_json({'error': '資料庫暫時忙碌或無法寫入，請稍後再試並確認磁碟空間。'}, 503)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        except Exception as error:
            self.log_error('Internal error: %r', error)
            self.send_json({'error': '伺服器發生錯誤，請查看啟動視窗。'}, 500)

    do_GET = _handle
    do_POST = _handle
    do_PUT = _handle
    do_DELETE = _handle


def main():
    parser = argparse.ArgumentParser(description='旅伴分帳：Python + SQLite 本機網頁')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--lan', action='store_true', help='讓同一 Wi-Fi 的裝置連線；以連線金鑰保護 API')
    parser.add_argument('--db', type=Path, default=ROOT / 'data' / 'trips.sqlite3')
    parser.add_argument('--internet', type=Path, metavar='CONFIG', help='HTTPS 通道模式，使用指定 JSON 設定與個別帳號')
    args = parser.parse_args()
    store = Store(args.db)
    internet = None
    if args.internet:
        if args.lan:
            raise SystemExit('--internet 與 --lan 不可同時使用。')
        try:
            internet = read_internet_config(args.internet)
            accounts = Accounts(store)
            with store.session() as conn:
                if not conn.execute('SELECT 1 FROM accounts LIMIT 1').fetchone():
                    raise ValueError('請先執行 python manage.py init-admin 建立你的帳號。')
                if conn.execute('SELECT 1 FROM trips WHERE id NOT IN (SELECT trip_id FROM trip_access) LIMIT 1').fetchone():
                    raise ValueError('有未分配權限的舊旅程，請先執行 python manage.py claim-trips。')
        except (OSError, ValueError, AppError) as error:
            raise SystemExit(f'無法啟用外網模式：{error}') from None
    token = ''
    if args.lan:
        key_file = store.path.parent / 'access.key'
        if key_file.exists():
            token = key_file.read_text(encoding='utf-8').strip()
        else:
            token = secrets.token_urlsafe(24)
            key_file.write_text(token, encoding='utf-8')
        if not re.fullmatch(r'[a-zA-Z0-9_-]{20,100}', token):
            raise SystemExit('連線金鑰檔案格式不正確，請檢查 data/access.key。')
    try:
        server = TripServer(('0.0.0.0' if args.lan else '127.0.0.1', args.port), store, lan=args.lan, token=token, internet=internet)
    except OSError as error:
        raise SystemExit(f'無法啟動：{error}\n若連接埠已被使用，可改用 python server.py --port 8766') from None
    suffix = '?key=' + token if token else ''
    if internet:
        print('個別帳號模式已啟用；請另外啟動 HTTPS 通道。公開 API：' + internet['public_url'], flush=True)
        print('僅監聽 127.0.0.1，不需開放路由器的入站連接埠。', flush=True)
    print('\n旅伴分帳已啟動', flush=True)
    print(f'電腦開啟：http://127.0.0.1:{server.server_address[1]}/{suffix}', flush=True)
    if args.lan:
        for base in server.config()['share_urls']:
            print('同一 Wi-Fi 的手機：' + base + suffix, flush=True)
        print('分享網址含連線金鑰，請只提供給這次旅程的夥伴。', flush=True)
    print(f'資料庫：{store.path}\n按 Ctrl+C 關閉。\n', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n已關閉伺服器，帳目已保存在 SQLite。')
    finally:
        server.server_close()


def read_internet_config(path):
    value = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    if not isinstance(value, dict) or not isinstance(value.get('allowed_origins'), list):
        raise ValueError('設定須包含 public_url 與 allowed_origins 陣列。')

    def origin(raw):
        if not isinstance(raw, str):
            raise ValueError('網址必須是文字。')
        parsed = urlsplit(raw)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment or parsed.port not in (None, 443):
            raise ValueError('請填寫完整 HTTPS 網站來源，不含路徑，例如 https://你的帳號.github.io。')
        return 'https://' + parsed.netloc.lower()

    return {'public_url': origin(value.get('public_url')), 'allowed_origins': [origin(url) for url in value['allowed_origins']]}


if __name__ == '__main__':
    main()
