"""Build dist first. Requires Python and Playwright; BROWSER_PATH is optional."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json,os
root=Path(__file__).resolve().parents[1];checks=[];errors=[]
def check(name,ok):
 checks.append({'check':name,'passed':bool(ok)});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
class H(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(H,directory=str(root/'dist')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path':os.environ['BROWSER_PATH']} if os.environ.get('BROWSER_PATH') else {}))
  for width,height,dpr in [(1440,1000,2),(390,844,3)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,is_mobile=width<500,has_touch=width<500,reduced_motion='no-preference')
   for host in ['api.github.com','v1.hitokoto.cn','wttr.in']:ctx.route('https://'+host+'/**',lambda r:r.abort())
   ctx.add_init_script('localStorage.setItem("linfon-weather-v1",JSON.stringify({mode:"rain",city:""}))')
   page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='networkidle');page.wait_for_selector('.live2d-widget[data-ready=true]',timeout=45000)
   page.wait_for_timeout(1200)
   for size in ['default','max']:
    if size=='max':
     page.locator('[data-live2d-size]').first.evaluate('e=>e.click()');page.locator('[data-size-max]').click();page.keyboard.press('Escape');page.wait_for_timeout(200)
    result=page.evaluate('''()=>{const w=document.querySelector('.live2d-widget'),a=w._app,c=w._renderCache,g=a.renderer.gl;if(!c)return {missing:true};a.stop();const pixels=()=>{a.renderer.render(a.stage);const out=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,out);return out};c.enabled=false;const original=pixels();c.enabled=true;const cached=pixels();let different=0,visible=0;for(let i=0;i<original.length;i++){if(original[i]!==cached[i])different++;if(i%4===3&&original[i]>0)visible++;}const stats={...c.stats};a.start();return {different,visible,stats,width:g.drawingBufferWidth,height:g.drawingBufferHeight,mask:w.dataset.maskSize,maxFPS:a.ticker.maxFPS}}''')
    print(json.dumps({'width':width,'size':size,'parity':result}),flush=True)
    check(str(width)+' '+size+' cached geometry renders identical pixels',not result.get('missing') and result['different']==0 and result['visible']>500)
    check(str(width)+' '+size+' immutable uploads skipped',result.get('stats',{}).get('savedBytes',0)>100000)
    check(str(width)+' '+size+' frame limit retained',result.get('maxFPS')==(30 if width<500 else 36))
    check(str(width)+' '+size+' no screen overflow',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
   # Same geometry cache survives a recoverable GPU context loss.
   page.evaluate('''()=>{const g=document.querySelector('.live2d-widget')._app.renderer.gl;window.restoreContext=g.getExtension('WEBGL_lose_context');restoreContext.loseContext();setTimeout(()=>{if(g.isContextLost())restoreContext.restoreContext()},150)}''')
   page.wait_for_timeout(1500)
   check(str(width)+' GPU context restores',page.evaluate('''()=>{const w=document.querySelector('.live2d-widget'),a=w._app,g=a.renderer.gl;a.renderer.render(a.stage);return !g.isContextLost()&&g.getError()===g.NO_ERROR}'''))
   page.locator('[data-live2d-size]').first.evaluate('e=>e.click()');page.locator('[data-size-reset]').click();page.keyboard.press('Escape')
   check(str(width)+' resolution still follows native density',page.locator('.live2d-widget').evaluate('(e)=>Math.abs(e.querySelector("canvas").width/e.clientWidth-devicePixelRatio)<.03'))
   if width>500:
    page.locator('.home-console').hover();page.wait_for_timeout(200)
    before=page.locator('[data-linux-lines]').text_content();page.wait_for_timeout(700);check('Hovered terminal stops automatic typing',before==page.locator('[data-linux-lines]').text_content())
    page.mouse.move(30,100);page.wait_for_timeout(5500);check('Automatic typing resumes without polling wait',before!=page.locator('[data-linux-lines]').text_content())
    page.set_viewport_size({'width':1440,'height':600});page.evaluate('scrollTo({top:document.body.scrollHeight,behavior:"instant"})');page.wait_for_timeout(300);before=page.locator('[data-linux-lines]').text_content();page.wait_for_timeout(600);check('Offscreen terminal does no invisible typing',page.locator('[data-linux-screen]').evaluate('e=>e.getBoundingClientRect().bottom<0') and before==page.locator('[data-linux-lines]').text_content())
   ctx.close()
  browser.close()
finally:server.shutdown();server.server_close()
check('No runtime exceptions',not errors)
report={'passed':sum(c['passed'] for c in checks),'total':len(checks),'checks':checks,'errors':errors}
print(json.dumps({'passed':report['passed'],'total':report['total'],'errors':errors}));assert report['passed']==report['total']
