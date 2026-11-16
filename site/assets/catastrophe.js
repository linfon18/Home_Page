/* A bounded visual Easter egg. No file, storage or page-content mutation. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let active=false;
  const random=(a,b)=>a+Math.random()*(b-a),clamp=n=>Math.max(0,Math.min(1,n));
  function sprite(inner,middle,outer){
    const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gradient=g.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,inner);gradient.addColorStop(.6,middle);gradient.addColorStop(1,outer);g.fillStyle=gradient;g.fillRect(0,0,128,128);return c;
  }
  document.addEventListener('terminal-catastrophe',()=>{
    if(active)return;active=true;
    const canvas=document.createElement('canvas');canvas.className='catastrophe-canvas';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
    const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();active=false;return;}
    const terminal=document.querySelector('.home-console'),b=terminal&&terminal.getBoundingClientRect();
    const originX=b?clamp((b.x+b.width*.5)/innerWidth):.55,originY=b?Math.max(.4,Math.min(.86,(b.y+b.height*.7)/innerHeight)):.75;
    let width=innerWidth,height=innerHeight,frame=0,timer=0,previous=0,disposed=false,viewport=null;
    const fire=sprite('#fff6b8','#ff971bdc','#d9270000'),hot=sprite('#fffdf4','#fff0bab0','#ffb43800');
    const smoke=sprite('#302c30f0','#55413ce0','#4e353000'),dust=sprite('#c4a08290','#9d5a3260','#60311900');
    const cap=Array.from({length:82},(_,n)=>({angle:n/41*Math.PI*2,r:n<41?random(.7,1):Math.sqrt(Math.random())*.76,size:random(.12,.23),phase:random(0,Math.PI*2)}));
    const debris=Array.from({length:width<700?90:170},()=>({angle:random(-Math.PI-.15,.15),speed:random(.25,.95),size:random(1,4.3),life:random(1.3,4.8)}));
    const rays=Array.from({length:32},(_,i)=>({angle:i*Math.PI*2/32+random(-.04,.04),length:random(.7,1.3)}));
    const started=performance.now();
    function cleanup(){
      if(disposed)return;disposed=true;cancelAnimationFrame(frame);clearTimeout(timer);if(viewport)viewport.destroy();
      removeEventListener('pagehide',cleanup);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',cleanup);
      canvas.remove();document.documentElement.classList.remove('catastrophe-active');active=false;
    }
    function visibility(){if(document.hidden)cleanup();}
    viewport=window.trackViewportCanvas(canvas,ctx,1.25,()=>{width=innerWidth;height=innerHeight;});
    addEventListener('pagehide',cleanup,{once:true});document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',cleanup);
    if(reduced.matches){canvas.dataset.phase='still';ctx.fillStyle='#d374242c';ctx.fillRect(0,0,width,height);timer=setTimeout(cleanup,1000);return;}
    document.documentElement.classList.add('catastrophe-active');
    function draw(now){
      if(disposed)return;const elapsed=(now-started)/1000;if(elapsed>6.5){cleanup();return;}
      frame=requestAnimationFrame(draw);if(now-previous<30)return;previous=now;
      const t=Math.max(0,elapsed-.16),fade=1-clamp((t-4.3)/2),x=width*originX,ground=height*originY,unit=Math.min(width,height);
      const phase=elapsed<.16?'charge':elapsed<.65?'flash':elapsed<1.6?'shockwave':elapsed<4.3?'cloud':'embers';if(canvas.dataset.phase!==phase)canvas.dataset.phase=phase;
      ctx.clearRect(0,0,width,height);
      if(elapsed<.16){ctx.fillStyle='rgba(12,7,4,'+(elapsed/.16*.35)+')';ctx.fillRect(0,0,width,height);const size=7+elapsed*80;ctx.drawImage(hot,x-size,ground-size,size*2,size*2);return;}
      const rise=1-Math.exp(-t*1.7),radius=unit*.33*(1-Math.exp(-t*2)),top=ground-Math.min(height*.42,Math.max(100,ground-height*.23))*rise;
      // One smooth ignition flash, then pressure and falling debris. No flashing loop.
      if(t<.6){const light=Math.sin(Math.PI*clamp(t/.6))*.82;ctx.fillStyle='rgba(255,238,194,'+light+')';ctx.fillRect(0,0,width,height);}
      ctx.globalAlpha=fade;ctx.fillStyle='rgba(29,10,6,'+(.34*clamp(t/.8))+')';ctx.fillRect(0,0,width,height);
      ctx.globalCompositeOperation='screen';
      if(t<1.65){const size=unit*(.12+.63*(1-Math.exp(-t*3)));ctx.globalAlpha=fade*(1-clamp(t/1.65));ctx.drawImage(fire,x-size,ground-size,size*2,size*2);}
      for(let ring=0;ring<2;ring++){
        const age=t-ring*.22;if(age<0||age>1.7)continue;const p=age/1.7,r=Math.hypot(width,height)*(.06+p*.85);
        ctx.globalAlpha=(1-p)*(.85-ring*.25);ctx.lineWidth=(1-p)*(ring?6:23)+1;ctx.strokeStyle=ring?'#ffdba3':'#fff3cf';
        ctx.beginPath();ctx.arc(x,ground,Math.max(1,r),0,Math.PI*2);ctx.stroke();
        ctx.lineWidth=2;ctx.strokeStyle='#b66e41';ctx.beginPath();ctx.arc(x,ground,Math.max(1,r+8),0,Math.PI*2);ctx.stroke();
      }
      if(t<.8){ctx.globalAlpha=(1-t/.8)*.8;ctx.strokeStyle='#ffe5a7';for(const ray of rays){const near=unit*t*.4,far=near+unit*.6*ray.length;ctx.lineWidth=1+ray.length;ctx.beginPath();ctx.moveTo(x+Math.cos(ray.angle)*near,ground+Math.sin(ray.angle)*near);ctx.lineTo(x+Math.cos(ray.angle)*far,ground+Math.sin(ray.angle)*far);ctx.stroke();}}
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=fade;
      // Broad ground dust, a rising stem, then a curling dark crown.
      for(let i=0;i<18;i++){const a=i*Math.PI*2/18,r=unit*.65*rise,size=unit*(.07+t*.014);ctx.drawImage(dust,x+Math.cos(a)*r-size,ground+Math.sin(a)*r*.14-size*.3,size*2,size*.6);}
      for(let n=0;n<20;n++){const p=n/19,y=ground-(ground-top)*p,size=(20+radius*.24)*(1-p*.4),cx=x+Math.sin(n*.8+t*2)*size*.17;ctx.drawImage(smoke,cx-size,y-size,size*2,size*2);if(t<2.6){ctx.globalAlpha=fade*(1-t/2.6);ctx.drawImage(fire,cx-size*.6,y-size,size*1.2,size*1.8);ctx.globalAlpha=fade;}}
      for(const p of cap){const a=p.angle+t*.12,cx=x+Math.cos(a)*radius*p.r,cy=top+Math.sin(a)*radius*.3*p.r,size=radius*p.size*(1+Math.sin(t*2+p.phase)*.15)+18;ctx.drawImage(smoke,cx-size*1.4,cy-size*1.2,size*2.8,size*2.4);}
      ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade*(1-clamp((t-.8)/2.5));
      for(const p of cap){const cx=x+Math.cos(p.angle+t*.12)*radius*p.r*.88,cy=top+Math.sin(p.angle)*radius*.23+radius*.08,size=radius*p.size+8;ctx.drawImage(fire,cx-size,cy-size,size*2,size*2);}
      const core=unit*.25*(1-Math.exp(-t*9))*(1-clamp((t-.35)/1.5));if(core>0){ctx.globalAlpha=1-clamp(t/2);ctx.drawImage(hot,x-core,ground-height*.12*rise-core,core*2,core*2);}
      for(const p of debris){if(t>p.life)continue;const velocity=p.speed*unit,px=x+Math.cos(p.angle)*velocity*t,py=ground+Math.sin(p.angle)*velocity*t+unit*.18*t*t,size=p.size*(1-t/p.life);ctx.globalAlpha=fade*(1-t/p.life);ctx.strokeStyle=t<1.5?'#fff5c4':'#ff9e42';ctx.lineWidth=Math.max(.5,size);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-Math.cos(p.angle)*velocity*.025,py-(Math.sin(p.angle)*velocity+unit*.36*t)*.025);ctx.stroke();}
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
      if(t>2)document.documentElement.classList.remove('catastrophe-active');
    }
    frame=requestAnimationFrame(draw);timer=setTimeout(cleanup,7000);
  });
})();
