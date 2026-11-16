"""Geometry, interaction and lifecycle regressions. Build dist first; see README."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json, os

root = Path(__file__).resolve().parents[1]
checks, errors = [], []
captures = os.environ.get('EFFECTS_CAPTURE_DIR')
if captures:
    Path(captures).mkdir(parents=True, exist_ok=True)

def check(name, ok):
    checks.append({'check': name, 'passed': bool(ok)})
    print(('PASS ' if ok else 'FAIL ') + name, flush=True)

def shot(page, name):
    if captures:
        page.screenshot(path=str(Path(captures) / (name + '.png')))

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(root / 'dist')))
Thread(target=server.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:' + str(server.server_port)

# Capture the production surface controller without adding a production debug API.
instrument = '''
let factory;
Object.defineProperty(window,'createWeatherSurfaces',{configurable:true,get(){return factory},set(fn){factory=(...args)=>{window.testSurface=fn(...args);return testSurface}}});
window.geometryReads=0;
const rect=Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect=function(){geometryReads++;return rect.call(this)};
localStorage.setItem('linfon-weather-v1',JSON.stringify({mode:'rain',city:''}));
localStorage.setItem('linfon-theme','dark');
'''
mapping = '''() => [...document.querySelectorAll('.weather-field,.ambient-field,.catastrophe-canvas')].filter(c=>!c.hidden).every(c=>{
 const b=c.getBoundingClientRect(),v=c._viewport,m=c.getContext('2d').getTransform();
 return v&&Math.abs(v.width-b.width)<.01&&Math.abs(v.x-b.x)<.01&&Math.abs(m.a*b.x+m.e)<.01&&Math.abs(m.d*b.y+m.f)<.01&&Math.abs(b.width*m.a-c.width)<.01;
})'''
canopy = '''() => {
 const w=document.querySelector('.live2d-widget'),s=w._weatherShelter;
 if(!s)return {curve:999,hand:999};
 const matrix=w.querySelector('.umbrella-canopy').getScreenCTM();
 const curve=Math.max(...s.curve.map((p,i)=>{const x=-86+i/16*172,q=new DOMPoint(x,36*(x/86)**2).matrixTransform(matrix);return Math.hypot(q.x-p.x,q.y-p.y)}));
 const m=w._live2d,v=m.internalModel.getDrawableVertices(m.internalModel.coreModel.getDrawableIndex('ArtMesh102'));
 let bottom=-Infinity,x=0,y=0,count=0;for(let n=1;n<v.length;n+=2)bottom=Math.max(bottom,v[n]);
 for(let n=0;n<v.length;n+=2)if(v[n+1]>=bottom-m.internalModel.originalHeight*.018){x+=v[n];y+=v[n+1];count++}
 const p=m.toGlobal(m.internalModel.localTransform.apply(new PIXI.Point(x/count,y/count))),b=w.getBoundingClientRect();
 return {curve,hand:Math.hypot(p.x+b.x-s.grip.x,p.y+b.y-s.grip.y)};
}'''
dry = '''()=>{const c=document.querySelector('.weather-field'),v=c._viewport,r=document.querySelector('.home-console').getBoundingClientRect();
const x=Math.ceil((r.x+22-v.x)*v.sx),y=Math.ceil((Math.max(v.y,r.y+25)-v.y)*v.sy),w=Math.floor((r.width-44)*v.sx),h=Math.floor((Math.min(v.y+v.height,r.bottom-25)-Math.max(v.y,r.y+25))*v.sy);
if(h<1)return false;const d=c.getContext('2d').getImageData(x,y,w,h).data;return !d.some((n,i)=>i%4===3&&n>0)}'''

def weather(page, mode):
    page.locator('[data-weather-mode="' + mode + '"]').evaluate('e=>e.click()')

try:
    with sync_playwright() as p:
        launch = {'headless': True, 'args': ['--enable-unsafe-swiftshader']}
        if os.environ.get('BROWSER_PATH'): launch['executable_path'] = os.environ['BROWSER_PATH']
        browser = p.chromium.launch(**launch)
        for width, height, dpr in [(1440, 1000, 1), (1440, 1000, 2), (390, 844, 3)]:
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dpr, reduced_motion='no-preference')
            for host in ['wttr.in', 'api.github.com', 'v1.hitokoto.cn']:
                context.route('https://' + host + '/**', lambda r: r.abort())
            context.add_init_script(instrument)
            page = context.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.clock.install()
            page.goto(base, wait_until='networkidle')
            page.wait_for_selector('.live2d-widget[data-ready=true]', timeout=45000)
            page.clock.run_for(1000)
            for gutter in ['stable', 'stable both-edges']:
                page.add_style_tag(content='html{scrollbar-gutter:' + gutter + '}')
                page.locator('.home-console').scroll_into_view_if_needed()
                page.clock.run_for(600)
                tag = f'{width}@{dpr} {gutter}'
                check(tag + ' actual canvas mapping', page.evaluate(mapping))
                result = page.evaluate(canopy)
                check(tag + ' canopy collision matches drawn SVG', result['curve'] < .1)
                check(tag + ' handle follows current hand mesh', result['hand'] < .1)
                check(tag + ' rain stays outside console', page.evaluate(dry))
            if dpr == 1:
                page.clock.run_for(13000)
                check('Actual rain reaches umbrella and drains from eaves', page.locator('.weather-field').evaluate('c=>Number(c.dataset.umbrellaHits)>0&&Number(c.dataset.umbrellaRunoffs)>0'))
                shot(page, 'umbrella-rain-aligned')
                weather(page, 'snow'); page.clock.run_for(6000)
                check('Snow stays outside console with two gutters', page.evaluate(dry))
                check('Snow grows on umbrella', page.locator('.live2d-widget').evaluate('w=>w._weatherShelter.snow>0'))
                shot(page, 'umbrella-snow-aligned')
                weather(page, 'hail'); page.clock.run_for(300)
                result = page.evaluate('''()=>{const s=document.querySelector('.live2d-widget')._weatherShelter,p=s.curve[8],ball={x:p.x,y:p.y+10,size:2,speed:500,bounce:0};testSurface.measure();return {hit:testSurface.collide(ball,p.x,p.y-10),speed:ball.speed,bounce:ball.bounce}}''')
                check('Hail rebounds upward from actual canopy', result['hit'] and result['speed'] < 0 and result['bounce'] == 2)
                weather(page, 'rain'); page.clock.run_for(1000)
                page.evaluate('geometryReads=0'); page.clock.run_for(2000)
                reads = page.evaluate('geometryReads')
                print('Settled 2s geometry reads:', reads, flush=True)
                check('Weather does not measure DOM every frame', reads < 15)
            page.locator('[data-live2d-size]').first.evaluate('e=>e.click()')
            page.locator('[data-size-max]').click(); page.keyboard.press('Escape'); page.clock.run_for(200)
            result = page.evaluate(canopy)
            print('MAX geometry:', width, dpr, result, flush=True)
            check(f'{width}@{dpr} MAX canopy and hand alignment', result['curve'] < .1 and result['hand'] < .1)
            check(f'{width}@{dpr} MAX does not overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            page.locator('.main-nav a[href="/articles/"]').evaluate('e=>e.click()')
            page.wait_for_function('document.body.dataset.page==="articles"'); page.clock.run_for(500)
            check(f'{width}@{dpr} canopy survives SPA', page.evaluate(canopy)['curve'] < .1)
            page.go_back(); page.wait_for_selector('.home-console'); page.clock.run_for(600)
            page.locator('[data-live2d-size]').first.evaluate('e=>e.click()')
            page.locator('[data-size-reset]').click(); page.keyboard.press('Escape')
            if dpr != 1:
                context.close(); continue

            # Execute the real simulated command, then inspect lifecycle and angry reaction.
            page.locator('.home-console').hover()
            field = page.locator('.terminal-input'); field.fill('rm -rf /*'); field.press('Enter')
            page.clock.run_for(350)
            check('Command triggers one explosion and angry dragon', page.locator('.catastrophe-canvas').count() == 1 and page.locator('.live2d-widget').get_attribute('data-reaction') == 'angry')
            check('Explosion canvas aligns with gutters', page.evaluate(mapping))
            check('Anger temporarily folds umbrella', page.locator('.dragon-umbrella').is_hidden())
            shot(page, 'explosion-flash')
            page.clock.run_for(650); check('Explosion has shockwave phase', page.locator('.catastrophe-canvas').get_attribute('data-phase') == 'shockwave'); shot(page, 'explosion-shockwave')
            page.clock.run_for(1600); check('Explosion develops a cloud', page.locator('.catastrophe-canvas').get_attribute('data-phase') == 'cloud'); shot(page, 'explosion-cloud')
            page.evaluate('document.dispatchEvent(new Event("terminal-catastrophe"))')
            check('Repeated triggers do not stack canvases', page.locator('.catastrophe-canvas').count() == 1)
            page.clock.run_for(2300); shot(page, 'explosion-embers')
            page.clock.run_for(2200)
            check('Explosion cleans canvas and shaking', page.locator('.catastrophe-canvas').count() == 0 and not page.locator('html').evaluate('e=>e.classList.contains("catastrophe-active")'))
            field.fill('echo alive'); field.press('Enter')
            check('Site and shell remain usable', 'alive' in page.locator('[data-linux-lines]').inner_text() and page.locator('.home-intro').count() == 1)
            page.emulate_media(reduced_motion='reduce'); page.evaluate('document.dispatchEvent(new Event("terminal-catastrophe"))')
            check('Reduced motion uses a still tint', page.locator('.catastrophe-canvas').get_attribute('data-phase') == 'still' and not page.locator('html').evaluate('e=>e.classList.contains("catastrophe-active")'))
            page.clock.run_for(1200); check('Reduced effect cleans up', page.locator('.catastrophe-canvas').count() == 0)
            page.emulate_media(reduced_motion='no-preference')
            page.wait_for_function('document.documentElement.dataset.weatherActive==="true"')
            page.clock.run_for(6500)
            check('Umbrella returns after anger', page.locator('.dragon-umbrella').is_visible())

            # Observe actual meteor draw calls; stop unrelated weather/model work during this sample.
            weather(page, 'off'); page.locator('[data-live2d-toggle]').evaluate('e=>e.click()')
            page.evaluate('''()=>{window.passes=[];const c=document.querySelector('.ambient-field'),ctx=c.getContext('2d'),gradient=ctx.createLinearGradient;ctx.createLinearGradient=function(x0,y0,x1,y1){const n=c.dataset.meteorPasses;if(Math.hypot(x1-x0,y1-y0)>5&&(!passes.length||passes[passes.length-1].n!==n))passes.push({n,t:performance.now(),x:x1,y:y1,angle:Math.atan2(y1-y0,x1-x0)});return gradient.apply(this,arguments)}}''')
            page.clock.run_for(90000)
            passes = page.evaluate('passes')
            intervals = [b['t'] - a['t'] for a, b in zip(passes[1:], passes[2:])]
            print('Meteor passes:', json.dumps(passes), flush=True)
            check('Meteors appear at irregular intervals', len(intervals) >= 3 and max(intervals) - min(intervals) > 500)
            check('Meteors vary starting position and angle', len({round(n['x']) for n in passes}) > 3 and len({round(n['angle'], 2) for n in passes}) > 3)
            # Wait until the next meteor is bright enough for a visual inspection.
            count = page.locator('.ambient-field').get_attribute('data-meteor-passes')
            for _ in range(95):
                page.clock.run_for(200)
                if page.locator('.ambient-field').get_attribute('data-meteor-passes') != count: break
            page.clock.run_for(300); shot(page, 'meteor-random-pass')
            page.emulate_media(reduced_motion='reduce')
            before = page.locator('.ambient-field').get_attribute('data-frames'); page.clock.run_for(1000)
            check('Reduced motion suspends meteor drawing', before == page.locator('.ambient-field').get_attribute('data-frames'))
            context.close()
        browser.close()
finally:
    server.shutdown(); server.server_close()
check('No browser exceptions', not errors)
print(json.dumps({'passed': sum(c['passed'] for c in checks), 'total': len(checks), 'errors': errors}), flush=True)
assert all(c['passed'] for c in checks)
