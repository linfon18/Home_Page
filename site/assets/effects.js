/* A shared night-sky layer and small motion cues; page content stays native DOM. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-width: 767px), (pointer: coarse)');
  const canvas=document.createElement('canvas');canvas.className='ambient-field';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
  const ctx=canvas.getContext('2d');
  let frame=0,last=0,time=0,width=0,height=0,dark=false,stars=[],bursts=[],pointer={x:-1000,y:-1000};
  const rand=(a,b)=>a+Math.random()*(b-a);
  function resize(){
    width=innerWidth;height=innerHeight;const ratio=Math.min(devicePixelRatio||1,1.25);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    if(ctx)ctx.setTransform(ratio,0,0,ratio,0,0);
    stars=Array.from({length:compact.matches?26:62},()=>({x:rand(0,width),y:rand(0,height),r:rand(.65,1.7),speed:rand(3,11),phase:rand(0,Math.PI*2)}));
  }
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  function wake(){if(ctx&&!frame&&!document.hidden&&!reduced.matches&&!document.querySelector('dialog[open]'))frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;if(document.hidden||reduced.matches||document.querySelector('dialog[open]')){last=0;return;}
    const interval=compact.matches?55:36;if(last&&now-last<interval){wake();return;}
    const dt=last?Math.min((now-last)/1000,.1):0;last=now;time+=dt;
    ctx.clearRect(0,0,width,height);const color=dark?'157,200,255':'37,92,153',alpha=dark?.64:.42;
    for(const star of stars){
      star.y-=star.speed*dt;star.x+=Math.sin(time*.2+star.phase)*dt*1.8;if(star.y< -10)star.y=height+10;
      const glow=.55+.45*Math.sin(time*.9+star.phase);ctx.fillStyle='rgba('+color+','+(alpha*(.38+glow*.62))+')';ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();
      if(!compact.matches){
        const dx=star.x-pointer.x,dy=star.y-pointer.y,distance2=dx*dx+dy*dy;
        if(distance2<27225){const distance=Math.sqrt(distance2);ctx.strokeStyle='rgba('+color+','+(.26*(1-distance/165))+')';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(star.x,star.y);ctx.lineTo(pointer.x,pointer.y);ctx.stroke();}
      }
    }
    for(let n=0;n<stars.length;n++)for(let k=n+1;k<stars.length;k++){
      const a=stars[n],b=stars[k],dx=a.x-b.x,dy=a.y-b.y,distance2=dx*dx+dy*dy;
      if(distance2<9025){const distance=Math.sqrt(distance2);ctx.strokeStyle='rgba('+color+','+(.11*(1-distance/95))+')';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    }
    // A short shooting arc passes through an empty edge of the sky.
    const phase=time%13;if(phase<1.8){const p=phase/1.8,x=width*(.15+p*.55),y=height*.07+p*height*.22;const gradient=ctx.createLinearGradient(x-95,y-30,x,y);gradient.addColorStop(0,'rgba('+color+',0)');gradient.addColorStop(1,'rgba('+color+','+(Math.sin(p*Math.PI)*.65)+')');ctx.strokeStyle=gradient;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-95,y-30);ctx.lineTo(x,y);ctx.stroke();}
    bursts=bursts.filter(b=>time-b.start<1);
    for(const b of bursts){const p=time-b.start;ctx.strokeStyle='rgba('+color+','+((1-p)*.65)+')';ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.x,b.y,6+p*105,0,Math.PI*2);ctx.stroke();for(let k=0;k<8;k++){const angle=k*Math.PI/4;ctx.fillStyle='rgba('+color+','+((1-p)*.8)+')';ctx.fillRect(b.x+Math.cos(angle)*p*72,b.y+Math.sin(angle)*p*72,2,2);}}
    canvas.dataset.frames=String((Number(canvas.dataset.frames)||0)+1);wake();
  }
  function state(){dark=document.documentElement.dataset.theme==='dark';canvas.hidden=reduced.matches;if(reduced.matches){stop();bursts=[];if(ctx)ctx.clearRect(0,0,width,height);}else wake();}
  addEventListener('resize',()=>{resize();wake();});addEventListener('pointermove',e=>{if(e.pointerType!=='touch')pointer={x:e.clientX,y:e.clientY};},{passive:true});
  document.addEventListener('pointerleave',()=>{pointer={x:-1000,y:-1000};});
  document.addEventListener('click',e=>{if(reduced.matches||!ctx||e.target.closest('input,textarea,select,.home-console,.live2d-widget,.live2d-settings,dialog,[data-live2d-size]'))return;bursts.push({x:e.clientX,y:e.clientY,start:time});if(bursts.length>5)bursts.shift();wake();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else wake();});addEventListener('pagehide',stop);addEventListener('pageshow',state);
  new MutationObserver(state).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  new MutationObserver(()=>{if(document.querySelector('dialog[open]'))stop();else wake();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  reduced.addEventListener('change',state);resize();state();

  const nav=document.querySelector('.main-nav'),indicator=document.createElement('span');indicator.className='nav-tracker';indicator.setAttribute('aria-hidden','true');nav.prepend(indicator);
  function follow(link){
    if(!link||!nav.getClientRects().length){indicator.hidden=true;return;}
    indicator.hidden=false;indicator.style.width=link.offsetWidth+'px';indicator.style.height=link.offsetHeight+'px';indicator.style.transform='translate3d('+link.offsetLeft+'px,'+link.offsetTop+'px,0)';
  }
  const current=()=>follow(nav.querySelector('a.is-active'));
  nav.addEventListener('pointerover',e=>{const link=e.target.closest('a');if(link)follow(link);});nav.addEventListener('pointerleave',current);nav.addEventListener('focusin',e=>{if(e.target.matches('a'))follow(e.target);});nav.addEventListener('focusout',current);
  new MutationObserver(current).observe(nav,{attributes:true,attributeFilter:['class']});addEventListener('resize',current);addEventListener('site-page',current);current();
  let pageAnimation=null;
  document.addEventListener('site-page-before',()=>{if(pageAnimation)pageAnimation.cancel();});
  addEventListener('site-page',()=>{const main=document.querySelector('#main');if(!reduced.matches&&main.animate)pageAnimation=main.animate([{opacity:.3,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});});
  reduced.addEventListener('change',()=>{if(reduced.matches&&pageAnimation)pageAnimation.cancel();});

  SitePage.register('motion-scenes',scope=>{
    if(reduced.matches)return;
    const animations=new Set(),seen=new WeakSet();let observer=null;
    function enter(el,delay=0){
      if(seen.has(el)||!el.animate)return;seen.add(el);el.classList.add('scene-entered');
      const animation=el.animate([{opacity:0,transform:'translate3d(0,26px,0) scale(.985)'},{opacity:1,transform:'translate3d(0,0,0) scale(1)'}],{duration:760,delay,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});
      animations.add(animation);animation.onfinish=()=>animations.delete(animation);
    }
    const targets=Array.from(document.querySelectorAll('#main .home-project,#main .home-writing>header,#main .home-entry,#main .page-heading,#main .writing-heading,#main .entry-row,#main .contact-card,#main .contact-note,#main .reading-page>header,#main .reading-page .prose>h2,#main .project-feature,#main .game-card,#main .stat-card'));
    if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{let order=0;for(const entry of entries)if(entry.isIntersecting){enter(entry.target,(order++%5)*85);observer.unobserve(entry.target);}},{threshold:.12});targets.forEach(el=>observer.observe(el));}
    else targets.forEach(el=>enter(el));
    function clear(){if(observer)observer.disconnect();animations.forEach(a=>a.cancel());animations.clear();}
    scope.on(reduced,'change',()=>{if(reduced.matches)clear();});scope.cleanup(clear);
  });
})();
