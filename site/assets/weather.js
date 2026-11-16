/* Current conditions from wttr.in; visual preferences live only in this browser. */
(() => {
  'use strict';
  const root=document.querySelector('[data-weather]');if(!root)return;
  const modes={auto:'自动天气',rain:'下雨',snow:'大雪',fog:'雾霾',hail:'冰雹',clear:'晴天',off:'关闭'};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-width: 767px), (pointer: coarse)');
  const status=root.querySelector('[data-weather-status]'),message=root.querySelector('[data-weather-message]'),cityInput=root.querySelector('[data-weather-city]'),form=root.querySelector('form'),refresh=root.querySelector('[data-weather-refresh]');
  const canvas=document.createElement('canvas');canvas.className='weather-field';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;document.body.prepend(canvas);
  const ctx=canvas.getContext('2d'),key='linfon-weather-v1',cacheKey=key+'-cache',period=20*60*1000,maxAge=2*60*60*1000;
  const surfaces=window.createWeatherSurfaces(canvas,compact);
  let mode='auto',city='',weather=null,error='',pending=false,controller=null,requestId=0,refreshTimer=0,frame=0,last=0,time=0,width=0,height=0,particles=[],effect='clear',dark=false,disposed=false,viewport=null;
  const rand=(a,b)=>a+Math.random()*(b-a);
  try{const pref=JSON.parse(localStorage.getItem(key));if(pref&&Object.prototype.hasOwnProperty.call(modes,pref.mode)){mode=pref.mode;city=String(pref.city||'').slice(0,80);}}catch(_){}
  cityInput.value=city;
  function classify(code,description){
    // WWO condition codes used by wttr.in (not forecast probabilities).
    if(/hail|ice pellets|冰雹|冰粒/i.test(description)||[350,374,377].includes(code))return 'hail';
    if(/snow|blizzard|雪/i.test(description)||[179,182,185,227,230,317,320,323,326,329,332,335,338,362,365,368,371,392,395].includes(code))return 'snow';
    if(/fog|mist|haze|smog|雾|霾/i.test(description)||[143,248,260].includes(code))return 'fog';
    if(/rain|drizzle|雨/i.test(description)||[176,200,263,266,281,284,293,296,299,302,305,308,311,314,353,356,359,386,389].includes(code))return 'rain';
    return 'clear';
  }
  function parse(data){
    const condition=data.current_condition&&data.current_condition[0],area=data.nearest_area&&data.nearest_area[0];
    if(!condition||!/^\d+$/.test(String(condition.weatherCode))||!Number.isFinite(Number(condition.temp_C)))throw new Error('invalid weather');
    const description=String((condition.lang_zh&&condition.lang_zh[0]||condition.weatherDesc&&condition.weatherDesc[0]||{}).value||'');
    return {code:Number(condition.weatherCode),description:description.slice(0,100),temperature:Number(condition.temp_C),place:String((area&&area.areaName&&area.areaName[0]||{}).value||city||'当前位置').slice(0,80),observed:String(condition.localObsDateTime||condition.observation_time||'').slice(0,60),at:Date.now(),city};
  }
  function cached(){try{const value=JSON.parse(localStorage.getItem(cacheKey));if(value&&value.city===city&&Number.isFinite(value.at)&&Date.now()-value.at>=0&&Date.now()-value.at<maxAge&&Number.isFinite(value.code)&&Number.isFinite(value.temperature))return value;}catch(_){}return null;}
  function save(){try{localStorage.setItem(key,JSON.stringify({mode,city}));}catch(_){} }
  function cancelRequest(){requestId++;if(controller)controller.abort();controller=null;pending=false;clearTimeout(refreshTimer);refreshTimer=0;}
  function label(){
    root.querySelectorAll('[data-weather-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weatherMode===mode)));
    cityInput.disabled=mode!=='auto';refresh.disabled=mode!=='auto'||pending;
    if(mode==='off')status.textContent='天气 · 已关闭';
    else if(mode!=='auto')status.textContent='天气 · '+modes[mode];
    else if(weather){const stamp=new Date(weather.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});status.textContent=weather.place+' · '+weather.temperature+'°C · '+weather.description;message.textContent=(pending?'正在更新 · ':error?'更新失败，显示缓存 · ':'')+stamp+' 获取'+(weather.observed?' · 观测 '+weather.observed:'');}
    else status.textContent=pending?'天气 · 正在获取':'天气 · 暂不可用';
    if(mode!=='auto')message.textContent=mode==='off'?'':mode==='clear'?'晴天，不显示降水效果。':'手动选择 · '+modes[mode];
    else if(!weather)message.textContent=pending?'':error?'天气暂时无法获取，可稍后重试或手动选择。':'';
    if(reduced.matches&&mode!=='off')message.textContent+=(message.textContent?' · ':'')+'已随系统减少动态效果';
  }
  function changeEffect(){
    const next=mode==='auto'?(weather&&Date.now()-weather.at<maxAge?classify(weather.code,weather.description):'clear'):mode;
    if(next!==effect){effect=next;seed();}
    canvas.dataset.weatherEffect=effect;label();state();
  }
  async function update(force=false){
    if(mode!=='auto'||disposed||document.hidden)return;
    cancelRequest();const id=requestId;
    if(!weather)weather=cached();
    if(!force&&weather&&Date.now()-weather.at<period){changeEffect();schedule(period-(Date.now()-weather.at));return;}
    pending=true;error='';controller=new AbortController();const active=controller,timeout=setTimeout(()=>active.abort(),12000);label();
    try{
      const response=await fetch('https://wttr.in/'+(city?encodeURIComponent(city):'')+'?format=j1&lang=zh',{signal:active.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('HTTP '+response.status);const result=parse(await response.json());
      if(id!==requestId||mode!=='auto'||disposed)return;weather=result;try{localStorage.setItem(cacheKey,JSON.stringify(result));}catch(_){}
    }catch(e){if(id!==requestId||mode!=='auto'||disposed)return;error='unavailable';if(weather&&Date.now()-weather.at>=maxAge)weather=null;}
    finally{clearTimeout(timeout);if(id===requestId){controller=null;pending=false;changeEffect();schedule(error?5*60*1000:period);}}
  }
  function schedule(delay){clearTimeout(refreshTimer);if(mode==='auto'&&!document.hidden&&!disposed)refreshTimer=setTimeout(()=>update(),Math.max(1000,delay));}
  function choose(next){if(!Object.prototype.hasOwnProperty.call(modes,next))return;cancelRequest();mode=next;save();changeEffect();if(mode==='auto')update();}
  root.addEventListener('click',e=>{const button=e.target.closest('[data-weather-mode]');if(button)choose(button.dataset.weatherMode);if(e.target.closest('[data-weather-refresh]'))update(true);});
  form.addEventListener('submit',e=>{e.preventDefault();const value=cityInput.value.trim().slice(0,80);if(value!==city){cancelRequest();city=value;cityInput.value=city;weather=null;error='';}mode='auto';save();changeEffect();update(true);});
  function seed(){particles=Array.from({length:effect==='fog'?8:compact.matches?(effect==='snow'?75:80):(effect==='snow'?160:150)},()=>({x:rand(-60,width+60),y:rand(-height,height),size:rand(.7,3.2),speed:effect==='hail'?rand(430,760):rand(.6,1.4),phase:rand(0,Math.PI*2),vx:rand(-20,20),bounce:0}));}
  function resize(){width=innerWidth;height=innerHeight;seed();surfaces.invalidate();state();}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  function wake(){if(!frame&&ctx&&!canvas.hidden&&!disposed)frame=requestAnimationFrame(draw);}
  function state(){
    dark=document.documentElement.dataset.theme==='dark';const hidden=disposed||mode==='off'||effect==='clear'||reduced.matches||document.hidden||!!document.querySelector('dialog[open]');canvas.hidden=hidden;
    surfaces.set(effect,hidden);
    if(hidden){stop();if(ctx)ctx.clearRect(0,0,width,height);}else{if(viewport)viewport.sync();wake();}
  }
  function draw(now){
    frame=0;if(canvas.hidden||disposed)return;const interval=compact.matches?42:32;if(last&&now-last<interval){wake();return;}
    const dt=last?Math.min((now-last)/1000,.06):0;last=now;time+=dt;ctx.clearRect(0,0,width,height);
    const color=dark?'186,211,238':'42,79,119';surfaces.measure();
    ctx.save();if(effect==='rain'||effect==='snow'||effect==='hail')surfaces.clip(ctx);
    if(effect==='fog'){
      for(const p of particles){p.x+=dt*p.speed*9;if(p.x>width*1.6)p.x=-width*.6;const x=p.x+Math.sin(time*.15+p.phase)*50,y=(p.phase/6.29)*height,r=Math.max(width*.38,200);const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,dark?'rgba(176,191,208,.08)':'rgba(126,144,164,.075)');g.addColorStop(1,'rgba(140,160,180,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    }else for(const p of particles){
      const oldX=p.x,oldY=p.y;
      if(effect==='rain'){p.x-=dt*90*p.speed;p.y+=dt*720*p.speed;if(surfaces.collide(p,oldX,oldY)){p.y=rand(-90,-10);p.x=rand(0,width);continue;}ctx.strokeStyle='rgba('+color+',.30)';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+3,p.y-16*p.speed);ctx.stroke();}
      else if(effect==='snow'){p.x+=dt*(Math.sin(time*.6+p.phase)*22+p.vx*.3);p.y+=dt*48*p.speed;if(surfaces.collide(p,oldX,oldY)){p.y=rand(-90,-10);p.x=rand(0,width);continue;}ctx.fillStyle=dark?'rgba(236,245,255,.7)':'rgba(250,253,255,.88)';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
      else if(effect==='hail'){p.x+=dt*(p.bounce?p.vx*4:-65);p.y+=dt*p.speed;if(surfaces.collide(p,oldX,oldY))continue;if(!p.bounce&&p.y>=height-6){p.y=height-6;p.speed=-rand(100,210);p.bounce=1;}if(p.bounce)p.speed+=dt*850;ctx.fillStyle=dark?'rgba(216,235,255,.7)':'rgba(213,231,248,.85)';ctx.strokeStyle='rgba('+color+',.35)';ctx.lineWidth=.65;ctx.beginPath();ctx.arc(p.x,p.y,p.size*.85+.6,0,Math.PI*2);ctx.fill();ctx.stroke();}
      if(p.y>height+25||p.x< -70||p.x>width+70){p.y=rand(-90,-10);p.x=rand(0,width);p.bounce=0;p.speed=effect==='hail'?rand(430,760):rand(.6,1.4);}
    }
    ctx.restore();surfaces.draw(ctx,dt,time,dark);
    canvas.dataset.frames=String((Number(canvas.dataset.frames)||0)+1);wake();
  }
  addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelRequest();state();}else{if(mode==='auto')update();state();}});
  addEventListener('pagehide',()=>{disposed=true;cancelRequest();state();});addEventListener('pageshow',e=>{if(e.persisted){disposed=false;state();if(mode==='auto')update();}});
  reduced.addEventListener('change',()=>{label();state();});new MutationObserver(state).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});new MutationObserver(state).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  viewport=window.trackViewportCanvas(canvas,ctx,1.5,resize);resize();changeEffect();if(mode==='auto')update();
})();
