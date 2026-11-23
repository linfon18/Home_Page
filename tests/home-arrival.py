"""Check actual homepage opening animations across document and SPA navigation."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import re
from playwright.sync_api import sync_playwright


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


dist = Path(__file__).resolve().parents[1] / 'dist'
with ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(dist))) as server, sync_playwright() as pw:
    Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    browser = pw.chromium.launch(executable_path=os.getenv('BROWSER_PATH'))
    try:
        ctx = browser.new_context()
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda route: route.abort())
        # Record launches rather than sampling a brief animation on a slow machine.
        ctx.add_init_script("""
          window.openings=0;
          const original=Element.prototype.animate;
          Element.prototype.animate=function(...args){
            if(this.matches('#home-name .name-type i:first-child')) openings++;
            return original.apply(this,args);
          };
          sessionStorage.setItem('linfon-home-visited','1');
        """)
        page = ctx.new_page()
        page.goto(base)
        assert page.evaluate('openings') == 1
        page.reload()
        assert page.evaluate('openings') == 0
        page.goto(base + '/about/')
        page.locator('.main-nav a[href="/"]').click()
        page.wait_for_selector('#home-name')
        assert page.evaluate('openings') == 0
        page.locator('.main-nav a[href="/articles/"]').click()
        page.wait_for_url('**/articles/')
        page.go_back()
        page.wait_for_selector('#home-name')
        assert page.evaluate('openings') == 0
        page.goto(base, referer=base + '/about/')
        assert page.evaluate('openings') == 0
        # Simulate loading a direct visit in an initially hidden document.
        page.add_init_script("Object.defineProperty(document,'hidden',{configurable:true,value:true})")
        page.goto(base + '/?background')
        assert page.evaluate('openings') == 0
        page.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
        assert page.evaluate('openings') == 1
        page.emulate_media(reduced_motion='reduce')
        page.goto(base + '/?reduce')
        page.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
        assert page.evaluate('openings') == 0
        print('Homepage opening navigation checks passed.')
    finally:
        browser.close()
        server.shutdown()
