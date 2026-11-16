/* Thin surface water: pinned wet film, intermittent rivulets and gravity-driven drips. */
(() => {
  'use strict';
  const tau=Math.PI*2,rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  window.createWeatherSurfaces=function(canvas,compact){
    const layer=document.createElement('div');layer.className='weather-surfaces';layer.setAttribute('aria-hidden','true');layer.hidden=true;document.body.append(layer);
    let node=null,dragon=null,roof=null,umbrella=null,dirty=true,water=[],drops=[],splashes=[],snow=[],film=[],effect='clear',active=false,signature='';
    let hits=0,snowHits=0,runoffs=0,lastReport=0;
    const outlets=[{side:-1},{side:1}];
    function resetOutlet(o){Object.assign(o,{amount:0,delay:0,pendant:0,feed:0,flow:0,connected:false,pinching:0,released:0,threshold:rand(1.45,1.85)});}
    outlets.forEach(resetOutlet);
    // Sample the unchanged wallpaper once per viewport/theme, never per droplet.
    const background=new Image(),refraction=document.createElement('canvas'),optics=refraction.getContext('2d');
    let textureKey='';background.src='/assets/original-background.jpg';
    function prepareOptics(dark){
      if(!background.complete||!background.naturalWidth)return;
      const key=innerWidth+':'+innerHeight+':'+dark;if(key===textureKey)return;textureKey=key;
      refraction.width=innerWidth;refraction.height=innerHeight;
      const scale=Math.max(innerWidth/background.naturalWidth,innerHeight/background.naturalHeight)*1.045;
      const w=background.naturalWidth*scale,h=background.naturalHeight*scale;
      optics.filter='blur(3px)';optics.drawImage(background,(innerWidth-w)/2,(innerHeight-h)/2,w,h);optics.filter='none';
      optics.fillStyle=dark?'#060f20c4':'#e7f0fba8';optics.fillRect(0,0,innerWidth,innerHeight);
    }
    function clearWater(){water=[];drops=[];film=[];splashes=[];outlets.forEach(resetOutlet);dirty=true;}
    function reset(){clearWater();snow=[];roof=null;hits=snowHits=runoffs=0;dirty=true;}
    const resizeObserver=new ResizeObserver(()=>{dirty=true;});
    function bind(){const next=document.querySelector('.home-console');if(next!==node){resizeObserver.disconnect();node=next;reset();if(node)resizeObserver.observe(node);}}
    function set(next,hidden){
      if(next!==effect){effect=next;clearWater();if(next!=='snow')snow=[];}
      active=!hidden;layer.hidden=!active||!['rain','snow'].includes(effect);
      const nextSignature=effect+':'+active;
      if(signature!==nextSignature){signature=nextSignature;document.documentElement.dataset.weatherEffect=effect;document.documentElement.dataset.weatherActive=String(active);dispatchEvent(new CustomEvent('site-weather',{detail:{effect,active}}));}
    }
    function measure(){
      if(node&&!node.isConnected)bind();
      if(dirty){
        roof=null;
        if(node){const b=node.getBoundingClientRect();if(b.width>0){roof={x:b.x,y:b.y,w:b.width,h:b.height,r:Math.min(18,b.width/2,b.height/2)};const count=Math.ceil(b.width/7)+1;
          if(count!==snow.length){const old=snow;snow=Array.from({length:count},(_,i)=>old.length?old[Math.round(i*(old.length-1)/(count-1))]:0);}
          if(count!==film.length)film=new Array(count).fill(0);
        }}
        dirty=false;
      }
      if(!dragon||!dragon.isConnected)dragon=document.querySelector('.live2d-widget');
      umbrella=dragon&&!dragon.hidden?dragon._weatherShelter||null:null;
    }
    function top(x){const r=roof.r,l=x-roof.x;if(l<r)return roof.y+r-Math.sqrt(Math.max(0,r*r-(l-r)*(l-r)));if(l>roof.w-r)return roof.y+r-Math.sqrt(Math.max(0,r*r-(l-roof.w+r)*(l-roof.w+r)));return roof.y;}
    function depth(x){if(!roof||!snow.length)return 0;const t=clamp((x-roof.x)/roof.w*(snow.length-1),0,snow.length-1),i=Math.floor(t);return snow[i]*(1-(t-i))+(snow[Math.min(i+1,snow.length-1)]||0)*(t-i);}
    function splash(x,y,count=3){for(let i=0;i<count&&splashes.length<(compact.matches?24:60);i++)splashes.push({x,y,vx:rand(-42,42),vy:rand(-42,-12),age:0,life:rand(.12,.28)});}
    function wet(x,size){
      const at=Math.round(clamp(x/roof.w,0,1)*(film.length-1));
      for(let i=-2;i<=2;i++)if(at+i>=0&&at+i<film.length)film[at+i]=Math.min(1.8,film[at+i]+(.045+size*.028)*(1-Math.abs(i)/3));
    }
    function collide(p,oldX,oldY){
      if(roof&&p.x>=roof.x&&p.x<=roof.x+roof.w){
        const surface=top(p.x)-(effect==='snow'?depth(p.x)*.8:.5),previous=top(clamp(oldX,roof.x,roof.x+roof.w))-(effect==='snow'?depth(oldX)*.8:.5);
        if(oldY<=previous+1&&p.y>=surface){
          const fraction=clamp((surface-oldY)/(p.y-oldY||1),0,1),x=oldX+(p.x-oldX)*fraction;
          if(effect==='rain'){hits++;splash(x,surface);wet(x-roof.x,p.size);}
          else if(effect==='snow'){snowHits++;const n=Math.round((x-roof.x)/roof.w*(snow.length-1));for(let i=-2;i<=2;i++)if(n+i>=0&&n+i<snow.length)snow[n+i]=Math.min(12,snow[n+i]+p.size*.34*(1-Math.abs(i)/3));}
          return true;
        }
      }
      if(umbrella&&p.x>umbrella.x&&p.x<umbrella.x+umbrella.w){
        const u=(p.x-umbrella.x)/umbrella.w,level=umbrella.y+umbrella.h*(.07+.30*Math.pow((u-.5)*2,2));
        if(oldY<=level&&p.y>=level){if(effect==='rain')splash(p.x,level,2);return true;}
      }
      return false;
    }
    function rounded(ctx,x,y,w,h,r){ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
    function clip(ctx){
      // Independent subtraction keeps overlapping shelters opaque to precipitation.
      if(roof){ctx.beginPath();ctx.rect(-100,-100,innerWidth+200,innerHeight+200);rounded(ctx,roof.x,roof.y,roof.w,roof.h,roof.r);ctx.clip('evenodd');}
      if(umbrella){const b=umbrella;ctx.beginPath();ctx.rect(-100,-100,innerWidth+200,innerHeight+200);ctx.moveTo(b.x,b.y+b.h*.38);ctx.quadraticCurveTo(b.x+b.w*.5,b.y-b.h*.24,b.x+b.w,b.y+b.h*.38);ctx.lineTo(b.x+b.w,b.y+b.h);ctx.lineTo(b.x,b.y+b.h);ctx.closePath();ctx.clip('evenodd');}
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
    function draw(ctx,dt,time,dark){
      if(roof&&effect==='rain')rain(ctx,dt,time,dark);
      ctx.save();clip(ctx);
      splashes=splashes.filter(p=>{p.age+=dt;if(p.age>p.life)return false;p.vy+=dt*380;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.strokeStyle='rgba(201,220,231,'+(.30*(1-p.age/p.life))+')';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.012,p.y-p.vy*.012);ctx.stroke();return true;});
      ctx.restore();
      if(roof&&effect==='snow'&&roof.y<innerHeight&&roof.y+roof.h>0){
        for(let i=0;i<snow.length;i++)snow[i]=Math.min(12,snow[i]+dt*.11);
        ctx.save();ctx.shadowColor='rgba(12,32,52,.25)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
        const g=ctx.createLinearGradient(0,roof.y-13,0,roof.y+3);g.addColorStop(0,'#fff');g.addColorStop(1,'#c5d8e6');ctx.fillStyle=g;ctx.beginPath();
        for(let i=0;i<snow.length;i++){const x=roof.x+i/(snow.length-1)*roof.w,edge=Math.min(1,i/2,(snow.length-1-i)/2),y=top(x)-snow[i]*edge*(.92+.08*Math.sin(i*2.4));if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
        for(let i=snow.length-1;i>=0;i--){const x=roof.x+i/(snow.length-1)*roof.w;ctx.lineTo(x,top(x)+.7);}
        ctx.closePath();ctx.fill();ctx.restore();
      }
      if(time-lastReport>.25){lastReport=time;canvas.dataset.rainHits=String(hits);canvas.dataset.snowHits=String(snowHits);canvas.dataset.runoffs=String(runoffs);canvas.dataset.waterStreams=String(water.filter(p=>!p.spent).length);canvas.dataset.waterFilm=film.reduce((a,b)=>a+b,0).toFixed(2);canvas.dataset.waterPendant=outlets.map(o=>o.pendant.toFixed(2)).join(',');canvas.dataset.waterFlow=outlets.map(o=>o.flow.toFixed(2)).join(',');canvas.dataset.snowDepth=(snow.length?Math.max(...snow):0).toFixed(2);canvas.dataset.shelter=roof?'terminal':'none';}
    }
    addEventListener('scroll',()=>{dirty=true;},{passive:true});addEventListener('resize',()=>{dirty=true;});
    let settleTimer=0;
    function pageReady(){bind();clearTimeout(settleTimer);settleTimer=setTimeout(()=>{dirty=true;},900);}
    document.addEventListener('animationend',e=>{if(e.target.closest('#main'))dirty=true;});
    document.addEventListener('site-page-before',()=>{clearTimeout(settleTimer);resizeObserver.disconnect();node=null;reset();});addEventListener('site-page',pageReady);pageReady();
    return {set,measure,collide,clip,draw};
  };
})();
