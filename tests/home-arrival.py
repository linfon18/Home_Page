"""Check actual homepage opening animations across document and SPA navigation."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import re
import time
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
        # Record CSS animation events rather than sampling a brief animation on a slow machine.
        ctx.add_init_script("""
          window.openings=0;
          window.finishes=0;
          window.homeTransitions=0;
          window.petSeed=null;
          window.petMoves=[];
          new MutationObserver(records => {
            for(const {target:pet} of records) {
              if(!pet.matches('.home-pet')) continue;
              petMoves.push(pet.dataset.pose);
              if(pet.dataset.pose !== 'seed') continue;
              const dot=document.querySelector('.home-period-dot').getBoundingClientRect();
              const body=pet.querySelector('.home-pet-body').getBoundingClientRect();
              petSeed={x:body.x+body.width/2-dot.x-dot.width/2,
                       y:body.y+body.height/2-dot.y-dot.height/2,
                       width:body.width-dot.width};
            }
          }).observe(document,{subtree:true,attributes:true,attributeFilter:['data-pose']});
          document.addEventListener('animationstart', e => { if(e.animationName === 'arrival-console') openings++; });
          document.addEventListener('animationend', e => { if(e.animationName === 'arrival-console') finishes++; });
          window.addEventListener('site-page', () => requestAnimationFrame(() => {
            if (document.body.dataset.page !== 'home') return;
            const container = document.querySelector('#main');
            const transition = container.getAnimations().find(a =>
              a.effect.target === container && a.effect.getKeyframes()[0].opacity === '0.45');
            if (transition) transition.finished.then(() => homeTransitions++, () => {});
          }));
          sessionStorage.setItem('linfon-home-visited','1');
        """)
        page = ctx.new_page()
        page.goto(base)
        page.evaluate("""() => {
          document.querySelector('#home-name').dispatchEvent(new PointerEvent('pointermove', {bubbles:true}));
          window.dispatchEvent(new Event('scroll'));
          window.dispatchEvent(new Event('blur'));
        }""")
        page.wait_for_function('openings === 1 && finishes === 1')
        page.wait_for_function('document.documentElement.dataset.homeEntrance === "played"')
        page.wait_for_function("""() => {
          const pet=document.querySelector('.home-pet');
          return pet.dataset.pose==='rest' && !pet.hasAttribute('data-perched') &&
            pet.getBoundingClientRect().bottom >= pet.parentElement.getBoundingClientRect().bottom - 1;
        }""")
        assert page.evaluate("petMoves.includes('fall') && Object.values(petSeed).every(n=>Math.abs(n)<1)")
        page.emulate_media(reduced_motion='reduce')
        page.emulate_media(reduced_motion='no-preference')
        assert page.locator('html').get_attribute('data-home-entrance') == 'played'
        page.reload()
        assert page.evaluate('openings') == 0
        assert page.locator('.home-console').evaluate('e=>getComputedStyle(e).animationName') == 'none'
        page.wait_for_function("petMoves.includes('fall')")
        assert page.evaluate('Object.values(petSeed).every(n=>Math.abs(n)<1)')
        page.goto(base + '/about/')
        page.locator('.main-nav a[href="/"]').click()
        page.wait_for_selector('#home-name')
        page.wait_for_function('homeTransitions === 1')
        assert page.evaluate('openings') == 0
        assert not page.evaluate('petMoves.includes("seed")')
        # Drop the ball into the narrow gap between the two pill-shaped buttons.
        pet = page.locator('.home-pet')
        pet.scroll_into_view_if_needed()
        x, y, exit_x, gap_x, above = page.evaluate("""() => {
          const rect=selector=>document.querySelector(selector).getBoundingClientRect();
          const pet=rect('.home-pet'), card=rect('.home-profile');
          const left=rect('.home-buttons a:first-child'), right=rect('.home-buttons a:last-child');
          return [pet.x+18,pet.y+18,card.right-28,(left.right+right.left)/2,Math.min(left.top,right.top)-52];
        }""")
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(exit_x, y, steps=8)
        page.mouse.move(exit_x, above, steps=8)
        page.mouse.move(gap_x, above, steps=8)
        page.wait_for_timeout(175)
        page.mouse.up()
        page.wait_for_function("petMoves.includes('detour')")
        page.wait_for_function("""() => {
          const pet=document.querySelector('.home-pet');
          return pet.getBoundingClientRect().bottom >= pet.parentElement.getBoundingClientRect().bottom - 1;
        }""", timeout=6000)
        page.locator('.main-nav a[href="/articles/"]').click()
        page.wait_for_url('**/articles/')
        page.go_back()
        page.wait_for_selector('#home-name')
        page.wait_for_function('homeTransitions === 2')
        assert page.evaluate('openings') == 0
        page.emulate_media(reduced_motion='reduce')
        page.locator('.main-nav a[href="/articles/"]').click()
        page.wait_for_url('**/articles/')
        page.locator('.main-nav a[href="/"]').click()
        page.wait_for_selector('#home-name')
        assert page.locator('#main').evaluate('e=>e.getAnimations().length') == 0
        assert page.evaluate('openings') == 0
        page.emulate_media(reduced_motion='no-preference')
        page.goto(base, referer=base + '/about/')
        assert page.evaluate('openings') == 0
        # Simulate loading a direct visit in an initially hidden document.
        page.add_init_script("Object.defineProperty(document,'hidden',{configurable:true,value:true})")
        page.goto(base + '/?background')
        assert page.evaluate('openings') == 0
        page.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_function('openings === 1 && finishes === 1')
        page.emulate_media(reduced_motion='reduce')
        page.goto(base + '/?reduce')
        page.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
        assert page.evaluate('openings') == 0
        print('Homepage opening navigation checks passed.')
        ctx.close()

        ctx = browser.new_context(viewport={'width': 390, 'height': 844})
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda route: route.abort())
        image_url = 'https://www.bing.com/th?id=OHR.Test_1366x768.jpg'
        image = dist / 'assets/avatar-source.jpg'
        calls = []

        def reply_metadata(route):
            calls.append('metadata')
            assert 'resolution=1366' in route.request.url
            time.sleep(1.35)
            route.fulfill(json={'url': image_url}, headers={'Access-Control-Allow-Origin': '*'})

        ctx.route('https://bing.biturl.top/**', reply_metadata)
        ctx.route(image_url, lambda route: route.fulfill(path=image, content_type='image/jpeg',
                  headers={'Access-Control-Allow-Origin': '*'}))
        ctx.add_init_script("""
          window.wallpaperTiming=[];
          const fetchOriginal = window.fetch;
          window.fetch = function(url, ...args) {
            if (String(url).startsWith('https://bing.biturl.top/')) {
              wallpaperTiming.push(document.body === null ? 'head' : 'body');
            }
            return fetchOriginal.call(this, url, ...args);
          };
          document.addEventListener('animationend', e => {
            if (e.animationName === 'arrival-console') wallpaperTiming.push('console');
            if (e.animationName === 'landscape-exposure') wallpaperTiming.push('wallpaper');
          });
        """)
        page = ctx.new_page()
        page.goto(base, wait_until='domcontentloaded')
        page.wait_for_function("wallpaperTiming.includes('wallpaper')")
        assert page.evaluate('wallpaperTiming') == ['head', 'console', 'wallpaper']
        assert page.locator('.daily-wallpaper').evaluate('e=>e.complete && e.naturalWidth>0')
        page.reload(wait_until='domcontentloaded')
        page.locator('.daily-wallpaper').wait_for()
        assert calls == ['metadata'], calls
        page.locator('[data-daily-wallpaper]').evaluate('e=>e.click()')
        page.reload(wait_until='domcontentloaded')
        assert page.locator('[data-daily-wallpaper]').get_attribute('aria-pressed') == 'false'
        assert page.locator('.daily-wallpaper').count() == 0
        assert page.evaluate('wallpaperTiming') == []
        print('Cold wallpaper request, slow network, cached revisit and opt-out checks passed.')
    finally:
        browser.close()
        server.shutdown()
