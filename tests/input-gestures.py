"""Browser regression for terminal focus and Live2D gestures. Build dist first."""
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def open_page(context, base):
    for host in ['api.github.com', 'v1.hitokoto.cn', 'wttr.in']:
        context.route(f'https://{host}/**', lambda route: route.abort())
    context.add_init_script('localStorage.setItem("linfon-weather-v1", \'{"mode":"rain","city":""}\')')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('.live2d-widget[data-ready=true]')
    return page


def box_point(locator, x, y):
    box = locator.bounding_box()
    return box['x'] + box['width'] * x, box['y'] + box['height'] * y


def terminal_input(page, touch=False):
    screen = page.locator('[data-linux-screen]')
    screen.scroll_into_view_if_needed()
    lines = page.locator('[data-linux-lines]')
    field = page.locator('.terminal-input')
    page.evaluate('getSelection().removeAllRanges()')
    # A screenshot-like click in empty scrollback, never a locator that focuses the input.
    x, y = box_point(screen, .62, .77)
    if touch:
        page.touchscreen.tap(x, y)
    else:
        page.mouse.move(x, y)
        page.evaluate('document.activeElement.blur()')
        page.mouse.click(x, y)
    assert field.evaluate('e=>e===document.activeElement'), 'blank click/tap did not focus the terminal'
    page.keyboard.press('Control+a')
    page.keyboard.insert_text('echo focus-regression')
    page.keyboard.press('Enter')
    assert lines.locator('.terminal-row').filter(has_text='focus-regression').count() == 2
    if not touch:
        # Text is still selectable with a real drag, and a later blank click refocuses.
        text = lines.locator('.terminal-row').filter(has_text='focus-regression').last
        bounds = text.evaluate('e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().toJSON()}')
        y = bounds['y'] + bounds['height'] / 2
        page.mouse.move(bounds['x'] + 1, y)
        page.mouse.down()
        page.mouse.move(bounds['right'] - 1, y, steps=8)
        page.mouse.up()
        selected = page.evaluate('getSelection().toString()')
        assert 'ocus-regressio' in selected, (selected, bounds)
        page.mouse.click(*box_point(screen, .65, .84))
        assert field.evaluate('e=>e===document.activeElement')


def position(widget):
    box = widget.bounding_box()
    return box['x'], box['y']


def wait_for_floor(page):
    page.wait_for_function('''()=>{const w=document.querySelector('.live2d-widget'),b=w.getBoundingClientRect();
      return Math.abs(b.bottom-innerHeight)<1&&w.dataset.reaction==='land'}''')


