/* Thin surface water: pinned wet film, intermittent rivulets and gravity-driven drips. */
(() => {
  'use strict';
  const tau=Math.PI*2,rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  window.createWeatherSurfaces=function(canvas,compact){
    const layer=document.createElement('div');layer.className='weather-surfaces';layer.setAttribute('aria-hidden','true');layer.hidden=true;document.body.append(layer);
    let dragon=null,umbrella=null,dirty=true,splashes=[],effect='clear',active=false,signature='';
    let lastReport=0,movingUntil=0,umbrellaHits=0,umbrellaRunoffs=0,canopyDrops=[];
    const canopyWater=[0,0];
    function resetOutlet(o){Object.assign(o,{amount:0,delay:0,pendant:0,feed:0,flow:0,connected:false,pinching:0,released:0,threshold:rand(1.45,1.85)});}
    // Sample the unchanged wallpaper once per viewport/theme, never per droplet.
    const background=new Image(),refraction=document.createElement('canvas'),optics=refraction.getContext('2d');
    let textureKey='';background.src='/assets/original-background.jpg';
    let dailyImage=document.querySelector('.daily-wallpaper');
    window.addEventListener('site-wallpaper',event=>{dailyImage=event.detail;textureKey='';});
    function prepareOptics(dark){
      const image=dailyImage||background;
      if(!image.complete||!image.naturalWidth)return;
      const onHome=document.body.dataset.page==='home';
      const key=innerWidth+':'+innerHeight+':'+dark+':'+onHome;if(key===textureKey)return;textureKey=key;
      refraction.width=innerWidth;refraction.height=innerHeight;
      const scale=Math.max(innerWidth/image.naturalWidth,innerHeight/image.naturalHeight)*1.045;
      const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
      optics.filter=onHome?'none':'blur(3px)';optics.drawImage(image,(innerWidth-w)/2,(innerHeight-h)/2,w,h);optics.filter='none';
      if(onHome){
        const style=getComputedStyle(document.body);
        const tint=optics.createLinearGradient(0,76,0,205);
        tint.addColorStop(0,style.getPropertyValue('--cover-top').trim());
        tint.addColorStop(1,style.getPropertyValue('--cover-tint').trim());
        optics.fillStyle=tint;
      }else optics.fillStyle=dark?'#060f20c4':'#e7f0fba8';
      optics.fillRect(0,0,innerWidth,innerHeight);
    }
    let panels=[];
    function reset(){panels=[];splashes=[];dirty=true;}
    const resizeObserver=new ResizeObserver(()=>{dirty=true;});
    function bind(){
      resizeObserver.disconnect();
      reset();
      panels=Array.from(document.querySelectorAll('.home-console,.home-network'),node=>{
        resizeObserver.observe(node);
        return createPanel(node);
      });
    }
    function set(next,hidden){
      if(next!==effect){effect=next;panels.forEach(panel=>panel.clear());splashes=[];dirty=true;canopyWater.fill(0);canopyDrops=[];}
      active=!hidden;layer.hidden=!active||!['rain','snow'].includes(effect);
      const nextSignature=effect+':'+active;
      if(signature!==nextSignature){signature=nextSignature;document.documentElement.dataset.weatherEffect=effect;document.documentElement.dataset.weatherActive=String(active);dispatchEvent(new CustomEvent('site-weather',{detail:{effect,active}}));}
    }
    function measure(){
      if(panels.some(panel=>!panel.node.isConnected))bind();
      if(dirty||performance.now()<movingUntil){
        panels.forEach(panel=>panel.measure());
        dirty=false;
      }
      if(!dragon||!dragon.isConnected)dragon=document.querySelector('.live2d-widget');
      umbrella=dragon&&!dragon.hidden?dragon._weatherShelter||null:null;
      if(!umbrella){canopyWater.fill(0);canopyDrops=[];}
    }
    function splash(x,y,count=3){for(let i=0;i<count&&splashes.length<(compact.matches?24:60);i++)splashes.push({x,y,vx:rand(-42,42),vy:rand(-42,-12),age:0,life:rand(.12,.28)});}
    function canopyHit(p,oldX,oldY){
      if(!umbrella||p.y<=oldY||Math.max(oldX,p.x)<umbrella.x||Math.min(oldX,p.x)>umbrella.x+umbrella.w||p.bounce===2)return null;
      const dx=p.x-oldX,dy=p.y-oldY,points=umbrella.curve;
      for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],ex=b.x-a.x,ey=b.y-a.y,den=dx*ey-dy*ex;if(Math.abs(den)<.00001)continue;
        const ax=a.x-oldX,ay=a.y-oldY,t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
        if(t>=0&&t<=1&&u>=0&&u<=1)return {x:oldX+dx*t,y:oldY+dy*t,t,side:i<=points.length/2?0:1};
      }return null;
    }
    function collide(p,oldX,oldY){
      const canopy=canopyHit(p,oldX,oldY);
      let nearest=null, owner=null;
      if(effect!=='hail'&&p.y>oldY)for(const panel of panels){
        const hit=panel.crossing(p,oldX,oldY);
        if(hit&&(!nearest||hit.t<nearest.t)){nearest=hit;owner=panel;}
      }
      if(nearest&&(!canopy||nearest.t<=canopy.t)){owner.deposit(nearest,p.size);return true;}
      if(canopy){
        umbrellaHits++;umbrella.impact=Math.min(1,umbrella.impact+(effect==='hail'?.4:.025));
        if(effect==='rain'){splash(canopy.x,canopy.y,2);canopyWater[canopy.side]+=.1+p.size*.04;}
        if(effect==='snow')umbrella.snow=Math.min(3,umbrella.snow+p.size*.12);
        if(effect==='hail'){p.x=canopy.x;p.y=canopy.y-2;p.speed=-rand(90,180);p.vx=canopy.side?rand(10,25):rand(-25,-10);p.bounce=2;}
        return true;
      }
      return false;
    }
    function rounded(ctx,x,y,w,h,r){ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
    function clip(ctx){
      // Independent subtraction keeps overlapping shelters opaque to precipitation.
      if(effect!=='hail')for(const panel of panels)panel.mask(ctx);
      if(umbrella){const points=umbrella.curve,left=points[0],right=points[points.length-1],bottom=Math.max(innerHeight+100,umbrella.bottom),drift=effect==='snow'?0:-.125;ctx.beginPath();ctx.rect(-1000,-1000,innerWidth+2000,innerHeight+2000);ctx.moveTo(left.x,left.y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.lineTo(right.x+(bottom-right.y)*drift,bottom);ctx.lineTo(left.x+(bottom-left.y)*drift,bottom);ctx.closePath();ctx.clip('evenodd');}
    }
    function createPanel(node){
      let roof=null,water=[],drops=[],snow=[],film=[],hits=0,snowHits=0,runoffs=0;
      const outlets=[{side:-1},{side:1}];
      outlets.forEach(resetOutlet);
      function clear(){water=[];drops=[];film=[];snow=[];outlets.forEach(resetOutlet);}
      function measurePanel(){
        const b=node.getBoundingClientRect();
        if(!b.width||!b.height||b.bottom<0||b.top>innerHeight){roof=null;return;}
        const radius=parseFloat(getComputedStyle(node).borderTopLeftRadius)||0;
        roof={x:b.x,y:b.y,w:b.width,h:b.height,r:Math.max(.01,Math.min(radius,b.width/2,b.height/2))};
        const count=Math.max(2,Math.ceil(b.width/7)+1);
        function fit(values){return Array.from({length:count},(_,i)=>values.length?values[Math.round(i*(values.length-1)/(count-1))]:0);}
        if(count!==snow.length)snow=fit(snow);
        if(count!==film.length)film=fit(film);
      }
      function top(x){const r=roof.r,l=x-roof.x;if(l<r)return roof.y+r-Math.sqrt(Math.max(0,r*r-(l-r)*(l-r)));if(l>roof.w-r)return roof.y+r-Math.sqrt(Math.max(0,r*r-(l-roof.w+r)*(l-roof.w+r)));return roof.y;}
      function depth(x){const t=clamp((x-roof.x)/roof.w*(snow.length-1),0,snow.length-1),i=Math.floor(t);return snow[i]*(1-(t-i))+(snow[Math.min(i+1,snow.length-1)]||0)*(t-i);}
      function crossing(p,oldX,oldY){
        if(!roof||p.x<roof.x||p.x>roof.x+roof.w)return null;
        const surface=top(p.x)-(effect==='snow'?depth(p.x)*.8:.5);
        const x0=clamp(oldX,roof.x,roof.x+roof.w);
        if(oldY>top(x0)-(effect==='snow'?depth(x0)*.8:.5)+1||p.y<surface)return null;
        const t=clamp((surface-oldY)/(p.y-oldY),0,1);
        return {t,x:oldX+(p.x-oldX)*t,y:surface};
      }
      function deposit(hit,size){
        const rain=effect==='rain', bins=rain?film:snow;
        const at=Math.round(clamp((hit.x-roof.x)/roof.w,0,1)*(bins.length-1));
        for(let n=-2;n<=2;n++)if(at+n>=0&&at+n<bins.length)bins[at+n]=Math.min(rain?1.8:12,bins[at+n]+(rain?.045+size*.028:size*.34)*(1-Math.abs(n)/3));
        if(rain){hits++;splash(hit.x,hit.y);}else snowHits++;
      }
      function mask(ctx){
        if(!roof)return;
        ctx.beginPath();ctx.rect(-100,-100,innerWidth+200,innerHeight+200);
        rounded(ctx,roof.x,roof.y,roof.w,roof.h,roof.r);ctx.clip('evenodd');
      }
    function edge(distance,side,phase){
      const r=roof.r,arc=r*Math.PI/2,straight=Math.max(0,roof.h-2*r),offset=1.1+.24*Math.sin(distance*.12+phase);
      let x,y;
      if(distance<arc){const a=distance/r;x=r-Math.sin(a)*(r+offset);y=r-Math.cos(a)*(r+offset);}
      else if(distance<arc+straight){x=-offset;y=r+distance-arc;}
      else{const a=(distance-arc-straight)/r;x=r-Math.cos(a)*(r+offset);y=roof.h-r+Math.sin(a)*(r+offset);}
      return {x:roof.x+(side<0?x:roof.w-x),y:roof.y+y};
    }
    function lens(ctx,x,y,rx,ry){
      ctx.save();ctx.beginPath();ctx.moveTo(x,y-ry);ctx.bezierCurveTo(x-rx*.65,y-ry*.2,x-rx*1.1,y+ry*.6,x,y+ry);ctx.bezierCurveTo(x+rx,y+ry*.8,x+rx*.7,y-ry*.15,x,y-ry);ctx.closePath();ctx.clip();
      if(textureKey&&x>rx&&y>ry&&x+rx<innerWidth&&y+ry<innerHeight){ctx.globalAlpha=.5;ctx.drawImage(refraction,x-rx*.65,y-ry*.65,rx*1.3,ry*1.3,x-rx,y-ry,rx*2,ry*2);ctx.globalAlpha=1;}
      ctx.fillStyle='rgba(166,198,214,.10)';ctx.fillRect(x-rx,y-ry,rx*2,ry*2);ctx.restore();
      ctx.strokeStyle='rgba(220,237,242,.30)';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(x-rx*.35,y-ry*.2);ctx.quadraticCurveTo(x-rx*.65,y+ry*.3,x-rx*.2,y+ry*.65);ctx.stroke();
    }
    function pendant(ctx,at,o,time){
      if(o.pendant<.035)return;
      const volume=clamp(o.pendant/o.threshold,0,1),radius=1.1+Math.cbrt(volume)*3.6;
      const stretch=o.pinching?1+Math.pow(o.pinching/.16,2)*.6:1;
      const length=(2+volume*7)*stretch,neck=(.65+volume*.65)*(o.pinching?Math.max(.08,1-o.pinching/.16):1);
      const x=at.x+Math.sin(time*2+o.side)*volume*.25,y=at.y+.4;
      ctx.save();ctx.beginPath();ctx.moveTo(x-neck,y-1);
      ctx.bezierCurveTo(x-neck,y+length*.5,x-radius,y+length*.45,x-radius*.75,y+length);
      ctx.bezierCurveTo(x-radius*.65,y+length+radius,x+radius*.8,y+length+radius,x+radius*.8,y+length);
      ctx.bezierCurveTo(x+radius,y+length*.45,x+neck,y+length*.5,x+neck,y-1);ctx.closePath();ctx.clip();
      if(textureKey&&x>radius&&y>0&&x+radius<innerWidth&&y+length+radius<innerHeight){ctx.globalAlpha=.6;ctx.drawImage(refraction,x-radius*.7,y,radius*1.4,(length+radius)*.7,x-radius,y,radius*2,length+radius);ctx.globalAlpha=1;}
      ctx.fillStyle='rgba(154,190,211,.16)';ctx.fillRect(x-radius,y,radius*2,length+radius);ctx.restore();
      ctx.lineWidth=.65;ctx.strokeStyle='rgba(218,238,249,.52)';ctx.beginPath();ctx.moveTo(x-neck*.5,y+2);ctx.bezierCurveTo(x-radius*.65,y+length*.6,x-radius*.9,y+length,x-radius*.25,y+length+radius*.5);ctx.stroke();
      ctx.strokeStyle='rgba(35,61,77,.34)';ctx.beginPath();ctx.moveTo(x+radius*.7,y+length*.75);ctx.quadraticCurveTo(x+radius*.9,y+length+radius*.6,x,y+length+radius*.75);ctx.stroke();
    }
    function rain(ctx,dt,time,dark){
      prepareOptics(dark);
      const incoming=[0,0];
      // Adjacent wet patches spread as a sheet instead of moving as round beads.
      for(let i=0;i<film.length;i++){
        const amount=film[i]*dt*.18;film[i]-=amount;incoming[i<film.length/2?0:1]+=amount;
        if(i<film.length-1){const flow=(film[i]-film[i+1])*Math.min(.22,dt*3);film[i]-=flow;film[i+1]+=flow;}
      }
      const visible=roof.y<innerHeight&&roof.y+roof.h>0;
      const wetness=film.length?film.reduce((a,b)=>a+b,0)/film.length:0;
      for(let index=0;index<outlets.length;index++){
        const o=outlets[index],volume=incoming[index];o.delay-=dt;
        o.feed+=(volume/(dt||1)-o.feed)*Math.min(1,dt*1.5);
        // A wetted path and a first detached drop precede a connected stream.
        // Hysteresis prevents flickering between a dripping and running edge.
        const running=o.connected&&o.released>0&&wetness>(o.flow>.5?.18:.32)&&o.feed>(o.flow>.5?.45:.8);
        o.flow+=(Number(running)-o.flow)*Math.min(1,dt*(running?.55:1.8));
        const direct=volume*o.flow;o.pendant+=direct;o.amount+=volume-direct;
        if(o.amount>.85&&o.delay<=0&&water.filter(p=>p.side===o.side&&!p.spent).length<2){
          const mass=Math.min(1.8,o.amount*.65);o.amount-=mass;o.delay=rand(1.8,4.4);
          water.push({side:o.side,d:0,v:0,mass,phase:rand(0,tau),trail:[],pause:rand(.15,.4),pin:rand(35,100),spent:false});
        }
      }
      ctx.save();clip(ctx);
      if(visible){
        ctx.lineJoin='round';ctx.lineCap='round';
        for(let i=1;i<film.length;i++){
          const x=roof.x+(i-1)/(film.length-1)*roof.w,nx=roof.x+i/(film.length-1)*roof.w,amount=(film[i]+film[i-1])/2;
          if(amount<.015)continue;
          ctx.strokeStyle='rgba(165,191,205,'+Math.min(.25,amount*.28)+')';ctx.lineWidth=.6+amount*.6;
          ctx.beginPath();ctx.moveTo(x,top(x)-.5-film[i-1]*.38);ctx.lineTo(nx,top(nx)-.5-film[i]*.38);ctx.stroke();
        }
      }
      const end=roof.r*Math.PI/2+Math.max(0,roof.h-2*roof.r)+roof.r*1.22;
      for(const p of water){
        if(!p.spent){
          if(p.pause>0)p.pause-=dt;
          else{p.v+=(45+p.mass*42-p.v*.35)*dt;p.d=Math.min(end,p.d+p.v*dt);if(p.d>p.pin){p.pause=rand(.08,.28);p.v*=.45;p.pin+=rand(65,140);}}
          if(p.d>=end){const outlet=outlets[p.side<0?0:1],transfer=Math.min(p.mass,dt*.65);outlet.pendant+=transfer;p.mass-=transfer;outlet.connected=true;p.spent=p.mass<.0001;}
          if(!p.trail.length||p.d-p.trail[p.trail.length-1].d>2)p.trail.push({d:p.d,age:0});
        }
        for(const t of p.trail)t.age+=dt;
        p.trail=p.trail.filter(t=>t.age<3.2);
        if(visible){
          for(let i=1;i<p.trail.length;i++){
            const a=p.trail[i-1],b=p.trail[i],pa=edge(a.d,p.side,p.phase),pb=edge(b.d,p.side,p.phase),fade=Math.pow(1-a.age/3.2,1.5),pulse=.75+.25*Math.sin(a.d*.11+p.phase);
            ctx.lineWidth=(.5+p.mass*.4)*pulse;ctx.strokeStyle='rgba(184,211,224,'+(.26*fade)+')';ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
          }
          if(!p.spent&&p.d<end){const at=edge(p.d,p.side,p.phase);lens(ctx,at.x,at.y,1+p.mass*.35,(1.4+p.mass*.35)*(1+p.v/130));}
        }
      }
      for(let i=0;i<water.length;i++)for(let j=i+1;j<water.length;j++){const a=water[i],b=water[j];if(!a.spent&&!b.spent&&a.side===b.side&&Math.abs(a.d-b.d)<5){a.mass+=b.mass;a.v=Math.max(a.v,b.v);a.d=Math.max(a.d,b.d);b.spent=true;}}
      water=water.filter(p=>!p.spent||p.trail.length);
      for(const o of outlets){
        const at=edge(end,o.side,0),jet=o.flow>.12;
        if(jet&&visible){
          // A slender attached film feeds a short jet, which breaks into drops.
          ctx.beginPath();for(let d=0;d<end;d+=8){const p=edge(d,o.side,Math.sin(time)*.2);if(d)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}ctx.lineTo(at.x,at.y);
          ctx.lineWidth=(.65+Math.min(o.feed,3)*.28)*o.flow;ctx.strokeStyle='rgba(193,219,234,'+(.35*o.flow)+')';ctx.stroke();
          const length=(18+Math.min(o.feed,3)*11)*o.flow;
          for(let y=0;y<length;y+=3){const thin=.55+.45*Math.sin(y*.26-time*14);ctx.lineWidth=(.7+o.flow)*thin*o.flow;ctx.beginPath();ctx.moveTo(at.x+Math.sin(y*.08+time*3)*y*.008,at.y+y);ctx.lineTo(at.x+Math.sin((y+3)*.08+time*3)*(y+3)*.008,at.y+y+3);ctx.stroke();}
        }
        const threshold=o.threshold*(1-o.flow*.72);
        if(o.pendant>=threshold||o.pinching){
          o.pinching+=dt;
          if(o.pinching>=.16){const mass=Math.min(o.pendant,Math.max(threshold,o.pendant*o.flow)),radius=1.1+Math.cbrt(Math.min(1,mass/o.threshold))*3.6,length=jet?(18+Math.min(o.feed,3)*11)*o.flow:12;
            drops.push({x:at.x-roof.x,y:at.y-roof.y+length,vy:jet?95:10,rx:radius,age:0});o.pendant-=mass;o.pinching=0;o.threshold=rand(1.45,1.85);o.released++;runoffs++;
          }
        }
        if(visible&&o.flow<.65)pendant(ctx,at,o,time);
      }
      drops=drops.filter(p=>{p.age+=dt;p.vy+=dt*780;p.y+=dt*p.vy;if(p.age>.8)return false;if(visible)lens(ctx,roof.x+p.x,roof.y+p.y,p.rx*(1-.22*Math.min(1,p.age*3)),p.rx*(1+Math.min(.8,p.vy/380)));return true;});
      ctx.restore();
    }
    function drawPanel(ctx,dt,time,dark){
      if(!roof)return;
      if(effect==='rain')rain(ctx,dt,time,dark);
      if(effect==='snow')drawSnow(ctx,dt);
    }
    function report(){return {rainHits:hits,snowHits,runoffs,waterStreams:water.filter(p=>!p.spent).length,waterFilm:film.reduce((a,b)=>a+b,0).toFixed(2),waterPendant:outlets.map(o=>o.pendant.toFixed(2)).join(','),waterFlow:outlets.map(o=>o.flow.toFixed(2)).join(','),snowDepth:(snow.length?Math.max(...snow):0).toFixed(2)};}
    return {node,measure:measurePanel,mask,crossing,deposit,clear,draw:drawPanel,report};
    function drawSnow(ctx,dt){
      for(let i=0;i<snow.length;i++)snow[i]=Math.min(12,snow[i]+dt*.11);
      ctx.save();ctx.shadowColor='rgba(12,32,52,.25)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
      const g=ctx.createLinearGradient(0,roof.y-13,0,roof.y+3);g.addColorStop(0,'#fff');g.addColorStop(1,'#c5d8e6');ctx.fillStyle=g;ctx.beginPath();
      for(let i=0;i<snow.length;i++){const x=roof.x+i/(snow.length-1)*roof.w,edge=Math.min(1,i/2,(snow.length-1-i)/2),y=top(x)-snow[i]*edge*(.92+.08*Math.sin(i*2.4));if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
      for(let i=snow.length-1;i>=0;i--){const x=roof.x+i/(snow.length-1)*roof.w;ctx.lineTo(x,top(x)+.7);}
      ctx.closePath();ctx.fill();ctx.restore();
    }
    }
    function draw(ctx,dt,time,dark){
      for(const panel of panels)panel.draw(ctx,dt,time,dark);
      if(umbrella&&effect==='rain'){
        for(let i=0;i<2;i++)if(canopyWater[i]>=.65&&canopyDrops.length<20){const p=umbrella.curve[i?16:0];canopyWater[i]-=.65;canopyDrops.push({x:p.x,y:p.y+2,vy:28,age:0,side:i?1:-1,scale:umbrella.scale});umbrellaRunoffs++;}
        ctx.save();for(const panel of panels)panel.mask(ctx);
        canopyDrops=canopyDrops.filter(p=>{p.age+=dt;if(p.age>1)return false;p.vy+=dt*560;p.y+=dt*p.vy;p.x+=dt*(p.side*6-12);ctx.strokeStyle='rgba(198,226,243,'+(.6*(1-p.age))+')';ctx.lineWidth=Math.max(.6,Math.min(2,p.scale));ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+1,p.y-Math.min(9,2+p.vy*.016));ctx.stroke();return true;});ctx.restore();
      }
      ctx.save();clip(ctx);
      splashes=splashes.filter(p=>{p.age+=dt;if(p.age>p.life)return false;p.vy+=dt*380;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.strokeStyle='rgba(201,220,231,'+(.30*(1-p.age/p.life))+')';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.012,p.y-p.vy*.012);ctx.stroke();return true;});
      ctx.restore();
      if(time-lastReport>.25){
        lastReport=time;
        for(const panel of panels)Object.assign(panel.node.matches('.home-console')?canvas.dataset:panel.node.dataset,panel.report());
        canvas.dataset.umbrellaHits=umbrellaHits;canvas.dataset.umbrellaRunoffs=umbrellaRunoffs;
        canvas.dataset.shelter=panels.some(p=>p.node.matches('.home-console'))?'terminal':'none';
      }
    }
    function invalidate(){dirty=true;}
    addEventListener('scroll',invalidate,{passive:true});addEventListener('resize',invalidate);addEventListener('site-viewport',invalidate);
    let settleTimer=0;
    function pageReady(){bind();movingUntil=performance.now()+450;clearTimeout(settleTimer);settleTimer=setTimeout(invalidate,460);}
    document.addEventListener('terminal-catastrophe',()=>{movingUntil=performance.now()+2100;clearTimeout(settleTimer);settleTimer=setTimeout(invalidate,2110);});
    document.addEventListener('animationend',e=>{if(e.target.closest('#main'))dirty=true;});
    document.addEventListener('site-page-before',()=>{clearTimeout(settleTimer);resizeObserver.disconnect();reset();});addEventListener('site-page',pageReady);pageReady();
    return {set,measure,collide,clip,draw,invalidate};
  };
})();
