"""Real-browser GitHub-subpath / cross-origin / invitation workflow, isolated DB."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import argparse
import html
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from auth import Accounts
from server import Handler, TripServer, CONTENT_TYPES
from store import Store


class Frontend(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        prefix = '/project/trip-split/static/'
        mime = 'text/html; charset=utf-8'
        if path == '/__internet-check':
            body = (ROOT / 'tests/internet_browser_check.html').read_bytes()
        elif path == '/__phone-preview':
            body = b'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}iframe{border:0;width:430px;height:1000px}</style><iframe src="/project/trip-split/static/"></iframe>'
        elif path == '/__internet-check.js':
            body = (ROOT / 'tests/internet_browser_check.js').read_bytes(); mime = CONTENT_TYPES['.js']
        elif path == prefix + 'config.js':
            body = ('window.TRIP_CONFIG=' + json.dumps({'apiBase': self.server.api_base}) + ';').encode(); mime = CONTENT_TYPES['.js']
        elif path.startswith(prefix) and path[len(prefix):] in ('', 'index.html', 'app.js', 'style.css', 'favicon.svg'):
            file = ROOT / 'static' / (path[len(prefix):] or 'index.html')
            body, mime = file.read_bytes(), CONTENT_TYPES[file.suffix]
        else:
            self.send_error(404); return
        self.send_response(200); self.send_header('Content-Type', mime); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshot', type=Path)
    args = parser.parse_args()
    browser = next((p for p in [shutil.which('google-chrome'), shutil.which('chromium'), r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'] if p and Path(p).is_file()), None)
    if not browser:
        raise SystemExit('需要 Chrome 或 Edge。')
    with tempfile.TemporaryDirectory(prefix='trip-split-remote-check-') as temporary:
        store = Store(Path(temporary) / 'isolated.sqlite3')
        Accounts(store).init_owner('owner', '測試主辦', 'test-password-only-1234')
        front = ThreadingHTTPServer(('127.0.0.1', 0), Frontend)
        front_base = 'http://127.0.0.1:' + str(front.server_port)
        api = TripServer(('127.0.0.1', 0), store, internet={'public_url':'https://test-api.invalid','allowed_origins':[front_base]})
        class QuietApi(Handler):
            def log_request(self, *args):
                pass
        api.RequestHandlerClass = QuietApi
        front.api_base = 'http://127.0.0.1:' + str(api.server_port)
        threads = [threading.Thread(target=s.serve_forever, daemon=True) for s in (front,api)]
        for thread in threads: thread.start()
        try:
            result = subprocess.run([browser,'--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--user-data-dir='+str(Path(temporary)/'chrome'),'--virtual-time-budget=90000','--dump-dom',front_base+'/__internet-check'],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=120)
            match = re.search(r'<pre id="result">([^<]+)</pre>',result.stdout)
            if not match:
                raise RuntimeError('沒有收到瀏覽器結果。' + result.stderr[-1500:])
            report = json.loads(html.unescape(match.group(1)))
            print(json.dumps(report,ensure_ascii=False,indent=2))
            if not report.get('ok'): raise SystemExit(1)
            if args.screenshot:
                subprocess.run([browser,'--headless=new','--disable-gpu','--no-first-run','--window-size=430,1000','--force-device-scale-factor=1','--user-data-dir='+str(Path(temporary)/'screenshot-profile'),'--virtual-time-budget=2000','--screenshot='+str(args.screenshot.resolve()),front_base+'/__phone-preview'],capture_output=True,timeout=30,check=True)
        finally:
            for server in (front,api): server.shutdown(); server.server_close()
            for thread in threads: thread.join()


if __name__ == '__main__':
    main()
