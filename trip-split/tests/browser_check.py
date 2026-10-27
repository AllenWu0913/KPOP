"""Optional real-browser workflow checks; creates an isolated, disposable SQLite DB."""
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
from server import Handler, TripServer
from store import Store


class CheckHandler(Handler):
    def log_request(self, *args):
        pass

    def _dispatch(self):
        special = {'/__check': ('browser_check.html', 'text/html; charset=utf-8'), '/__check.js': ('browser_check.js', 'application/javascript; charset=utf-8')}
        if self.path in special:
            name, mime = special[self.path]
            self.send_bytes((ROOT / 'tests' / name).read_bytes(), mime)
        else:
            super()._dispatch()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshot', type=Path)
    args = parser.parse_args()
    chrome = next((path for path in [shutil.which('google-chrome'), shutil.which('chromium'), r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'] if path and Path(path).is_file()), None)
    if not chrome:
        raise SystemExit('需要已安裝的 Chrome 或 Edge 才能執行瀏覽器檢查。')
    with tempfile.TemporaryDirectory(prefix='trip-split-check-') as temporary:
        folder = Path(temporary)
        store = Store(folder / 'test.sqlite3')
        server = TripServer(('127.0.0.1', 0), store)
        server.RequestHandlerClass = CheckHandler
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        common = [chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--force-device-scale-factor=1', '--user-data-dir=' + str(folder / 'chrome')]
        try:
            result = subprocess.run(common + ['--virtual-time-budget=60000', '--dump-dom', base + '/__check'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=90)
            match = re.search(r'<pre id="result">([^<]+)</pre>', result.stdout)
            if not match:
                print(result.stderr[-2000:])
                raise SystemExit('沒有收到瀏覽器檢查結果。')
            report = json.loads(html.unescape(match.group(1)))
            print(json.dumps(report, ensure_ascii=False, indent=2))
            if not report.get('ok'):
                raise SystemExit(1)
            if args.screenshot:
                subprocess.run(common + ['--window-size=1350,1050', '--virtual-time-budget=1500', '--screenshot=' + str(args.screenshot.resolve()), base + '/'], capture_output=True, timeout=30)
                print('Screenshot:', args.screenshot)
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__':
    main()
