/* Thin surface water: pinned wet film, intermittent rivulets and gravity-driven drips. */
(() => {
  'use strict';
  const tau=Math.PI*2,rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  window.createWeatherSurfaces=function(canvas,compact){
    const layer=document.createElement('div');layer.className='weather-surfaces';layer.setAttribute('aria-hidden','true');layer.hidden=true;document.body.append(layer);
    let dragon=null,umbrella=null,dirty=true,splashes=[],effect='clear',active=false,signature='';
    let lastReport=0,movingUntil=0,umbrellaHits=0,umbrellaRunoffHits=0,umbrellaRunoffs=0,canopyDrops=[];
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
    function reset(){panels.forEach(panel=>panel.remove());panels=[];splashes=[];dirty=true;}
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
    function splash(target,x,y,count=3){for(let i=0;i<count&&target.length<(compact.matches?24:60);i++)target.push({x,y,vx:rand(-42,42),vy:rand(-42,-12),age:0,life:rand(.12,.28)});}
    function drawSplashes(ctx,particles,dt){
      return particles.filter(p=>{
        p.age+=dt;if(p.age>p.life)return false;
        p.vy+=dt*380;p.x+=p.vx*dt;p.y+=p.vy*dt;
        ctx.strokeStyle='rgba(201,220,231,'+(.30*(1-p.age/p.life))+')';ctx.lineWidth=.55;
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.012,p.y-p.vy*.012);ctx.stroke();return true;
      });
    }
    function canopyHit(p,oldX,oldY){
      if(!umbrella||p.y<=oldY||Math.max(oldX,p.x)<umbrella.x||Math.min(oldX,p.x)>umbrella.x+umbrella.w||p.bounce===2)return null;
      const dx=p.x-oldX,dy=p.y-oldY,points=umbrella.curve;
      for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],ex=b.x-a.x,ey=b.y-a.y,den=dx*ey-dy*ex;if(Math.abs(den)<.00001)continue;
        const ax=a.x-oldX,ay=a.y-oldY,t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
        if(t>=0&&t<=1&&u>=0&&u<=1)return {x:oldX+dx*t,y:oldY+dy*t,t,side:i<=points.length/2?0:1};
      }return null;
    }
    function collide(p,oldX,oldY,source=null){
      const canopy=canopyHit(p,oldX,oldY);
      let nearest=null, owner=null;
      if(effect!=='hail'&&p.y>oldY)for(const panel of panels){
        if(panel.node===source)continue;
        const hit=panel.crossing(p,oldX,oldY);
        if(hit&&(!nearest||hit.t<nearest.t)){nearest=hit;owner=panel;}
      }
      if(nearest&&(!canopy||nearest.t<=canopy.t)){owner.deposit(nearest,p.size);return true;}
      if(canopy){
        touchCanopy(canopy,p.size,source);
        if(effect==='hail'){p.x=canopy.x;p.y=canopy.y-2;p.speed=-rand(90,180);p.vx=canopy.side?rand(10,25):rand(-25,-10);p.bounce=2;}
        return true;
      }
      return false;
    }
    function touchCanopy(hit,size,source){
      umbrellaHits++;
      if(source&&effect==='rain')umbrellaRunoffHits++;
      umbrella.impact=Math.min(1,umbrella.impact+(effect==='hail' ? .4 : source ? .16 : .025));
      if(effect==='rain'){
        splash(splashes,hit.x,hit.y,source?6:2);
        canopyWater[hit.side]+=source ? .25+size*.12 : .1+size*.04;
      }
      if(effect==='snow')umbrella.snow=Math.min(3,umbrella.snow+size*.12);
    }
    function rounded(ctx,x,y,w,h,r){ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
    function clip(ctx){
      // Independent subtraction keeps overlapping shelters opaque to precipitation.
      if(effect!=='hail')for(const panel of panels)panel.mask(ctx);
      if(umbrella){const points=umbrella.curve,left=points[0],right=points[points.length-1],bottom=Math.max(innerHeight+100,umbrella.bottom),drift=effect==='snow'?0:-.125;ctx.beginPath();ctx.rect(-1000,-1000,innerWidth+2000,innerHeight+2000);ctx.moveTo(left.x,left.y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.lineTo(right.x+(bottom-right.y)*drift,bottom);ctx.lineTo(left.x+(bottom-left.y)*drift,bottom);ctx.closePath();ctx.clip('evenodd');}
    }
    function createPanel(node){
      const surface=document.createElement('canvas'),surfaceCtx=surface.getContext('2d');
      surface.className='weather-panel-surface';
      surface.setAttribute('aria-hidden','true');
      surface.hidden=true;
      node.append(surface);
      const pad=25;
      let roof=null,water=[],drops=[],snow=[],film=[],spray=[],hits=0,snowHits=0,runoffs=0;
      let snowChunks=[],powder=[],snowMotion=null,snowLandings=0;
      const outlets=[{side:-1},{side:1}];
      outlets.forEach(resetOutlet);
      function clear(){
        water=[];drops=[];film=[];snow=[];spray=[];snowChunks=[];powder=[];
        snowMotion?.remove();snowMotion=null;
        outlets.forEach(resetOutlet);surface.hidden=true;surface.width=0;
      }
      function measurePanel(){
        const b=node.getBoundingClientRect();
        if(!b.width||!b.height){roof=null;return;}
        const radius=parseFloat(getComputedStyle(node).borderTopLeftRadius)||0;
        roof={x:b.x,y:b.y,w:b.width,h:b.height,r:Math.max(.01,Math.min(radius,b.width/2,b.height/2))};
        const left=-(pad+node.clientLeft)+'px',top=-(pad+node.clientTop)+'px';
        if(surface.style.left!==left)surface.style.left=left;
        if(surface.style.top!==top)surface.style.top=top;
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
        if(rain){hits++;splash(spray,hit.x-roof.x,hit.y-roof.y);}else snowHits++;
      }
      function mask(ctx,bounds){
        if(!roof)return;
        ctx.beginPath();
        if(bounds)ctx.rect(bounds.x-pad,bounds.y-pad,bounds.w+pad*2,bounds.h+pad+465);
        else ctx.rect(-100,-100,innerWidth+200,innerHeight+200);
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
      ctx.save();
      for(const panel of panels)panel.mask(ctx,roof);
      ctx.lineJoin='round';ctx.lineCap='round';
      for(let i=1;i<film.length;i++){
        const x=roof.x+(i-1)/(film.length-1)*roof.w,nx=roof.x+i/(film.length-1)*roof.w,amount=(film[i]+film[i-1])/2;
        if(amount<.015)continue;
        ctx.strokeStyle='rgba(165,191,205,'+Math.min(.25,amount*.28)+')';ctx.lineWidth=.6+amount*.6;
        ctx.beginPath();ctx.moveTo(x,top(x)-.5-film[i-1]*.38);ctx.lineTo(nx,top(nx)-.5-film[i]*.38);ctx.stroke();
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
        for(let i=1;i<p.trail.length;i++){
          const a=p.trail[i-1],b=p.trail[i],pa=edge(a.d,p.side,p.phase),pb=edge(b.d,p.side,p.phase),fade=Math.pow(1-a.age/3.2,1.5),pulse=.75+.25*Math.sin(a.d*.11+p.phase);
          ctx.lineWidth=(.5+p.mass*.4)*pulse;ctx.strokeStyle='rgba(184,211,224,'+(.26*fade)+')';ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
        }
        if(!p.spent&&p.d<end){const at=edge(p.d,p.side,p.phase);lens(ctx,at.x,at.y,1+p.mass*.35,(1.4+p.mass*.35)*(1+p.v/130));}
      }
      for(let i=0;i<water.length;i++)for(let j=i+1;j<water.length;j++){const a=water[i],b=water[j];if(!a.spent&&!b.spent&&a.side===b.side&&Math.abs(a.d-b.d)<5){a.mass+=b.mass;a.v=Math.max(a.v,b.v);a.d=Math.max(a.d,b.d);b.spent=true;}}
      water=water.filter(p=>!p.spent||p.trail.length);
      for(const o of outlets){
        const at=edge(end,o.side,0),jet=o.flow>.12;
        if(jet){
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
        if(o.flow<.65)pendant(ctx,at,o,time);
      }
      drops=drops.filter(p=>{
        const x=roof.x+p.x,oldY=roof.y+p.y;
        p.age+=dt;p.y+=p.vy*dt+390*dt*dt;p.vy+=dt*780;
        const y=roof.y+p.y;
        if(p.age>.8||collide({x,y,size:p.rx},x,oldY,node))return false;
        lens(ctx,x,y,p.rx*(1-.22*Math.min(1,p.age*3)),p.rx*(1+Math.min(.8,p.vy/380)));
        return true;
      });
      ctx.translate(roof.x,roof.y);
      spray=drawSplashes(ctx,spray,dt);
      ctx.restore();
    }
    function drawPanel(dt,time,dark){
      if(!roof||!surfaceCtx||!['rain','snow'].includes(effect))return;
      const rainfall=effect==='rain';
      if(!rainfall&&(snowChunks.length||powder.length||snowMotion))drawFallingSnow(dt);
      const width=Math.ceil(roof.w)+pad*2;
      // Round up to avoid reallocating the backing store throughout a height transition.
      const height=rainfall?Math.ceil((roof.h+pad+400)/64)*64:Math.ceil(roof.r)+pad+4;
      if(roof.y-pad>innerHeight||roof.y-pad+height<0)return;
      const ratio=Math.min(devicePixelRatio||1,1.5);
      const pixelsWide=Math.round(width*ratio),pixelsHigh=Math.round(height*ratio);
      if(surface.width!==pixelsWide||surface.height!==pixelsHigh){
        surface.width=pixelsWide;surface.height=pixelsHigh;
        surface.style.width=width+'px';surface.style.height=height+'px';
      }
      surfaceCtx.setTransform(1,0,0,1,0,0);
      surfaceCtx.clearRect(0,0,pixelsWide,pixelsHigh);
      // Keep existing collision and refraction math in viewport coordinates, but
      // paint to card-local pixels so the browser moves them with the card.
      const sx=pixelsWide/width,sy=pixelsHigh/height;
      surfaceCtx.setTransform(sx,0,0,sy,(pad-roof.x)*sx,(pad-roof.y)*sy);
      if(rainfall)rain(surfaceCtx,dt,time,dark);
      else drawSnow(surfaceCtx,dt);
      surface.hidden=false;
    }
    function report(){return {rainHits:hits,snowHits,snowLandings,runoffs,waterStreams:water.filter(p=>!p.spent).length,waterFilm:film.reduce((a,b)=>a+b,0).toFixed(2),waterPendant:outlets.map(o=>o.pendant.toFixed(2)).join(','),waterFlow:outlets.map(o=>o.flow.toFixed(2)).join(','),snowDepth:(snow.length?Math.max(...snow):0).toFixed(2)};}
    return {node,measure:measurePanel,mask,crossing,deposit,clear,draw:drawPanel,report,moveSnow,remove(){
      surface.remove();
      snowMotion?.remove();
    }};
    function scatter(x,y,amount,direction=0){
      for(let i=0;i<amount&&powder.length<84;i++){
        powder.push({
          x:x+rand(-4,4),y:y+rand(-2,0),vx:direction*rand(15,50)+rand(-23,23),
          vy:rand(-52,-16),size:rand(.8,2.5),age:0,life:rand(.32,.65)
        });
      }
    }
    function moveSnow(expanding){
      if(!roof||!snow.length)return;
      const dx=scrollX,dy=scrollY,step=roof.w/(snow.length-1);
      if(!expanding){
        const first=snow.findIndex(value=>value>.45);
        if(first===-1)return;
        let last=snow.length-1;
        while(last>first&&snow[last]<=.45)last--;
        for(const side of [-1,1]){
          const i=side<0?first:last;
          const x=roof.x+i*step;
          scatter(x+dx,top(x)+dy-snow[i]*.55,7,side);
          snow[i]*=.8;
        }
        return;
      }
      // Detached snow keeps the old roof's page coordinates as the card moves.
      let index=0;
      while(index<snow.length-1&&snowChunks.length<64){
        const end=Math.min(snow.length-1,index+Math.round(rand(2,5)));
        const x=roof.x+(index+end)*step/2;
        const y=top(x);
        const samples=snow.slice(index,end+1).map((depth,i)=>{
          const sampleX=roof.x+(index+i)*step;
          const taper=Math.min(1,(index+i)/2,(snow.length-1-index-i)/2);
          return {x:sampleX-x,y:top(sampleX)-y,depth:depth*taper};
        });
        if(samples.some(sample=>sample.depth>.45)){
          snowChunks.push({x:x+dx,y:y+dy,vx:rand(-5,5),vy:0,
            wait:rand(0,.07),age:0,released:false,lastRoof:y+dy,samples});
        }
        index=end;
      }
      snow.fill(0);
    }
    function drawFallingSnow(dt){
      const dx=scrollX,dy=scrollY,step=roof.w/(snow.length-1);
      snowChunks=snowChunks.filter(chunk=>{
        chunk.age+=dt;
        if(chunk.age>1.5)return false;
        const localX=chunk.x-dx;
        const supported=localX>=roof.x&&localX<=roof.x+roof.w;
        const support=supported?top(localX)+dy-depth(localX)*.64:Infinity;
        if(!chunk.released){
          if(chunk.age<chunk.wait||support-chunk.y<2&&chunk.age<.16)return true;
          chunk.released=true;
        }
        const oldX=chunk.x,oldY=chunk.y;
        chunk.x+=chunk.vx*dt;
        chunk.y+=chunk.vy*dt+370*dt*dt;
        chunk.vy+=740*dt;
        const hit=canopyHit({x:chunk.x-dx,y:chunk.y-dy},oldX-dx,oldY-dy);
        const lands=supported&&chunk.y>=support&&oldY<=Math.max(support,chunk.lastRoof)+2;
        if(hit&&(!lands||hit.y+dy<support)){
          touchCanopy(hit,4,node);
          scatter(hit.x+dx,hit.y+dy,5,hit.side?1:-1);
          return false;
        }
        chunk.lastRoof=support;
        if(!lands)return true;
        for(const sample of chunk.samples){
          const x=chunk.x+sample.x-dx;
          if(x<roof.x||x>roof.x+roof.w)continue;
          const i=Math.round((x-roof.x)/step);
          snow[i]=Math.min(12,snow[i]+sample.depth*.86);
        }
        snowLandings++;
        if(chunk.vy>65)scatter(chunk.x,support-1,3);
        return false;
      });
      powder=powder.filter(bit=>{
        bit.age+=dt;
        bit.x+=bit.vx*dt;bit.y+=bit.vy*dt+180*dt*dt;bit.vy+=360*dt;
        return bit.age<bit.life;
      });
      if(!snowChunks.length&&!powder.length){snowMotion?.remove();snowMotion=null;return;}
      let left=Infinity,topEdge=Infinity,right=-Infinity,bottom=-Infinity;
      function include(x,y,margin){
        left=Math.min(left,x-margin);right=Math.max(right,x+margin);
        topEdge=Math.min(topEdge,y-margin);bottom=Math.max(bottom,y+margin);
      }
      for(const chunk of snowChunks)for(const sample of chunk.samples)
        include(chunk.x+sample.x,chunk.y+sample.y,sample.depth+3);
      for(const bit of powder)include(bit.x,bit.y,4);
      if(right<dx||left>dx+innerWidth||bottom<dy||topEdge>dy+innerHeight){
        if(snowMotion)snowMotion.hidden=true;
        return;
      }
      if(!snowMotion){
        snowMotion=document.createElement('canvas');
        snowMotion.className='weather-panel-surface weather-panel-snow-motion';
        snowMotion.setAttribute('aria-hidden','true');
        node.append(snowMotion);
      }
      const width=Math.ceil((right-left)/48)*48,height=Math.ceil((bottom-topEdge)/48)*48;
      const ratio=Math.min(devicePixelRatio||1,1.5);
      const w=Math.round(width*ratio),h=Math.round(height*ratio);
      if(snowMotion.width!==w||snowMotion.height!==h){snowMotion.width=w;snowMotion.height=h;}
      Object.assign(snowMotion.style,{
        width:width+'px',height:height+'px',
        left:(left-dx-roof.x-node.clientLeft)+'px',top:(topEdge-dy-roof.y-node.clientTop)+'px'
      });
      snowMotion.hidden=false;
      const ctx=snowMotion.getContext('2d');
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
      ctx.setTransform(w/width,0,0,h/height,(dx-left)*w/width,(dy-topEdge)*h/height);
      for(const panel of panels)panel.mask(ctx);
      for(const chunk of snowChunks){
        const x=chunk.x-dx,y=chunk.y-dy;
        const gradient=ctx.createLinearGradient(0,y-12,0,y+4);
        gradient.addColorStop(0,'#fff');gradient.addColorStop(1,'#c5d8e6');
        ctx.fillStyle=gradient;ctx.beginPath();
        chunk.samples.forEach((sample,i)=>{
          const edge=i===0||i===chunk.samples.length-1;
          const pointY=y+sample.y-sample.depth*(edge?.67:1);
          if(i)ctx.lineTo(x+sample.x,pointY);else ctx.moveTo(x+sample.x,pointY);
        });
        for(let i=chunk.samples.length-1;i>=0;i--){
          const s=chunk.samples[i];
          ctx.lineTo(x+s.x,y+s.y+Math.min(1.5,s.depth*.25));
        }
        ctx.closePath();ctx.fill();
      }
      ctx.fillStyle='#edf7ff';
      for(const bit of powder){
        ctx.globalAlpha=Math.min(1,(1-bit.age/bit.life)*1.6)*.85;
        ctx.beginPath();ctx.arc(bit.x-dx,bit.y-dy,bit.size,0,tau);ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    function drawSnow(ctx,dt){
      for(let i=0;i<snow.length;i++)snow[i]=Math.min(12,snow[i]+dt*.11);
      if(snowChunks.length&&!snow.some(value=>value>.18))return;
      ctx.save();ctx.shadowColor='rgba(12,32,52,.25)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
      const g=ctx.createLinearGradient(0,roof.y-13,0,roof.y+3);g.addColorStop(0,'#fff');g.addColorStop(1,'#c5d8e6');ctx.fillStyle=g;ctx.beginPath();
      for(let i=0;i<snow.length;i++){const x=roof.x+i/(snow.length-1)*roof.w,edge=Math.min(1,i/2,(snow.length-1-i)/2),y=top(x)-snow[i]*edge*(.92+.08*Math.sin(i*2.4));if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
      for(let i=snow.length-1;i>=0;i--){const x=roof.x+i/(snow.length-1)*roof.w;ctx.lineTo(x,top(x)+.7);}
      ctx.closePath();ctx.fill();ctx.restore();
    }
    }
    function draw(ctx,dt,time,dark){
      for(const panel of panels)panel.draw(dt,time,dark);
      if(umbrella&&effect==='rain'){
        for(let i=0;i<2;i++)if(canopyWater[i]>=.65&&canopyDrops.length<20){const p=umbrella.curve[i?16:0];canopyWater[i]-=.65;canopyDrops.push({x:p.x,y:p.y+2,vy:28,age:0,side:i?1:-1,scale:umbrella.scale});umbrellaRunoffs++;}
        ctx.save();for(const panel of panels)panel.mask(ctx);
        canopyDrops=canopyDrops.filter(p=>{p.age+=dt;if(p.age>1)return false;p.vy+=dt*560;p.y+=dt*p.vy;p.x+=dt*(p.side*6-12);ctx.strokeStyle='rgba(198,226,243,'+(.6*(1-p.age))+')';ctx.lineWidth=Math.max(.6,Math.min(2,p.scale));ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+1,p.y-Math.min(9,2+p.vy*.016));ctx.stroke();return true;});ctx.restore();
      }
      ctx.save();clip(ctx);
      splashes=drawSplashes(ctx,splashes,dt);
      ctx.restore();
      if(time-lastReport>.25){
        lastReport=time;
        for(const panel of panels)Object.assign(panel.node.matches('.home-console')?canvas.dataset:panel.node.dataset,panel.report());
        canvas.dataset.umbrellaHits=umbrellaHits;canvas.dataset.umbrellaRunoffs=umbrellaRunoffs;
        canvas.dataset.umbrellaRunoffHits=umbrellaRunoffHits;
        canvas.dataset.shelter=panels.some(p=>p.node.matches('.home-console'))?'terminal':'none';
      }
    }
    function invalidate(){dirty=true;}
    addEventListener('scroll',invalidate,{passive:true});addEventListener('resize',invalidate);addEventListener('site-viewport',invalidate);
    document.addEventListener('home-network-resize',event=>{
      if(!active||(effect!=='snow'&&effect!=='rain'))return;
      const panel=panels.find(item=>item.node===event.target);
      if(!panel)return;
      if(effect==='snow'){panel.measure();panel.moveSnow(event.detail.expanded);}
      movingUntil=Math.max(movingUntil,performance.now()+520);
      invalidate();
    });
    let settleTimer=0;
    function pageReady(){bind();movingUntil=performance.now()+450;clearTimeout(settleTimer);settleTimer=setTimeout(invalidate,460);}
    document.addEventListener('terminal-catastrophe',()=>{movingUntil=performance.now()+2100;clearTimeout(settleTimer);settleTimer=setTimeout(invalidate,2110);});
    document.addEventListener('animationend',e=>{if(e.target.closest('#main'))dirty=true;});
    document.addEventListener('site-page-before',()=>{clearTimeout(settleTimer);resizeObserver.disconnect();reset();});addEventListener('site-page',pageReady);pageReady();
    return {set,measure,collide,clip,draw,invalidate,geometryChanged:()=>panels.length>0&&(dirty||performance.now()<movingUntil)};
  };
})();