dist = Path(__file__).resolve().parents[1] / 'dist'
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(dist)))
Thread(target=server.serve_forever, daemon=True).start()
errors = []
base = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=os.getenv('BROWSER_PATH'),
                                            args=['--enable-unsafe-swiftshader'])
        desktop = browser.new_context(viewport={'width': 1440, 'height': 980})
        page = open_page(desktop, base)
        terminal_input(page)
        print('PASS desktop blank click, typing and selecting output', flush=True)
        widget = page.locator('.live2d-widget')
        start = position(widget)
        x, y = box_point(widget, .5, .28)
        page.mouse.click(x, y)
        assert widget.get_attribute('data-taps') == '1'
        page.mouse.click(x, y)
        assert widget.get_attribute('data-reaction') == 'love'
        page.mouse.down()
        page.wait_for_function('["nuzzle","grumble"].includes(document.querySelector(".live2d-widget").dataset.reaction)')
        page.mouse.up()
        assert widget.get_attribute('data-taps') == '2'
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x - 350, y - 240, steps=12)
        page.wait_for_function('document.querySelector(".live2d-widget").classList.contains("is-dragging")')
        page.wait_for_function('''()=>{const w=document.querySelector('.live2d-widget'),r=w.getBoundingClientRect(),s=w._weatherShelter;
          if(!s||r.x>1000)return false;
          const p=new DOMPoint(0,0).matrixTransform(w.querySelector('.umbrella-canopy').getScreenCTM());
          return Math.hypot(p.x-s.curve[8].x,p.y-s.curve[8].y)<.5}''')
        held = position(widget)
        assert abs(held[0] - (start[0] - 350)) < 2 and abs(held[1] - (start[1] - 240)) < 2
        page.mouse.up()
        page.wait_for_function('''y=>{const b=document.querySelector('.live2d-widget').getBoundingClientRect();
          return b.y>y+2&&b.bottom<innerHeight-2}''', arg=held[1])
        wait_for_floor(page)
        moved = position(widget)
        assert abs(moved[0] - held[0]) < 1 and abs(moved[1] - start[1]) < 1
        assert widget.get_attribute('data-taps') == '2'
        page.locator('.main-nav a[href="/articles/"]').click()
        page.wait_for_function('document.body.dataset.page==="articles"')
        assert position(widget) == moved
        # Older versions saved a midair y value; reloading still puts the dragon on the floor.
        page.evaluate('''()=>{const key='linfon-live2d-position',p=JSON.parse(localStorage.getItem(key));
          if('y' in p)throw new Error('Stored airborne position');localStorage.setItem(key,JSON.stringify({...p,y:.2}))}''')
        page.reload(wait_until='networkidle')
        page.wait_for_selector('.live2d-widget[data-ready=true]')
        assert position(widget) == moved
        widget.locator('canvas').press('Shift+ArrowLeft')
        assert abs(position(widget)[0] - moved[0] + 24) < 2
        widget.locator('[data-live2d-size]').click()
        page.locator('[data-size-reset]').click()
        assert position(widget) == start
        print('PASS desktop gestures, umbrella tracking, animated fall and horizontal persistence', flush=True)

        x, y = box_point(widget, .5, .28)
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x - 220, y - 420, steps=8)
        page.wait_for_function('document.querySelector(".live2d-widget").classList.contains("is-dragging")')
        page.mouse.up()
        page.wait_for_function('''y=>{const b=document.querySelector('.live2d-widget').getBoundingClientRect();
          return b.y>y+2&&b.bottom<innerHeight-2}''', arg=start[1]-420)
        page.mouse.move(*box_point(widget, .5, .28))
        page.mouse.down()
        page.mouse.move(x - 300, y - 370, steps=5)
        page.wait_for_function('document.querySelector(".live2d-widget").classList.contains("is-dragging")')
        page.wait_for_timeout(850)
        assert widget.bounding_box()['y'] < start[1] - 250
        page.mouse.up()
        wait_for_floor(page)
        print('PASS grabbing Live2D again interrupts the fall', flush=True)

        page.emulate_media(reduced_motion='reduce')
        x, y = box_point(widget, .5, .28)
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x - 140, y - 220, steps=6)
        page.wait_for_function('''y=>document.querySelector('.live2d-widget').getBoundingClientRect().y<y-200''',
                               arg=start[1])
        page.mouse.up()
        assert abs(widget.bounding_box()['y'] - start[1]) < 1
        print('PASS reduced motion lands immediately', flush=True)
        desktop.close()

        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True,
                                     device_scale_factor=3)
        page = open_page(mobile, base)
        terminal_input(page, touch=True)
        print('PASS mobile blank tap and typing', flush=True)
        widget = page.locator('.live2d-widget')
        start = position(widget)
        x, y = box_point(widget, .5, .28)
        page.touchscreen.tap(x, y)
        assert widget.get_attribute('data-taps') == '1'
        session = mobile.new_cdp_session(page)
        before_scroll = page.evaluate('scrollY')
        session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        for step in range(1, 9):
            session.send('Input.dispatchTouchEvent', {'type': 'touchMove',
                         'touchPoints': [{'x': x - 12 * step, 'y': y - 20 * step}]})
        session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        wait_for_floor(page)
        moved = position(widget)
        assert abs(moved[0] - start[0] + 96) < 2 and abs(moved[1] - start[1]) < 2, (start, moved)
        assert page.evaluate('scrollY') == before_scroll
        assert widget.get_attribute('data-taps') == '1'
        assert page.evaluate('([x,y])=>!document.elementFromPoint(x,y).closest(".live2d-widget")', [moved[0]+2, moved[1]+2])
        page.set_viewport_size({'width': 844, 'height': 390})
        page.wait_for_function('''()=>{const r=document.querySelector('.live2d-widget').getBoundingClientRect();
          return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}''')
        print('PASS real touch drag, automatic landing, transparent corner, and resize bounds', flush=True)
        mobile.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
assert not errors, errors
