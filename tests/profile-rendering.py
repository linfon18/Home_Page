"""Build first. Optional arguments: label and dist directory. Emits JSON to stdout."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from collections import Counter
from playwright.sync_api import sync_playwright
import json,sys,time,os

root=Path(__file__).resolve().parents[1]
label=sys.argv[1] if len(sys.argv)>1 else 'local'
folder=Path(sys.argv[2]) if len(sys.argv)>2 else root/'dist'
class H(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(H,directory=str(folder)))
Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path':os.environ['BROWSER_PATH']} if os.environ.get('BROWSER_PATH') else {}))
  for name,weather,hidden,moving in [('idle','clear',False,False),('pointer','clear',False,True),('rain','rain',False,False),('no-model','clear',True,False)]:
   ctx=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=2,reduced_motion='no-preference')
   for host in ['api.github.com','v1.hitokoto.cn','wttr.in']:ctx.route('https://'+host+'/**',lambda r:r.abort())
   ctx.add_init_script('localStorage.setItem("linfon-weather-v1",JSON.stringify({mode:'+json.dumps(weather)+',city:""}));localStorage.setItem("linfon-live2d",'+json.dumps('hidden' if hidden else 'visible')+');localStorage.setItem("linfon-theme","dark");')
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='networkidle')
   if not hidden:page.wait_for_selector('.live2d-widget[data-ready=true]',timeout=45000)
   page.wait_for_timeout(1500)
   page.evaluate('''()=>{window.__calls={renders:0,updates:0,rects:0,styles:0};const w=document.querySelector('.live2d-widget');if(w){const a=w._app,render=a.renderer.render.bind(a.renderer),update=w._live2d.update.bind(w._live2d);a.renderer.render=(...v)=>{__calls.renders++;return render(...v)};w._live2d.update=(...v)=>{__calls.updates++;return update(...v)}}const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){__calls.rects++;return rect.call(this)};const style=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(...v){__calls.styles++;return style.apply(this,v)}}''')
   cdp=ctx.new_cdp_session(page);cdp.send('Performance.enable');cdp.send('Profiler.enable');cdp.send('Profiler.start')
   def metrics():return {m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
   a=metrics();start=time.monotonic()
   if moving:
    for i in range(90):
     page.mouse.move(180+(i%30)*28,180+(i%23)*15);page.wait_for_timeout(65)
   else:page.wait_for_timeout(6000)
   elapsed=time.monotonic()-start;b=metrics();profile=cdp.send('Profiler.stop')['profile']
   nodes={n['id']:n for n in profile['nodes']};samples=Counter(profile.get('samples',[]));top=[]
   for n,count in samples.most_common(18):
    call=nodes[n]['callFrame'];top.append({'function':call['functionName'],'url':call['url'].split('/')[-1],'line':call['lineNumber'],'samples':count})
   info=page.evaluate('''()=>{const w=document.querySelector('.live2d-widget'),g=w&&w._app.renderer.gl,d=g&&g.getExtension('WEBGL_debug_renderer_info');return {calls:__calls,renderer:d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):null,live2d:w?{width:w.querySelector('canvas').width,height:w.querySelector('canvas').height,maxFPS:w._app.ticker.maxFPS,mask:w.dataset.maskSize}:null,ambient:Number(document.querySelector('.ambient-field').dataset.frames),weather:Number(document.querySelector('.weather-field').dataset.frames)||0}}''')
   item={'case':name,'seconds':elapsed,'metrics':{k:round(b[k]-a[k],6) for k in ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount']},'top':top,'info':info,'errors':errors};results.append(item)
   print(json.dumps({k:item[k] for k in ['case','seconds','metrics','info','errors']}),flush=True);ctx.close()
  browser.close()
finally:server.shutdown();server.server_close()
print(json.dumps({'label':label,'results':results},indent=2))
