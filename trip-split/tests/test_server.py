import http.client
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import Handler, TripServer
from store import Store


class QuietHandler(Handler):
    def log_request(self, *args):
        pass


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / 'test.sqlite3')
        self.server = TripServer(('127.0.0.1', 0), self.store)
        self.server.RequestHandlerClass = QuietHandler
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.temp.cleanup()

    def call(self, path, method='GET', payload=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = dict(headers or {})
        if payload is not None:
            headers['Content-Type'] = 'application/json'
        connection.request(method, path, body=json.dumps(payload).encode() if payload is not None else None, headers=headers)
        response = connection.getresponse()
        status, data, returned_headers = response.status, response.read(), dict(response.getheaders())
        connection.close()
        if returned_headers.get('Content-Type', '').startswith('application/json'):
            data = json.loads(data)
        return status, data, returned_headers

    def test_crud_and_exports(self):
        status, data, _ = self.call('/api/trips', 'POST', {'name': '台南出遊', 'members': ['小安', '小美', '小林']})
        self.assertEqual(status, 201)
        trip_id = data['trip']['id']; members = data['members']
        expense = {'title': '=SUM(1,1)', 'amount': '100', 'spent_on': '2026-10-27', 'category': 'food', 'split_mode': 'equal', 'client_id': 'first-expense', 'payments': [{'member_id': members[0]['id'], 'amount': '100'}], 'shares': [{'member_id': m['id']} for m in members]}
        status, data, _ = self.call('/api/trips/' + trip_id + '/expenses', 'POST', expense)
        self.assertEqual(status, 200)
        self.assertEqual([m['share'] for m in data['balances']], [3334, 3333, 3333])
        expense_id, version = data['expenses'][0]['id'], data['expenses'][0]['updated_at']
        status, csv, headers = self.call('/api/trips/' + trip_id + '/export')
        self.assertEqual(status, 200)
        self.assertIn("'=SUM(1,1)", csv.decode('utf-8-sig'))
        self.assertIn('attachment', headers['Content-Disposition'])
        self.assertEqual(self.call('/api/trips/' + trip_id + '/expenses/' + expense_id, 'DELETE', {'version': 'outdated'})[0], 409)
        status, data, _ = self.call('/api/trips/' + trip_id + '/expenses/' + expense_id, 'DELETE', {'version': version})
        self.assertEqual(status, 200); self.assertEqual(data['total'], 0)
        self.assertEqual(self.call('/api/trips/' + trip_id, 'DELETE')[0], 200)
        self.assertEqual(self.call('/api/trips/' + trip_id)[0], 404)

    def test_database_and_source_files_not_served(self):
        for path in ['/data/test.sqlite3', '/server.py', '/schema.sql', '/../store.py']:
            self.assertEqual(self.call(path)[0], 404)
        status, body, headers = self.call('/')
        self.assertEqual(status, 200)
        self.assertIn('旅伴分帳', body.decode())
        self.assertIn('Content-Security-Policy', headers)

    def test_lan_auth_and_cross_origin_checks(self):
        self.server.token = 'a-secret-for-the-test-only'
        self.assertEqual(self.call('/api/config')[0], 200)
        self.assertEqual(self.call('/api/trips')[0], 401)
        headers = {'X-Trip-Key': self.server.token}
        self.assertEqual(self.call('/api/trips', headers=headers)[0], 200)
        self.assertEqual(self.call('/api/trips', headers={**headers, 'Origin': 'http://example.invalid'})[0], 403)
        self.assertEqual(self.call('/api/trips', headers={**headers, 'Host': 'example.invalid'})[0], 403)

    def test_bad_input_returns_client_errors(self):
        self.assertEqual(self.call('/api/trips', 'POST', {'name': 'Bad', 'members': ['A', 'B'], 'currency': []})[0], 400)
        status, data, _ = self.call('/api/trips', 'POST', {'name': 'Valid', 'members': ['A', 'B']})
        self.assertEqual(status, 201)
        payload = {'title': 'x', 'amount': '1.001', 'spent_on': '2026-10-27', 'client_id': 'invalid'}
        self.assertEqual(self.call('/api/trips/' + data['trip']['id'] + '/expenses', 'POST', payload)[0], 400)

    def test_lan_command_line_initializes_key_and_database(self):
        database = Path(self.temp.name) / 'lan' / 'trips.sqlite3'
        environment = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
        process = subprocess.Popen([sys.executable, '-u', str(Path(__file__).resolve().parents[1] / 'server.py'), '--lan', '--port', '0', '--db', str(database)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', env=environment)
        try:
            lines = []
            def consume():
                for line in process.stdout:
                    lines.append(line)
            reader = threading.Thread(target=consume, daemon=True); reader.start()
            import time
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                match = re.search(r'http://127\.0\.0\.1:(\d+)/\?key=([A-Za-z0-9_-]+)', ''.join(lines))
                if match:
                    break
                if process.poll() is not None:
                    self.fail('Server exited during startup: ' + process.stderr.read())
                time.sleep(.02)
            else:
                self.fail('LAN server startup timed out')
            port, key = int(match[1]), match[2]
            connection = http.client.HTTPConnection('127.0.0.1', port)
            connection.request('GET', '/api/trips', headers={'X-Trip-Key': key})
            response = connection.getresponse(); data = json.loads(response.read()); connection.close()
            self.assertEqual(response.status, 200)
            self.assertEqual(data, {'trips': []})
            self.assertEqual((database.parent / 'access.key').read_text(), key)
            self.assertTrue(database.is_file())
        finally:
            process.terminate(); process.wait(timeout=10)
            process.stdout.close(); process.stderr.close()


if __name__ == '__main__':
    unittest.main()
