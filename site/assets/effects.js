/* A shared night-sky layer and small motion cues; page content stays native DOM. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-width: 767px), (pointer: coarse)');
  const canvas=document.createElement('canvas');canvas.className='ambient-field';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
  const ctx=canvas.getContext('2d');
  let frame=0,last=0,time=0,width=0,height=0,dark=false,stars=[],bursts=[],meteors=[],nextMeteor=1+Math.random()*7,meteorPasses=0,pointer={x:-1000,y:-1000};
  const rand=(a,b)=>a+Math.random()*(b-a);
  function resize(){
    width=innerWidth;height=innerHeight;
    stars=Array.from({length:compact.matches?26:62},()=>({x:rand(0,width),y:rand(0,height),r:rand(.65,1.7),speed:rand(3,11),phase:rand(0,Math.PI*2)}));
  }
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  let modalOpen=Boolean(document.querySelector('dialog[open]'));
  function wake(){if(ctx&&!frame&&!document.hidden&&!reduced.matches&&!modalOpen)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;if(document.hidden||reduced.matches||modalOpen){last=0;return;}
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
    // Each meteor crosses a different section of sky; the wake evaporates behind it.
    if(time>=nextMeteor){
      const rightward=Math.random()<.65,angle=rightward?rand(.28,.58):Math.PI-rand(.28,.58),life=rand(.95,1.6);
      meteors.push({start:time,x:width*(rightward?rand(.02,.48):rand(.52,.98)),y:rand(-20,height*.15),angle,life,speed:rand(.4,.7)*Math.min(width,1100),length:rand(95,190)*(compact.matches?.65:1),seed:rand(0,6.28)});
      nextMeteor=time+life+rand(6,15);canvas.dataset.meteorPasses=String(++meteorPasses);
    }
    meteors=meteors.filter(m=>time-m.start<m.life+.35);
    for(const m of meteors){
      const age=time-m.start,p=clampMeteor(age/m.life),distance=m.speed*(age*.88+age*age*.12/m.life),dx=Math.cos(m.angle),dy=Math.sin(m.angle),x=m.x+dx*distance,y=m.y+dy*distance;
      const light=Math.min(1,age/.12)*Math.pow(1-clampMeteor((age-m.life*.55)/(m.life*.45+.35)),1.3),length=m.length*Math.min(1,age/.22)*(1-p*.25);
      const tailColor = dark ? '159,199,255' : '37,92,153';
      const coreColor = dark ? '255,238,201' : '42,103,173';
      const bend = Math.sin(m.seed) * length * .055;
      const tailX = x - dx * length - dy * bend, tailY = y - dy * length + dx * bend;
      const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
      gradient.addColorStop(0, `rgba(${tailColor},0)`);
      gradient.addColorStop(.62, `rgba(${tailColor},${light * .18})`);
      gradient.addColorStop(1, `rgba(${coreColor},${light * .94})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.45;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.quadraticCurveTo(x - dx * length * .52, y - dy * length * .52, x, y);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = `rgba(${coreColor},${light * .87})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.35, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 1; k <= 4; k++) {
        const behind = length * (.25 + k * .14);
        const spread = Math.sin(m.seed + k * 2.3) * p * 5;
        ctx.fillStyle = `rgba(${tailColor},${light * (1 - k / 5) * .44})`;
        ctx.beginPath();
        ctx.arc(x - dx * behind - dy * spread, y - dy * behind + dx * spread, .5 + (k % 2) * .25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    bursts=bursts.filter(b=>time-b.start<1);
    for(const b of bursts){const p=time-b.start;ctx.strokeStyle='rgba('+color+','+((1-p)*.65)+')';ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.x,b.y,6+p*105,0,Math.PI*2);ctx.stroke();for(let k=0;k<8;k++){const angle=k*Math.PI/4;ctx.fillStyle='rgba('+color+','+((1-p)*.8)+')';ctx.fillRect(b.x+Math.cos(angle)*p*72,b.y+Math.sin(angle)*p*72,2,2);}}
    canvas.dataset.frames=String((Number(canvas.dataset.frames)||0)+1);wake();
  }
  function clampMeteor(value){return Math.max(0,Math.min(1,value));}
  function state(){dark=document.documentElement.dataset.theme==='dark';canvas.hidden=reduced.matches;if(reduced.matches){stop();bursts=[];if(ctx)ctx.clearRect(0,0,width,height);}else wake();}
  addEventListener('resize',()=>{resize();wake();});addEventListener('pointermove',e=>{if(e.pointerType!=='touch')pointer={x:e.clientX,y:e.clientY};},{passive:true});
  document.addEventListener('pointerleave',()=>{pointer={x:-1000,y:-1000};});
  document.addEventListener('click',e=>{if(reduced.matches||!ctx||e.target.closest('input,textarea,select,.home-console,.live2d-widget,.live2d-settings,dialog,[data-live2d-size]'))return;bursts.push({x:e.clientX,y:e.clientY,start:time});if(bursts.length>5)bursts.shift();wake();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else wake();});addEventListener('pagehide',stop);addEventListener('pageshow',state);
  new MutationObserver(state).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  new MutationObserver(()=>{
    modalOpen=Boolean(document.querySelector('dialog[open]'));
    if(modalOpen)stop();else wake();
  }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  reduced.addEventListener('change',state);window.trackViewportCanvas(canvas,ctx,1.25,resize);resize();state();

  const nav = document.querySelector('.main-nav');
  const desktop = matchMedia('(min-width: 681px) and (hover: hover) and (pointer: fine)');
  const indicator = document.createElement('span');
  indicator.className = 'nav-tracker';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.hidden = true;
  nav.prepend(indicator);
  const links = Array.from(nav.querySelectorAll('a'));
  let hoveredLink = null;

  function updateIndicator() {
    const active = nav.querySelector('[aria-current="page"]');
    const focused = nav.querySelector('a:focus-visible');
    const link = focused || hoveredLink || active;
    const show = desktop.matches && Boolean(link);
    if (show) {
      indicator.style.width = link.offsetWidth + 'px';
      indicator.style.height = link.offsetHeight + 'px';
      indicator.style.transform = `translate3d(${link.offsetLeft}px,${link.offsetTop}px,0)`;
    }
    indicator.hidden = !show;
    nav.classList.toggle('is-previewing', show && Boolean(active) && link !== active);
  }

  nav.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const link = event.target.closest('a');
    if (link === hoveredLink) return;
    hoveredLink = link;
    updateIndicator();
  });
  nav.addEventListener('pointerleave', () => { hoveredLink = null; updateIndicator(); });
  nav.addEventListener('focusin', updateIndicator);
  nav.addEventListener('focusout', () => queueMicrotask(updateIndicator));
  desktop.addEventListener('change', () => { hoveredLink = null; updateIndicator(); });
  addEventListener('resize', updateIndicator);
  addEventListener('site-page', updateIndicator);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(updateIndicator);
    links.forEach(link => observer.observe(link));
  }
  updateIndicator();

  SitePage.register('motion-scenes', scope => {
    if (reduced.matches || scope.skipEntrance || location.hash || !('IntersectionObserver' in window)) return;
    const main = document.querySelector('#main');
    const targets = main.querySelectorAll([
      '.reveal:not(.project-detail)', '.home-project', '.home-writing>header',
      '.page-heading', '.writing-heading', '.entry-row', '.reading-page>header', '.game-card'
    ].join(','));
    const animations = new Set();
    const observer = new IntersectionObserver(entries => {
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = entry.target;
        observer.unobserve(item);
        if (!item.animate || item.contains(document.activeElement) || order >= 6) continue;
        const animation = item.animate([
          { opacity: .24, translate: '0 14px' },
          { opacity: 1, translate: '0 0' }
        ], { duration: 360, delay: order++ * 42, easing: 'cubic-bezier(.18,.75,.22,1)', fill: 'backwards' });
        const record = { item, animation };
        animations.add(record);
        animation.onfinish = () => animations.delete(record);
      }
    }, { threshold: .08 });
    targets.forEach(item => observer.observe(item));
    function clear() {
      observer.disconnect();
      animations.forEach(({ animation }) => animation.cancel());
      animations.clear();
    }
    scope.on(main, 'focusin', event => {
      animations.forEach(record => {
        if (!record.item.contains(event.target)) return;
        record.animation.cancel();
        animations.delete(record);
      });
    });
    scope.on(reduced, 'change', () => { if (reduced.matches) clear(); });
    scope.cleanup(clear);
  });
})();
