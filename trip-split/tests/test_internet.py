import concurrent.futures
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from auth import Accounts, digest
from server import TripServer, read_internet_config
from store import AppError, Store
import test_server

PASSWORD = 'test-password-only-1234'


class InternetTests(unittest.TestCase):
    call = test_server.HttpTests.call

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / 'test.sqlite3')
        # Seed the previous version's data before adding any auth tables.
        self.old_trip = self.store.create_trip({'name': '原有旅程', 'members': ['甲', '乙']})
        accounts = Accounts(self.store)
        self.owner_id = accounts.init_owner('allen', '小安', PASSWORD)
        self.server = TripServer(('127.0.0.1', 0), self.store, internet={'public_url': 'https://api.example.test', 'allowed_origins': ['https://travel.example.test']})
        self.server.RequestHandlerClass = test_server.QuietHandler
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        result = self.call('/api/auth/login', 'POST', {'username': 'ALLEN', 'password': PASSWORD})
        self.assertEqual(result[0], 200)
        self.owner_token = result[1]['token']
        self.owner = {'Authorization': 'Bearer ' + self.owner_token, 'Origin': 'https://travel.example.test'}

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.temp.cleanup()

    def trip(self, name='新旅程', headers=None):
        result = self.call('/api/trips', 'POST', {'name': name, 'members': ['甲', '乙']}, headers=headers or self.owner)
        self.assertEqual(result[0], 201)
        return result[1]

    def invite(self, trip_id):
        result = self.call('/api/trips/' + trip_id + '/invites', 'POST', {}, headers=self.owner)
        self.assertEqual(result[0], 201)
        return result[1]['invite']

    def friend(self, token=None, login='friend'):
        result = self.call('/api/auth/register', 'POST', {'username': login, 'name': '旅伴', 'password': PASSWORD, 'invite': token or self.invite(self.old_trip)})
        self.assertEqual(result[0], 200)
        return result[1], {'Authorization': 'Bearer ' + result[1]['token']}

    def test_migration_and_private_trip_scoping(self):
        self.assertEqual(self.call('/api/trips')[0], 401)
        data = self.call('/api/trips', headers=self.owner)[1]['trips']
        self.assertEqual([t['id'] for t in data], [self.old_trip])
        private = self.trip()['trip']['id']
        account, friend = self.friend()
        self.assertEqual([t['id'] for t in self.call('/api/trips', headers=friend)[1]['trips']], [self.old_trip])
        for suffix in ['', '/export', '/members', '/expenses', '/settlements', '/access', '/invites']:
            self.assertEqual(self.call('/api/trips/' + private + suffix, headers=friend)[0], 404)
        self.assertEqual(self.call('/api/trips/' + self.old_trip, 'DELETE', headers=friend)[0], 403)
        self.assertEqual(self.call('/api/trips/' + self.old_trip + '/invites', 'POST', {}, headers=friend)[0], 403)
        mine = self.trip('朋友自己的旅行', friend)['trip']['id']
        self.assertEqual(self.call('/api/trips/' + mine, headers=self.owner)[0], 404)
        self.assertEqual(self.call('/api/trips/' + mine, headers=friend)[1]['role'], 'owner')
        # Passwords, tokens and invite secrets are not stored in plaintext.
        with self.store.session() as conn:
            self.assertNotIn(PASSWORD, str([dict(r) for r in conn.execute('SELECT * FROM accounts')]))
            self.assertNotIn(self.owner_token, str([dict(r) for r in conn.execute('SELECT * FROM account_sessions')]))

    def test_cors_preflight_and_host_allowlists(self):
        headers = {'Origin': 'https://travel.example.test', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type'}
        status, _, returned = self.call('/api/trips', 'OPTIONS', headers=headers)
        self.assertEqual(status, 204)
        self.assertEqual(returned['Access-Control-Allow-Origin'], headers['Origin'])
        self.assertNotIn('Access-Control-Allow-Credentials', returned)
        self.assertEqual(self.call('/api/trips', 'OPTIONS', headers={**headers, 'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.call('/api/trips', 'OPTIONS', headers={**headers, 'Access-Control-Request-Headers': 'x-unknown'})[0], 403)
        self.assertEqual(self.call('/api/config', headers={'Host': 'evil.example'})[0], 403)
        self.assertEqual(self.call('/api/trips', headers={**self.owner, 'Host': 'api.example.test'})[0], 200)
        self.assertEqual(self.call('/api/trips', headers={**self.owner, 'Host': 'api.example.test', 'Origin': 'http://api.example.test'})[0], 403)

    def test_invites_are_atomic_one_use_expiring_and_revocable(self):
        token = self.invite(self.old_trip)
        def register(n):
            return self.call('/api/auth/register', 'POST', {'username': 'friend' + str(n), 'name': '友', 'password': PASSWORD, 'invite': token})[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(register, [1, 2]))
        self.assertEqual(sorted(statuses), [200, 400])
        self.assertEqual(self.call('/api/auth/register', 'POST', {'username': 'empty', 'name': '友', 'password': PASSWORD})[0], 400)
        expired = self.invite(self.old_trip)
        with self.store.session(write=True) as conn:
            conn.execute('UPDATE trip_invites SET expires=? WHERE digest=?', (int(time.time())-1, digest(expired)))
        self.assertEqual(self.call('/api/join', 'POST', {'invite': expired}, headers=self.owner)[0], 400)
        revoked = self.invite(self.old_trip)
        self.assertEqual(self.call('/api/trips/' + self.old_trip + '/invites', 'DELETE', headers=self.owner)[0], 200)
        self.assertEqual(self.call('/api/join', 'POST', {'invite': revoked}, headers=self.owner)[0], 400)
        with self.store.session() as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM accounts').fetchone()[0], 2)

    def test_join_existing_account_edit_sync_and_revoke(self):
        account, friend = self.friend()
        trip = self.trip(); trip_id = trip['trip']['id']; base = '/api/trips/' + trip_id
        token = self.invite(trip_id)
        self.assertEqual(self.call('/api/join', 'POST', {'invite': token}, headers=friend)[0], 200)
        a, b = [m['id'] for m in trip['members']]
        payload = {'title': '手機記下晚餐', 'amount': '100', 'spent_on': '2026-10-27', 'category': 'food', 'split_mode': 'equal', 'client_id': 'mobile-test', 'payments': [{'member_id': a, 'amount': '100'}], 'shares': [{'member_id': a}, {'member_id': b}]}
        result = self.call(base + '/expenses', 'POST', payload, headers=friend)
        self.assertEqual(result[0], 200)
        self.assertEqual(self.call(base, headers=self.owner)[1]['total'], 10000)
        payload['version'] = 'stale'
        self.assertEqual(self.call(base + '/expenses/' + result[1]['expenses'][0]['id'], 'PUT', payload, headers=self.owner)[0], 409)
        users = self.call(base + '/access', headers=self.owner)[1]['users']
        self.assertEqual(len(users), 2)
        self.assertEqual(self.call(base + '/access/' + account['user']['id'], 'DELETE', headers=self.owner)[0], 200)
        self.assertEqual(self.call(base, headers=friend)[0], 404)
        self.assertEqual(self.call(base + '/expenses', 'POST', payload, headers=friend)[0], 404)
        self.assertEqual(self.call(base, headers=self.owner)[1]['total'], 10000)
        self.assertEqual(self.call('/api/auth/me', headers=friend)[0], 200)
        # Removal never deletes historical financial members or entries.
        self.assertEqual(len(self.store.get_trip(trip_id)['members']), 2)

    def test_sessions_expire_logout_and_password_reset(self):
        self.assertEqual(self.call('/api/auth/login', 'POST', {'username': 'allen', 'password': 'wrong'})[0], 401)
        self.assertEqual(self.call('/api/auth/logout', 'POST', {}, headers=self.owner)[0], 200)
        self.assertEqual(self.call('/api/auth/me', headers=self.owner)[0], 401)
        result = self.server.accounts.login({'username': 'allen', 'password': PASSWORD}, 'test-peer')
        auth = {'Authorization': 'Bearer ' + result['token']}
        with self.store.session(write=True) as conn:
            conn.execute('UPDATE account_sessions SET expires=0')
        self.assertEqual(self.call('/api/auth/me', headers=auth)[0], 401)
        result = self.server.accounts.login({'username': 'allen', 'password': PASSWORD}, 'test-peer')
        self.server.accounts.reset_password('allen', 'new-password-test-1234')
        self.assertEqual(self.call('/api/auth/me', headers={'Authorization': 'Bearer ' + result['token']})[0], 401)
        self.assertEqual(self.call('/api/auth/login', 'POST', {'username': 'allen', 'password': PASSWORD})[0], 401)

    def test_rate_limit_and_invalid_configs(self):
        for i in range(9):
            self.assertEqual(self.call('/api/auth/login', 'POST', {'username': 'allen', 'password': 'bad'})[0], 401)
        self.assertEqual(self.call('/api/auth/login', 'POST', {'username': 'allen', 'password': PASSWORD})[0], 429)
        # A blocked username from a new peer must not leave an empty limiter entry.
        for _ in range(2):
            with self.assertRaises(AppError) as rejected:
                self.server.accounts.login({'username': 'allen', 'password': PASSWORD}, 'another-peer')
            self.assertEqual(rejected.exception.status, 429)
        path = Path(self.temp.name) / 'internet.json'
        for url in ['http://api.example', 'https://api.example/path', 'https://user:pass@api.example', 'https://api.example?x=1']:
            path.write_text(json.dumps({'public_url': url, 'allowed_origins': []}))
            with self.assertRaises(ValueError):
                read_internet_config(path)
        path.write_text(json.dumps({'public_url': 'https://api.example/', 'allowed_origins': ['https://me.github.io/']}))
        self.assertEqual(read_internet_config(path)['allowed_origins'], ['https://me.github.io'])


if __name__ == '__main__':
    unittest.main()
