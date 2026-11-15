/* A visual Easter egg only. Never touches storage, files, or the DOM content. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let active=false;
  const random=(a,b)=>a+Math.random()*(b-a),clamp=n=>Math.max(0,Math.min(1,n));
  function sprite(inner,outer){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gradient=g.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,inner);gradient.addColorStop(.4,inner);gradient.addColorStop(1,outer);g.fillStyle=gradient;g.fillRect(0,0,128,128);return c;}
  document.addEventListener('terminal-catastrophe',()=>{
    if(active)return;active=true;
    const canvas=document.createElement('canvas');canvas.className='catastrophe-canvas';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);document.documentElement.classList.add('catastrophe-active');
    const ctx=canvas.getContext('2d'),width=innerWidth,height=innerHeight,ratio=Math.min(devicePixelRatio||1,1.25);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.scale(ratio,ratio);
    const x=width*.55,ground=height*.86,fire=sprite('#ffbe48e8','#f3400000'),hot=sprite('#fff4c5f0','#ff6a0000'),smoke=sprite('#382a2dd0','#30232a00');
    const cap=Array.from({length:68},(_,n)=>({angle:n/34*Math.PI*2,r:n<34?random(.72,1):Math.sqrt(Math.random())*.72,size:random(.14,.25),phase:random(0,Math.PI*2)}));
    const embers=Array.from({length:width<700?55:100},()=>({angle:random(-Math.PI,0),speed:random(.1,.55)*Math.min(width,height),size:random(1.5,4),life:random(1,3.5)}));
    let start=performance.now(),previous=0,frame=0;
    function cleanup(){cancelAnimationFrame(frame);removeEventListener('pagehide',cleanup);canvas.remove();document.documentElement.classList.remove('catastrophe-active');active=false;}
    if(reduced.matches){const g=ctx.createRadialGradient(x,ground,0,x,ground,Math.max(width,height));g.addColorStop(0,'#f2893550');g.addColorStop(1,'#8f231518');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);setTimeout(cleanup,1000);return;}
    function draw(now){
      const t=(now-start)/1000;if(t>5){cleanup();return;}frame=requestAnimationFrame(draw);if(now-previous<30)return;previous=now;
      ctx.clearRect(0,0,width,height);const fade=1-clamp((t-3.5)/1.5),rise=1-Math.exp(-t*1.6),radius=Math.min(width*.39,450)*(1-Math.exp(-t*1.9)),top=ground-height*.53*rise;
      // A single warm flash, followed by expanding pressure and dust rings.
      const flash=Math.sin(Math.PI*clamp(t/.6))*.65;if(t<.6){ctx.fillStyle='rgba(255,188,93,'+flash+')';ctx.fillRect(0,0,width,height);}
      ctx.globalAlpha=fade;ctx.fillStyle='rgba(63,12,3,'+(.18*clamp(t))+')';ctx.fillRect(0,0,width,height);
      if(t<1.8){const pressure=t/1.8;ctx.save();ctx.translate(x,ground);ctx.scale(1,.28);ctx.beginPath();ctx.arc(0,0,Math.max(1,width*pressure),0,Math.PI*2);ctx.strokeStyle='rgba(255,218,151,'+((1-pressure)*.8)+')';ctx.lineWidth=18*(1-pressure)+1;ctx.shadowColor='#ff9b39';ctx.shadowBlur=35;ctx.stroke();ctx.restore();}
      // The rising stem feeds an irregular mushroom cap; smoke darkens over time.
      for(let n=0;n<19;n++){const p=n/18,y=ground-(ground-top)*p,size=(35+radius*.2)*(1-p*.45)*(1+Math.sin(t*4+n)*.1);ctx.drawImage(t<2?fire:smoke,x-size*.6+Math.sin(n+t*2)*size*.12,y-size,size*1.2,size*1.8);}
      cap.forEach(p=>{const cx=x+Math.cos(p.angle)*radius*p.r,cy=top+Math.sin(p.angle)*radius*.32*p.r,size=radius*p.size*(1+Math.sin(t*2+p.phase)*.13)+25;ctx.drawImage(smoke,cx-size*1.4,cy-size*1.2,size*2.8,size*2.4);});
      ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade*(1-clamp((t-1.2)/2.5));
      cap.forEach(p=>{const cx=x+Math.cos(p.angle)*radius*p.r*.9,cy=top+Math.sin(p.angle)*radius*.25,size=radius*p.size+12;ctx.drawImage(fire,cx-size,cy-size,size*2,size*2);});
      const coreSize=(50+radius*.6)*(1-clamp((t-1)/2));if(coreSize>0)ctx.drawImage(hot,x-coreSize,ground-height*.12*rise-coreSize,coreSize*2,coreSize*2);
      ctx.globalAlpha=fade;
      embers.forEach(p=>{if(t>p.life)return;const px=x+Math.cos(p.angle)*p.speed*t,py=ground+Math.sin(p.angle)*p.speed*t+70*t*t,size=p.size*(1-t/p.life);ctx.fillStyle='#ffc46b';ctx.beginPath();ctx.ellipse(px,py,size,size*2.5,-p.angle,0,Math.PI*2);ctx.fill();});
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
      if(t>1.7)document.documentElement.classList.remove('catastrophe-active');
    }
    frame=requestAnimationFrame(draw);addEventListener('pagehide',cleanup,{once:true});
  });
})();
