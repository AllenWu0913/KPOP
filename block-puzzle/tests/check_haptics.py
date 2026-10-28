"""Browser regression check with a mocked vibration API; no physical-device claims."""
import html
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CHECK = r'''<!doctype html><meta charset="utf-8"><title>Placement feedback checks</title>
<pre id="result">WAIT</pre><script>
(async () => {
  const checks = [];
  const check = (value, label) => { if (!value) throw Error(label); checks.push(label); };
  async function game(mode) {
    const frame = document.createElement('iframe'); frame.width = 430; frame.height = 1000;
    const ready = new Promise(resolve => frame.onload = resolve);
    frame.src = '/__game?mode=' + mode; document.body.append(frame); await ready;
    const w = frame.contentWindow, d = frame.contentDocument, $ = id => d.getElementById(id);
    const score = () => Number($('score').textContent.replaceAll(',', ''));
    function drag(slot, x, y, type = 'mouse', cancel = false) {
      const button = d.querySelector('[data-slot="' + slot + '"]');
      const start = button.getBoundingClientRect(), first = $('board').children[0].getBoundingClientRect();
      const pitch = $('board').children[1].getBoundingClientRect().left - first.left;
      const shape = w.BlockPuzzleRules.shapes[slot];
      const width = (shape.width - 1) * pitch + first.width;
      const height = (shape.height - 1) * pitch + first.height;
      const bx = $('board').getBoundingClientRect().left + x * pitch + width / 2;
      const by = $('board').getBoundingClientRect().top + y * pitch + (type === 'mouse' ? height / 2 : height + 24);
      const send = (target, name, cx, cy) => target.dispatchEvent(new w.PointerEvent(name, {bubbles:true,cancelable:true,pointerId:1,pointerType:type,isPrimary:true,button:0,buttons:name === 'pointerup' ? 0 : 1,clientX:cx,clientY:cy}));
      send(button, 'pointerdown', start.left + start.width / 2, start.top + start.height / 2);
      send(w, 'pointermove', bx, by);
      check(w.hapticCalls.length === (mode === 'normal' ? score() / 5 : 0), mode + ': preview adds no vibration');
      send(w, cancel ? 'pointercancel' : 'pointerup', bx, by);
    }
    return {w,d,$,frame,drag,score};
  }
  try {
    const g = await game('normal');
    check(g.w.hapticCalls.length === 0, 'no vibration when loading game');
    g.drag(0,0,0);
    check(g.score() === 5 && JSON.stringify(g.w.hapticCalls) === '[20]', 'valid mouse drop vibrates exactly once for 20ms');
    g.drag(1,0,0);
    check(g.score() === 5 && g.w.hapticCalls.length === 1, 'overlapping drop does not vibrate or score');
    g.drag(1,7,0);
    check(g.score() === 5 && g.w.hapticCalls.length === 1, 'out-of-bounds drop does not vibrate');
    g.drag(1,-20,-20);
    check(g.w.hapticCalls.length === 1, 'drop outside board does not vibrate');
    g.drag(1,1,0,'touch',true);
    check(g.score() === 5 && g.w.hapticCalls.length === 1, 'cancelled touch drag does not vibrate');
    g.drag(1,1,0,'touch');
    check(g.score() === 15 && g.w.hapticCalls.length === 2, 'valid touch drop vibrates once while sound is off');
    await new Promise(resolve => setTimeout(resolve,300));
    g.d.querySelector('[data-slot="2"]').click();
    g.$('board').querySelector('[data-x="4"][data-y="0"]').click();
    check(g.score() === 25 && g.w.hapticCalls.length === 3, 'tap-to-place also vibrates once');
    g.$('helpButton').click(); g.$('dialogConfirm').click();
    g.$('newGameButton').click(); g.$('dialogConfirm').click();
    check(g.score() === 0 && g.w.hapticCalls.length === 3, 'help and restart do not vibrate');
    check(!g.w.gameErrors.length, 'normal feedback has no browser errors'); g.frame.remove();
    for (const mode of ['missing','rejected','throws']) {
      const other = await game(mode); other.drag(0,0,0,'touch');
      check(other.score() === 5 && other.d.querySelectorAll('.cell.filled').length === 1 && !other.w.gameErrors.length, mode + ' vibration API never interrupts placement');
      other.frame.remove();
    }
    document.getElementById('result').textContent = JSON.stringify({ok:true,count:checks.length,checks});
  } catch(error) { document.getElementById('result').textContent = JSON.stringify({ok:false,checks,error:error.stack}); }
})();
</script>'''


class CheckServer(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/__check':
            body, mime = CHECK.encode(), 'text/html; charset=utf-8'
        elif url.path == '/__game':
            mode = parse_qs(url.query).get('mode', ['normal'])[0]
            stub = "undefined" if mode == 'missing' else "function(ms){ window.hapticCalls.push(ms); " + ("throw Error('Blocked vibration');" if mode == 'throws' else "return false;" if mode == 'rejected' else "return true;") + " }"
            setup = "<base href='/'><script>window.hapticCalls=[];window.gameErrors=[];window.addEventListener('error',e=>gameErrors.push(e.message));Math.random=()=>0;Object.defineProperty(navigator,'vibrate',{configurable:true,value:" + stub + "});Element.prototype.setPointerCapture=function(){};Element.prototype.hasPointerCapture=function(){return false;};</script>"
            body = (ROOT / 'index.html').read_text(encoding='utf-8').replace('<head>', '<head>' + setup).encode()
            mime = 'text/html; charset=utf-8'
        elif url.path in ('/rules.js', '/game.js', '/style.css'):
            file = ROOT / url.path.lstrip('/')
            body, mime = file.read_bytes(), 'text/css' if file.suffix == '.css' else 'application/javascript'
        else:
            self.send_error(404); return
        self.send_response(200); self.send_header('Content-Type', mime); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)


def main():
    browser = next((p for p in [shutil.which('google-chrome'), shutil.which('chromium'), r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'] if p and Path(p).is_file()), None)
    if not browser:
        raise SystemExit('Chrome or Edge is required; no browser was installed automatically.')
    with tempfile.TemporaryDirectory(prefix='block-puzzle-haptics-') as temporary:
        server = ThreadingHTTPServer(('127.0.0.1', 0), CheckServer)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            result = subprocess.run([browser,'--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--user-data-dir='+temporary,'--virtual-time-budget=10000','--dump-dom',f'http://127.0.0.1:{server.server_port}/__check'],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=30)
            match = re.search(r'<pre id="result">([^<]+)</pre>',result.stdout)
            if not match:
                raise SystemExit('No browser report: ' + result.stderr[-1000:])
            report = json.loads(html.unescape(match[1])); print(json.dumps(report,ensure_ascii=False,indent=2))
            if not report.get('ok'): raise SystemExit(1)
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__':
    main()
