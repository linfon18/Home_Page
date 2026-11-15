(() => {
  'use strict';
  const desktop=matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const toggle=document.querySelector('[data-live2d-toggle]');if(!toggle)return;
  const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n)),random=(a,b)=>a+Math.random()*(b-a),tau=Math.PI*2;
  let app=null,model=null,widget=null,animator=null,loading=false,hidden=false,awayAt=0;
  let selectionTimer=0,selecting=false,lastSelection='';
  try{hidden=localStorage.getItem('linfon-live2d')==='hidden';}catch(_){}
  function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=reject;document.head.append(el);});}
  function state(){
    const visible=desktop.matches&&!hidden&&!document.hidden&&!document.querySelector('dialog[open]');
    toggle.setAttribute('aria-pressed',String(!hidden));toggle.setAttribute('aria-label',hidden?'显示 Live2D':'隐藏 Live2D');
    if(!widget)return;widget.hidden=!visible;
    if(!visible){lastSelection='';if(animator)animator.clearGesture();}
    if(app){if(visible&&!reduced.matches)app.start();else{app.stop();if(visible)app.renderer.render(app.stage);}}
  }
  function layout(){
    if(!app||!model)return;const width=widget.clientWidth,height=widget.clientHeight;if(!width||!height)return;
    app.renderer.resize(width,height);model.scale.set(1);
    const scale=Math.min(width*.98/model.width,height*.98/model.height);model.scale.set(scale);model.anchor.set(.5,1);model.position.set(width/2,height);app.renderer.render(app.stage);
  }
  function createAnimator(){
    const core=model.internalModel.coreModel;
    const indices=new Map(core._parameterIds.map((id,i)=>[id,i]));
    const faces=['ParamCheek','Param63','Param3','Param4','Param5','Param6','Param7','Param8','ParamEyeLSmile','ParamEyeRSmile','ParamMouthForm','ParamMouthOpenY','ParamBrowLY','ParamBrowRY','ParamBrowLAngle','ParamBrowRAngle'];
    const offsets=['ParamAngleX','ParamAngleY','ParamAngleZ','ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ','ParamEyeBallX','ParamEyeBallY','Param9','Param10','Param11','Param12','Param59','Param60','Param61','Param62','Param55','Param57'];
    const blend={},lastByZone={},bags={},idleNames=['look','tilt','stretch','ear-idle','hum','yawn'];let idleBag=[],lastIdle='';
    const pools={head:['head','happy','shy'],face:['wink','blush','surprise'],ear:['ear','curious'],body:['body','bounce','curious','tail'],wing:['wing','proud'],tail:['tail','startled']};
    const duration={angry:6000,dizzy:3000,love:2400,pet:2600,wing:2300,tail:2100,stretch:3400,yawn:3800,look:3300,tilt:2600,'ear-idle':2200,hum:3300,inspect:6200};
    const magnifier=widget.querySelector('.dragon-magnifier'),lensText=magnifier.querySelector('text');
    const handIndex=core.getDrawableIndex('ArtMesh102');let selectionTarget=null;
    let action=null,actionTimer=0,lastElapsed=model.elapsedTime,wing=0,tail=0,nextIdle=model.elapsedTime+1500,serial=0,force=false;
    let nextEar=model.elapsedTime+random(2200,4200),earStart=-10000,earSide=1,lastNotice=-15000,lastContext=-15000;
    let stroke=null,lastHitAt=0,lastPetAt=-5000,clicks=[],spamUntil=0;
    function set(id,value){const i=indices.get(id);if(i!==undefined)core.setParameterValueByIndex(i,clamp(value,core._parameterMinimumValues[i],core._parameterMaximumValues[i]));}
    function add(id,value){const i=indices.get(id);if(i!==undefined)set(id,core.getParameterValueByIndex(i)+value);}
    function shuffle(items){for(let n=items.length-1;n>0;n--){const j=Math.floor(Math.random()*(n+1));[items[n],items[j]]=[items[j],items[n]];}return items;}
    function choose(zone){
      const options=pools[zone]||pools.body,last=lastByZone[zone];
      if(!last){bags[zone]=shuffle(options.slice(1));lastByZone[zone]=options[0];return options[0];}
      if(!bags[zone].length){bags[zone]=shuffle(options.slice());const end=bags[zone].length-1;if(bags[zone][end]===last)[bags[zone][0],bags[zone][end]]=[bags[zone][end],bags[zone][0]];}
      return lastByZone[zone]=bags[zone].pop();
    }
    function clearGesture(){stroke=null;clicks=[];if(action&&action.kind==='inspect'){clearAction();renderOnce();}}
    function clearAction(){clearTimeout(actionTimer);action=null;selectionTarget=null;magnifier.hidden=true;lensText.textContent='';delete widget.dataset.reaction;delete widget.dataset.activity;widget.classList.remove('is-angry');}
    function renderOnce(){if(reduced.matches){force=true;model.update(1);app.renderer.render(app.stage);force=false;}}
    function begin(kind,side=1,idle=false,origin='interaction'){
      if(widget.hidden||action&&action.kind==='angry'&&kind!=='angry')return false;
      if(action&&action.kind==='dizzy'&&!idle&&kind!=='angry')return false;
      clearAction();const length=duration[kind]||1800;action={kind,side,start:model.elapsedTime,duration:length,idle,origin};
      widget.dataset[idle?'activity':'reaction']=kind;widget.dataset.motion=String(++serial);widget.classList.toggle('is-angry',kind==='angry');
      nextIdle=model.elapsedTime+length+random(2200,4500);actionTimer=setTimeout(()=>{clearAction();renderOnce();},length+200);renderOnce();return true;
    }
    function context(kind,side=1){
      const now=performance.now();if(reduced.matches||now-lastContext<9000||action&&!action.idle)return false;
      if(begin(kind,side,false,'context')){lastContext=now;return true;}return false;
    }
    function notice(){const now=performance.now();if(now-lastNotice>14000&&context('happy'))lastNotice=now;}
    function inspect(text,rect){
      if(!text){if(action&&action.kind==='inspect'){clearAction();renderOnce();}return false;}
      if(!begin('inspect',-1,false,'selection'))return false;
      selectionTarget={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      lensText.textContent=Array.from(text.replace(/\s+/g,' ')).slice(0,12).join('');magnifier.hidden=false;renderOnce();return true;
    }
    function holdMagnifier(){
      if(!action||action.kind!=='inspect'||handIndex<0)return;
      // Follow the distal arm mesh rather than a fixed screen coordinate.
      const vertices=model.internalModel.getDrawableVertices(handIndex);let bottom=-Infinity;
      for(let n=1;n<vertices.length;n+=2)bottom=Math.max(bottom,vertices[n]);
      let x=0,y=0,count=0;
      for(let n=0;n<vertices.length;n+=2){if(vertices[n+1]>=bottom-model.internalModel.originalHeight*.018){x+=vertices[n];y+=vertices[n+1];count++;}}
      if(!count)return;
      const point=model.toGlobal(model.internalModel.localTransform.apply(new PIXI.Point(x/count,y/count)));
      const scale=widget.clientHeight/310;
      magnifier.style.width=74*scale+'px';magnifier.style.height=110*scale+'px';
      magnifier.style.transform='translate('+(point.x-14*scale)+'px,'+(point.y-98*scale)+'px)';
    }
    function burst(kind,x,y){
      if(reduced.matches||!['pet','love','happy','proud','surprise','dizzy'].includes(kind))return;
      const count=kind==='love'||kind==='pet'?5:4,symbol=kind==='love'||kind==='pet'?'♥':kind==='dizzy'?'·':'✦';
      for(let n=0;n<count;n++){
        if(widget.querySelectorAll('.dragon-spark').length>=12)break;
        const spark=document.createElement('span');spark.className='dragon-spark'+(symbol==='♥'?' is-heart':'');spark.textContent=symbol;spark.setAttribute('aria-hidden','true');
        spark.style.left=x+'px';spark.style.top=y+'px';spark.style.setProperty('--spark-x',random(-42,42)+'px');spark.style.setProperty('--spark-y',random(-65,-30)+'px');spark.style.setProperty('--spark-turn',random(-35,35)+'deg');spark.style.animationDelay=n*.04+'s';widget.append(spark);setTimeout(()=>spark.remove(),1700);
      }
    }
    function tap(hit,event){
      const now=performance.now();widget.dataset.taps=String(Number(widget.dataset.taps||0)+1);widget.dataset.zone=hit.zone;if(now<spamUntil)return;
      clicks=clicks.filter(time=>now-time<1600);clicks.push(now);
      const kind=clicks.length>=5?'dizzy':event.detail===2?'love':choose(hit.zone);
      if(kind==='dizzy'){spamUntil=now+3200;clicks=[];}
      if(begin(kind,hit.side))burst(kind,hit.x,hit.y);
    }
    function strokeAt(hit,x,y){
      const now=performance.now();if(!hit||!['head','face','ear'].includes(hit.zone)||reduced.matches){stroke=null;return;}
      if(!stroke||now-stroke.time>380)stroke={x,y,time:now,distance:0,steps:0};
      const distance=Math.hypot(x-stroke.x,y-stroke.y);stroke.distance+=Math.min(distance,30);stroke.steps+=distance>2?1:0;stroke.x=x;stroke.y=y;stroke.time=now;
      if(stroke.distance>64&&stroke.steps>=5&&now-lastPetAt>2100){if(begin('pet',hit.side)){lastPetAt=now;burst('pet',hit.x,hit.y);}stroke=null;}
    }
    function pose(kind,p,side){
      const attack=clamp(p/.15),release=clamp((1-p)/.2),e=Math.sin(attack*Math.PI/2)*Math.sin(release*Math.PI/2),w=Math.sin(p*tau*2),t={wingSpeed:.9,tailSpeed:1.3,wingAmp:.36,tailAmp:.65,closeL:0,closeR:0,lift:0};
      const smile=a=>{t.ParamMouthForm=a*e;t.ParamEyeLSmile=a*.75*e;t.ParamEyeRSmile=a*.75*e;};
      const eyes=a=>{t.closeL=a*e;t.closeR=a*e;};
      const ears=a=>{t.Param9=a*e;t.Param59=a*e;t.Param11=Math.sin(p*tau*5)*a*e;t.Param62=-t.Param11;};
      switch(kind){
        case 'head':smile(.85);eyes(.55);t.ParamAngleY=-7*e;t.ParamAngleZ=side*6*e;t.tailSpeed=2;t.tailAmp=.7;ears(.3);break;
        case 'happy':case 'hum':smile(.9);eyes(kind==='hum'?.6:.25);t.ParamAngleY=w*3*e;t.ParamBodyAngleZ=w*2*e;t.ParamMouthOpenY=(.12+Math.abs(w)*.1)*e;t.tailSpeed=2;break;
        case 'shy':case 'blush':smile(.55);t.ParamCheek=e;t.ParamAngleY=-9*e;t.ParamAngleZ=side*9*e;t.ParamEyeBallX=-side*.5*e;t.ParamEyeBallY=-.4*e;eyes(.2);ears(-.3);break;
        case 'pet':case 'love':smile(1);t.Param4=e;t.ParamCheek=.75*e;t.ParamAngleZ=Math.sin(p*tau)*7*e;t.ParamAngleY=-5*e;t.tailSpeed=3;t.tailAmp=.9;ears(.45);break;
        case 'wink':smile(.9);t[side<0?'closeR':'closeL']=e*.98;t.ParamCheek=.55*e;t.ParamAngleZ=side*7*e;t.ParamBrowLY=.25*e;break;
        case 'surprise':t.Param6=e;t.ParamMouthOpenY=.45*e;t.ParamBrowLY=.7*e;t.ParamBrowRY=.7*e;t.ParamAngleY=5*e;t.lift=3*Math.sin(p*Math.PI);break;
        case 'ear':case 'ear-idle':smile(.4);t.ParamAngleZ=side*6*e;ears(.65);t.Param10=side*Math.sin(p*tau*3)*.65*e;t.Param60=-t.Param10;break;
        case 'wing':case 'proud':case 'stretch':t.wingSpeed=kind==='wing'?8:3.5;t.wingAmp=.95;t.tailSpeed=1.6;t.ParamAngleY=6*e;t.ParamBodyAngleY=3*e;smile(.75);if(kind==='stretch')eyes(.7);else t.Param6=(kind==='proud'?1:.5)*e;ears(.3);break;
        case 'tail':t.tailSpeed=8;t.tailAmp=1;t.ParamAngleX=-side*16*e;t.ParamEyeBallX=-side*.7*e;t.ParamBodyAngleZ=side*3*e;smile(.6);ears(.35);break;
        case 'startled':t.Param3=.8*e;t.ParamMouthForm=-.4*e;t.ParamMouthOpenY=.3*e;t.ParamAngleZ=Math.sin(p*tau*5)*4*e;t.tailSpeed=5;t.tailAmp=.95;ears(-.4);break;
        case 'body':case 'bounce':smile(.85);eyes(.4);t.ParamBodyAngleZ=w*4*e;t.ParamAngleZ=-w*5*e;t.ParamMouthOpenY=.18*Math.abs(w)*e;t.wingAmp=.6;t.lift=kind==='bounce'?Math.abs(w)*6*e:0;break;
        case 'curious':case 'tilt':t.ParamAngleZ=side*12*e;t.ParamAngleY=-3*e;t.ParamEyeBallX=side*.45*e;t.ParamBrowLY=.55*e;t.ParamBrowRY=.15*e;smile(.35);break;
        case 'inspect':t.ParamAngleZ=-8*e;t.ParamAngleY=-4*e;t.ParamBodyAngleZ=-2*e;t.ParamBrowLY=.5*e;t.ParamBrowRY=.3*e;t.ParamMouthForm=.25*e;t.Param55=-16*e;t.Param57=12*e;t.wingAmp=.18;t.tailSpeed=.65;ears(.25);break;
        case 'dizzy':t.Param5=e;t.ParamAngleZ=Math.sin(p*tau*3)*10*e;t.ParamBodyAngleZ=-Math.sin(p*tau*3)*4*e;t.ParamMouthOpenY=.18*e;ears(-.5);break;
        case 'angry':t.Param63=e;t.ParamMouthForm=-.9*e;t.ParamMouthOpenY=.2*e;t.ParamBrowLY=-.8*e;t.ParamBrowRY=-.8*e;t.ParamBrowLAngle=-.7*e;t.ParamBrowRAngle=-.7*e;eyes(.22);t.ParamAngleZ=Math.sin(p*tau*17)*2*e;t.ParamAngleX=-side*6*e;ears(-.7);t.tailSpeed=3;break;
        case 'look':t.ParamAngleX=Math.sin(p*tau)*14*e;t.ParamEyeBallX=Math.sin(p*tau)*.6*e;t.ParamAngleY=Math.sin(p*Math.PI)*4*e;break;
        case 'yawn':eyes(.95);t.ParamMouthOpenY=Math.sin(p*Math.PI)*.8*e;t.ParamAngleY=7*e;t.ParamBrowLY=-.25*e;t.ParamBrowRY=-.25*e;t.tailSpeed=.3;ears(-.4);break;
      }
      return t;
    }
    function tick(){
      const elapsed=model.elapsedTime,dt=clamp(elapsed-lastElapsed,0,120);lastElapsed=elapsed;if(action&&elapsed-action.start>=action.duration)clearAction();
      if(action&&action.kind==='inspect'&&selectionTarget){const r=widget.getBoundingClientRect();model.internalModel.focusController.focus(clamp((selectionTarget.x-r.left-r.width*.5)/(innerWidth*.4),-.8,.8),clamp((r.top+r.height*.35-selectionTarget.y)/(innerHeight*.5),-.5,.6));}
      if(!action&&!reduced.matches&&elapsed>=nextIdle){
        if(!idleBag.length){idleBag=shuffle(idleNames.slice());if(idleBag[idleBag.length-1]===lastIdle)[idleBag[0],idleBag[idleBag.length-1]]=[idleBag[idleBag.length-1],idleBag[0]];}
        lastIdle=idleBag.pop();begin(lastIdle,Math.random()<.5?-1:1,true);
      }
      const target=action?pose(action.kind,reduced.matches?.45:clamp((elapsed-action.start)/action.duration),action.side):{wingSpeed:.9,tailSpeed:1.3,wingAmp:.36,tailAmp:.65,closeL:0,closeR:0,lift:0};
      const alpha=force||reduced.matches?1:1-Math.exp(-dt/85);
      for(const id of faces.concat(offsets,['wingSpeed','tailSpeed','wingAmp','tailAmp','closeL','closeR','lift'])){const value=target[id]||0;blend[id]=(blend[id]||0)+(value-(blend[id]||0))*alpha;}
      for(const id of faces)set(id,blend[id]);for(const id of offsets)add(id,blend[id]);
      if(!reduced.matches&&(!action||action.idle)){
        add('ParamBodyAngleZ',Math.sin(elapsed/1700)*.65);add('ParamAngleZ',Math.sin(elapsed/2100)*1.2);
        if(elapsed>=nextEar){earStart=elapsed;earSide=Math.random()<.5?-1:1;nextEar=elapsed+random(3000,6000);}
        const earAge=(elapsed-earStart)/1000;if(earAge>=0&&earAge<.8){const twitch=Math.sin(earAge*Math.PI*5)*Math.sin(earAge/.8*Math.PI)*.48;add(earSide<0?'Param9':'Param59',twitch);add(earSide<0?'Param11':'Param62',twitch*.7);}
      }
      set('ParamEyeLOpen',core.getParameterValueById('ParamEyeLOpen')*(1-blend.closeL));set('ParamEyeROpen',core.getParameterValueById('ParamEyeROpen')*(1-blend.closeR));
      wing+=dt/1000*blend.wingSpeed;tail+=dt/1000*blend.tailSpeed;set('Param41',Math.sin(wing)*blend.wingAmp);set('Param50',Math.sin(tail)*blend.tailAmp);model.position.y=widget.clientHeight-blend.lift;
      holdMagnifier();
    }
    model.internalModel.on('beforeModelUpdate',tick);
    return {begin,context,notice,tap,inspect,clearGesture,isInspecting:()=>!!action&&action.kind==='inspect',move(hit,x,y){if(performance.now()-lastHitAt<55)return;lastHitAt=performance.now();strokeAt(hit,x,y);}};
  }
  async function load(){
    if(!desktop.matches||hidden||model||loading)return;loading=true;
    try{
      // Gate the runtime, model and textures before making any mobile request.
      await script('/assets/vendor/pixi.min.js?v=6.5.10');await script('/assets/vendor/live2dcubismcore.min.js?v=25ae938c');await script('/assets/vendor/cubism4.min.js?v=0.4.0');if(!desktop.matches)return;
      widget=document.createElement('aside');widget.className='live2d-widget';widget.hidden=true;widget.setAttribute('aria-label','蓝龙 Live2D');
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','蓝龙：点击不同部位互动，滑动摸头；回车摸头，空格扇翅，左右键侧头，上键惊喜，下键摇尾');canvas.setAttribute('role','button');canvas.tabIndex=0;
      canvas.addEventListener('keydown',e=>{const kind=e.key==='Enter'?'head':e.key===' '?'wing':e.key==='ArrowDown'?'tail':e.key==='ArrowUp'?'surprise':e.key==='ArrowLeft'||e.key==='ArrowRight'?'curious':'';if(kind&&animator){e.preventDefault();animator.begin(kind,e.key==='ArrowLeft'?-1:1);}});
      const magnifier=document.createElement('span');magnifier.className='dragon-magnifier';magnifier.hidden=true;magnifier.setAttribute('aria-hidden','true');
      magnifier.innerHTML='<svg viewBox="0 0 74 110" fill="none"><defs><clipPath id="dragon-lens-clip"><circle cx="42" cy="34" r="20"/></clipPath><radialGradient id="dragon-lens-glow" cx=".3" cy=".25" r=".8"><stop stop-color="#f2fcff" stop-opacity=".95"/><stop offset="1" stop-color="#a2dded" stop-opacity=".75"/></radialGradient></defs><path d="M32 57 14 98" stroke="#182c42" stroke-width="11" stroke-linecap="round"/><path d="M31 58 16 92" stroke="#47677a" stroke-width="6" stroke-linecap="round"/><path d="m29 63 4-9" stroke="#e9be65" stroke-width="9"/><circle cx="42" cy="34" r="24" fill="#e6b75b" stroke="#243e55" stroke-width="2"/><circle cx="42" cy="34" r="20.5" fill="url(#dragon-lens-glow)" stroke="#628b9f" stroke-width="1.5"/><g clip-path="url(#dragon-lens-clip)"><text x="42" y="38" text-anchor="middle" fill="#233e51" font-family="sans-serif" font-size="12" font-weight="600"></text><path d="M27 28a16 16 0 0 1 12-10M52 43l3-4" stroke="white" stroke-opacity=".8" stroke-width="3" stroke-linecap="round"/></g></svg>';
      const close=document.createElement('button');close.className='live2d-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','隐藏 Live2D');close.addEventListener('click',()=>setHidden(true));widget.append(canvas,magnifier,close);document.body.append(widget);
      app=new PIXI.Application({view:canvas,width:240,height:310,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio||1,1.5),autoDensity:true,autoStart:false,powerPreference:'low-power'});app.ticker.maxFPS=30;
      model=await PIXI.live2d.Live2DModel.from('/assets/live2d/blue-dragon/dragon.model3.json',{autoInteract:false,autoUpdate:false});app.stage.addChild(model);app.ticker.add(()=>model.update(app.ticker.deltaMS));animator=createAnimator();model.update(0);
      widget._live2d=model;widget._app=app;widget.dataset.ready='true';state();layout();if(!reduced.matches)animator.begin('happy',1,false,'context');
    }catch(error){if(app){app.destroy(true,{children:true,texture:true,baseTexture:true});app=null;}if(widget)widget.remove();widget=null;model=null;animator=null;toggle.dataset.unavailable='true';console.warn('Live2D unavailable:',error&&error.message||error);}
    finally{loading=false;}
  }
  function setHidden(value){hidden=value;try{localStorage.setItem('linfon-live2d',hidden?'hidden':'visible');}catch(_){}state();if(!hidden){load();layout();}}
  function hit(x,y){
    const internal=model.internalModel,core=internal.coreModel,rig=core.getModel(),point=model.toModelPosition(new PIXI.Point(x,y)),cross=(ax,ay,bx,by,cx,cy)=>(ax-cx)*(by-cy)-(bx-cx)*(ay-cy);
    const order=Array.from({length:core.getDrawableCount()},(_,i)=>i).sort((a,b)=>rig.drawables.renderOrders[b]-rig.drawables.renderOrders[a]);
    for(const i of order){
      if(core.getDrawableOpacity(i)<.15)continue;const v=internal.getDrawableVertices(i),indices=core.getDrawableVertexIndices(i);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let n=0;n<v.length;n+=2){minX=Math.min(minX,v[n]);maxX=Math.max(maxX,v[n]);minY=Math.min(minY,v[n+1]);maxY=Math.max(maxY,v[n+1]);}if(point.x<minX||point.x>maxX||point.y<minY||point.y>maxY)continue;
      for(let n=0;n<indices.length;n+=3){
        const a=indices[n]*2,b=indices[n+1]*2,c=indices[n+2]*2,d1=cross(point.x,point.y,v[a],v[a+1],v[b],v[b+1]),d2=cross(point.x,point.y,v[b],v[b+1],v[c],v[c+1]),d3=cross(point.x,point.y,v[c],v[c+1],v[a],v[a+1]);
        if(Math.abs(cross(v[a],v[a+1],v[b],v[b+1],v[c],v[c+1]))<.001||((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0)))continue;
        let part=rig.drawables.parentPartIndices[i],zone='body';
        for(let depth=0;part>=0&&depth<20;depth++,part=rig.parts.parentIndices[part]){const id=rig.parts.ids[part];if(['Part31','Part32','Part33'].includes(id)){zone='ear';break;}if(['Part45','Part47','Part48'].includes(id)){zone='wing';break;}if(['Part44','Part49'].includes(id)){zone='tail';break;}if(['Part30','Part12'].includes(id)){zone='face';break;}if(id==='Part9'){zone='head';break;}}
        return {zone,side:point.x<internal.originalWidth/2?-1:1,x,y};
      }
    }
    return null;
  }
  toggle.addEventListener('click',()=>setHidden(!hidden));document.addEventListener('terminal-catastrophe',()=>{if(animator)animator.begin('angry');});
  let lastPointerHit=0,nearby=false;
  addEventListener('pointermove',e=>{
    if(!model||!widget||widget.hidden||reduced.matches||e.pointerType==='touch'||animator.isInspecting())return;const rect=widget.getBoundingClientRect();model.internalModel.focusController.focus(clamp((e.clientX-rect.x-rect.width*.5)/(innerWidth*.4),-1,1),clamp((rect.y+rect.height*.35-e.clientY)/(innerHeight*.5),-1,1));
    const x=e.clientX-rect.x,y=e.clientY-rect.y,near=x> -85&&y> -85&&x<rect.width+85&&y<rect.height+85;if(near&&!nearby)animator.notice();nearby=near;
    if(performance.now()-lastPointerHit<60)return;lastPointerHit=performance.now();animator.move(x>=0&&y>=0&&x<=rect.width&&y<=rect.height?hit(x,y):null,e.clientX,e.clientY);
  },{passive:true});
  document.addEventListener('click',e=>{
    if(!model||!widget||widget.hidden||!getSelection().isCollapsed||e.target.closest('.live2d-close,[data-live2d-toggle]'))return;const rect=widget.getBoundingClientRect(),x=e.clientX-rect.x,y=e.clientY-rect.y;if(x<0||y<0||x>rect.width||y>rect.height)return;
    const target=hit(x,y);if(target){e.preventDefault();e.stopImmediatePropagation();animator.tap(target,e);}
  },true);
  function readSelection(){
    clearTimeout(selectionTimer);if(selecting)return;
    selectionTimer=setTimeout(()=>{
      if(!animator||!widget||widget.hidden){lastSelection='';return;}
      const selection=getSelection(),node=selection&&selection.anchorNode,element=node&&(node.nodeType===1?node:node.parentElement);
      const text=selection&&!selection.isCollapsed?selection.toString().trim():'';
      if(!text||!element||!element.closest('#main')||element.closest('input,textarea,select,[contenteditable],.home-console')||!selection.rangeCount){lastSelection='';animator.inspect('');return;}
      const signature=text.slice(0,160);if(signature===lastSelection)return;
      const rect=selection.getRangeAt(0).getBoundingClientRect();if(!rect.width||!rect.height)return;
      if(animator.inspect(signature,rect))lastSelection=signature;
    },160);
  }
  document.addEventListener('selectionchange',readSelection);
  document.addEventListener('pointerdown',()=>{selecting=true;},{passive:true});
  document.addEventListener('pointerup',()=>{selecting=false;readSelection();},{passive:true});
  document.addEventListener('pointercancel',()=>{selecting=false;readSelection();},{passive:true});
  addEventListener('blur',()=>{selecting=false;clearTimeout(selectionTimer);if(animator)animator.clearGesture();});
  addEventListener('resize',layout);desktop.addEventListener('change',()=>{state();if(desktop.matches){load();layout();}});reduced.addEventListener('change',state);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)awayAt=performance.now();state();if(!document.hidden&&animator&&performance.now()-awayAt>20000)animator.context('happy');});
  addEventListener('pagehide',()=>{if(app)app.stop();});addEventListener('pageshow',state);new MutationObserver(state).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  new MutationObserver(()=>{if(animator)animator.context('curious');}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  let terminalObserver=null;
  function watchTerminal(){
    if(terminalObserver)terminalObserver.disconnect();
    const terminal=document.querySelector('[data-linux-screen]');if(!terminal)return;
    terminalObserver=new MutationObserver(()=>{if(!animator||terminal.classList.contains('is-interacting'))return;const kind={sl:'surprise',gdb:'curious',gcc:'proud',vim:'tilt',network:'look',apt:'ear'}[terminal.dataset.scene];if(kind)animator.context(kind);});
    terminalObserver.observe(terminal,{attributes:true,attributeFilter:['data-scene']});
  }
  watchTerminal();addEventListener('site-page',()=>{watchTerminal();state();layout();});
  document.addEventListener('site-page-before',()=>{if(terminalObserver)terminalObserver.disconnect();clearTimeout(selectionTimer);lastSelection='';selecting=false;if(animator)animator.clearGesture();});
  state();if(desktop.matches){if('requestIdleCallback' in window)requestIdleCallback(load,{timeout:1800});else setTimeout(load,700);}
})();
