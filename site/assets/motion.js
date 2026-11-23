/* One pointer spring drives the cursor, magnetic controls, and the wallpaper. */
(() => {
  'use strict';
  const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  if(!fine.matches||reduced.matches)return;
  const ring=document.createElement('div');
  ring.className='cursor-ring';ring.setAttribute('aria-hidden','true');document.body.append(ring);
  root.classList.add('has-custom-cursor');
  let x=innerWidth/2,y=innerHeight/2,rx=x-16,ry=y-16,rw=32,rh=32,rr=16,sceneX=0,sceneY=0,frame=0,previous=0,target=null,visible=false,pressed=false,overInput=false;
  const wallpaper=document.querySelector('.wallpaper');
  let magnets=[],geometryDirty=true,targetBox=null,targetRadius=7,previousTarget=null;
  function invalidate(){geometryDirty=true;wake();}
  const geometryObserver=new ResizeObserver(invalidate);
  function collect(){geometryObserver.disconnect();magnets=Array.from(document.querySelectorAll('.button,.nav-actions>.icon-button,.home-social>a'));magnets.forEach(el=>{el.dataset.magnet='';geometryObserver.observe(el);});target=null;previousTarget=null;geometryDirty=true;wake();}
  collect();addEventListener('site-page',collect);
  const selector='a,button,[data-cursor]';
  function wake(){if(!frame&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);}
  function tick(now){
    frame=0;const dt=previous?Math.min(8,(now-previous)/16.67):1;previous=now;
    const lerp=(a,b,s)=>a+(b-a)*(1-Math.pow(1-s,dt));
    const modal=document.querySelector('dialog[open]');
    const hide=!!modal||overInput||!visible;
    // Measure together before writing any style. Moving springs reuse their base boxes.
    if(geometryDirty){for(const el of magnets){const r=el.getBoundingClientRect();el._box={x:r.x-(el._mx||0),y:r.y-(el._my||0),width:r.width,height:r.height,bottom:r.bottom};}}
    if(target&&target.isConnected&&(geometryDirty||target!==previousTarget)){targetBox=target._box||target.getBoundingClientRect();targetRadius=parseFloat(getComputedStyle(target).borderTopLeftRadius)||7;}
    previousTarget=target;geometryDirty=false;
    root.classList.toggle('cursor-native',!!modal||overInput);
    root.classList.toggle('cursor-hidden',hide);root.classList.toggle('cursor-visible',visible);
    let tx=x-16,ty=y-16,tw=pressed?24:32,th=tw,tr=tw/2;
    if(target&&target.isConnected&&!hide&&targetBox){const r=targetBox;tx=r.x+(target._mx||0)-4;ty=r.y+(target._my||0)-4;tw=r.width+8;th=r.height+8;tr=Math.min(targetRadius+4,th/2);}
    ring.classList.toggle('is-hover',!!target&&!hide);const spring=target?.2:.13;
    rx=lerp(rx,tx,spring);ry=lerp(ry,ty,spring);rw=lerp(rw,tw,.2);rh=lerp(rh,th,.2);rr=lerp(rr,tr,.2);
    ring.style.transform='translate3d('+rx+'px,'+ry+'px,0)';ring.style.width=rw+'px';ring.style.height=rh+'px';ring.style.borderRadius=rr+'px';
    let magneticMoving=false;
    magnets.forEach(el=>{
      const r=el._box;if(!r||r.bottom<0||r.y>innerHeight)return;
      const ox=el._mx||0,oy=el._my||0,cx=r.x+r.width/2,cy=r.y+r.height/2;
      const vx=x-cx,vy=y-cy,card=el.matches('.home-entry,.home-project'),radius=card?60:48;
      const outside=Math.hypot(Math.max(0,Math.abs(vx)-r.width/2),Math.max(0,Math.abs(vy)-r.height/2));
      const amount=visible&&!hide&&outside<radius?(1-outside/radius)*(card?.035:.12):0;
      const mx=Math.max(-9,Math.min(9,vx*amount)),my=Math.max(-6,Math.min(6,vy*amount));
      el._mx=lerp(ox,mx,.18);el._my=lerp(oy,my,.18);
      if(Math.abs(ox-el._mx)+Math.abs(oy-el._my)>.015)magneticMoving=true;
      const translation=el._mx.toFixed(2)+'px '+el._my.toFixed(2)+'px';if(el.style.translate!==translation)el.style.translate=translation;
    });
    const home=document.body.dataset.page==='home';
    const sx=visible?(x/innerWidth-.5)*(home?-28:-10):0;
    const sy=(visible?(y/innerHeight-.5)*(home?-20:-8):0)+Math.min(scrollY,700)*(home?.015:.004);
    sceneX=lerp(sceneX,sx,.045);sceneY=lerp(sceneY,sy,.045);
    if(wallpaper)wallpaper.style.transform='translate3d('+sceneX.toFixed(3)+'px,'+sceneY.toFixed(3)+'px,0) scale(1.045)';
    const unsettled=Math.abs(rx-tx)+Math.abs(ry-ty)+Math.abs(rw-tw)+Math.abs(rh-th)+Math.abs(sceneX-sx)+Math.abs(sceneY-sy);
    if(unsettled>.08||magneticMoving)wake();
  }
  addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;x=e.clientX;y=e.clientY;visible=true;overInput=!!e.target.closest('input,textarea,[contenteditable],.home-console');target=e.target.closest(selector);if(target&&target.closest('dialog'))target=null;wake();},{passive:true});
  addEventListener('pointerdown',()=>{pressed=true;wake();},{passive:true});addEventListener('pointerup',()=>{pressed=false;wake();},{passive:true});
  document.addEventListener('pointerleave',()=>{visible=false;target=null;wake();});addEventListener('blur',()=>{visible=false;wake();});
  addEventListener('scroll',invalidate,{passive:true});addEventListener('resize',invalidate);document.addEventListener('focusin',wake);document.addEventListener('focusout',wake);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;previous=0;}else invalidate();});
  document.addEventListener('transitionend',e=>{if(e.target.closest('.site-header'))invalidate();});
  if(document.fonts)document.fonts.ready.then(invalidate);
  new MutationObserver(wake).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  reduced.addEventListener('change',()=>{if(reduced.matches){root.classList.remove('has-custom-cursor','cursor-visible');cancelAnimationFrame(frame);frame=0;magnets.forEach(el=>el.style.removeProperty('translate'));if(wallpaper)wallpaper.style.transform='';}else{root.classList.add('has-custom-cursor');invalidate();}});
  wake();
})();
