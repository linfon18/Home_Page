(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (a,b,t) => a + (b-a)*t;

  SitePage.register('home-arrival', scope => {
    const card = document.querySelector('.home-profile');
    if (!card || reduce.matches || document.hidden || location.hash || scrollY > innerHeight) return;
    const avatar = card.querySelector('.home-avatar');
    const canvas = document.createElement('canvas');
    canvas.className = 'arrival-trails';
    canvas.setAttribute('aria-hidden','true');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    document.body.append(canvas);
    const width = innerWidth, height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.scale(ratio,ratio);
    const rect = avatar.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const wallpaper = document.querySelector('.wallpaper');
    if (wallpaper) {
      wallpaper.style.setProperty('--exposure-x',`${100 * cx / width}%`);
      wallpaper.style.setProperty('--exposure-y',`${100 * cy / height}%`);
      wallpaper.classList.add('opening-exposure');
    }
    const r = rect.width/2 + 7;
    const dark = document.documentElement.dataset.theme === 'dark';
    const colors = dark ? ['#b3edff','#ffdeb6','#a9bcff'] : ['#117daa','#b76419','#425ac2'];
    const paths = [
      {from:[-.03*width,.8*height],c1:[.02*width,.22*height],c2:[cx+120,cy+135],angle:2.4},
      {from:[width*.82,-12],c1:[width*.63,.36*height],c2:[cx-60,cy-105],angle:-.9},
      {from:[width*1.02,height*.76],c1:[width*.59,height*.84],c2:[cx+220,cy-108],angle:.3}
    ];
    function point(path,t) {
      const q=1-t, endX=cx+Math.cos(path.angle)*r, endY=cy+Math.sin(path.angle)*r;
      return [q*q*q*path.from[0]+3*q*q*t*path.c1[0]+3*q*t*t*path.c2[0]+t*t*t*endX,
        q*q*q*path.from[1]+3*q*q*t*path.c1[1]+3*q*t*t*path.c2[1]+t*t*t*endY];
    }
    function trail(path,progress,color) {
      const head=1-(1-progress)**1.7;
      const tail=clamp(head-.25*Math.sin(progress*Math.PI));
      const first=point(path,tail), tip=point(path,head);
      const gradient=ctx.createLinearGradient(...first,...tip);
      gradient.addColorStop(0,color+'00');
      gradient.addColorStop(.65,color+'a0');
      gradient.addColorStop(1,color);
      ctx.strokeStyle=gradient;
      ctx.beginPath();ctx.moveTo(...first);
      for(let k=1;k<=18;k++) ctx.lineTo(...point(path,mix(tail,head,k/18)));
      ctx.lineWidth=7;ctx.globalAlpha=.23;ctx.stroke();
      ctx.lineWidth=1.65;ctx.globalAlpha=.94;ctx.stroke();
      ctx.strokeStyle=dark?'#ecfaff':'#fff8e2';ctx.lineWidth=.65;ctx.stroke();
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(...tip,2.7,0,Math.PI*2);ctx.fill();
      for(let k=1;k<=6;k++){
        const f=k/7, p=point(path,mix(head,tail,f));
        const drift=Math.sin(f*11+path.angle)*7*f;
        ctx.globalAlpha=(1-f)*.8;
        ctx.beginPath();ctx.arc(p[0]+drift,p[1]+f*8,1.65-f,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    const animations=[];
    function enter(el,keyframes,delay,duration){
      if(el?.animate) animations.push(el.animate(keyframes,{delay,duration,fill:'backwards',easing:'cubic-bezier(.2,.75,.22,1)'}));
    }
    enter(avatar,[{scale:'.82',rotate:'-7deg'},{scale:'1.09',rotate:'2deg',offset:.65},{scale:'1',rotate:'0deg'}],170,870);
    enter(card.querySelector('h1'),[{clipPath:'inset(0 100% 0 0)',translate:'-12px 0'},{clipPath:'inset(0 0 0 0)',translate:'0 0'}],230,650);
    enter(card.querySelector('.home-intro'),[{opacity:.15,translate:'0 14px'},{opacity:1,translate:'0 0'}],380,540);
    let frame=0, started;
    function finish() {
      cancelAnimationFrame(frame);
      canvas.remove();
      wallpaper?.classList.remove('opening-exposure');
      animations.forEach(a=>a.cancel());
    }
    function draw(now) {
      if(started===undefined)started=now;
      const time=now-started;
      if(time>=1600 || document.hidden || reduce.matches){finish();return;}
      ctx.clearRect(0,0,width,height);
      paths.forEach((path,index)=>{
        const t=(time-index*105)/795;
        if(t>0 && t<1) trail(path,t,colors[index]);
      });
      const bloom=(time-690)/820;
      if(bloom>0 && bloom<1){
        ctx.lineWidth=1.5;
        ctx.globalAlpha=(1-bloom)**1.6;
        for(let i=0;i<3;i++){
          const a=paths[i].angle+bloom*.9;
          ctx.strokeStyle=colors[i];ctx.beginPath();
          ctx.arc(cx,cy,r+15*(1-(1-bloom)**2),a,a+1.55*bloom+.22);ctx.stroke();
        }
      }
      frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
    scope.on(window,'resize',finish,{once:true});
    scope.on(window,'scroll',finish,{once:true,passive:true});
    scope.on(reduce,'change',finish);
    scope.on(document,'visibilitychange',()=>{if(document.hidden)finish();});
    scope.cleanup(finish);
  });
})();
