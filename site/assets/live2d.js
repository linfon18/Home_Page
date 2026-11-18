(() => {
  'use strict';
  const compact=matchMedia('(max-width: 767px), (pointer: coarse)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const toggle=document.querySelector('[data-live2d-toggle]');if(!toggle)return;
  const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n)),random=(a,b)=>a+Math.random()*(b-a),tau=Math.PI*2;
  let app=null,model=null,widget=null,animator=null,loading=false,hidden=false,awayAt=0;
  let selectionTimer=0,selecting=false,lastSelection='',customSize=1,sizeOpener=null,maximized=false;
  let weatherEffect='clear',weatherActive=false;
  let placement=null,dock=null,limits=null,gesture=null,dragFrame=0,previousTap=null,suppressClick=null;
  const positionKey='linfon-live2d-position';
  try{hidden=localStorage.getItem('linfon-live2d')==='hidden';}catch(_){}
  try{const saved=Number(localStorage.getItem('linfon-live2d-scale'));if(Number.isFinite(saved)&&saved>0)customSize=clamp(saved,.5,2);}catch(_){}
  try{maximized=localStorage.getItem('linfon-live2d-fit')==='max';}catch(_){}
  try{const p=JSON.parse(localStorage.getItem(positionKey));if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))placement={x:clamp(p.x),y:clamp(p.y)};}catch(_){}
  function savePosition(){try{if(placement)localStorage.setItem(positionKey,JSON.stringify(placement));else localStorage.removeItem(positionKey);}catch(_){}}
  const sizePanel=document.createElement('section');sizePanel.className='live2d-settings';sizePanel.id='live2d-size-controls';sizePanel.hidden=true;sizePanel.setAttribute('aria-label','Live2D 大小');
  sizePanel.innerHTML='<header><span>Live2D 大小</span><button type="button" class="live2d-settings-close" aria-label="关闭大小设置">×</button></header><label for="live2d-scale">缩放 <output for="live2d-scale" aria-live="polite">100%</output></label><input id="live2d-scale" type="range" min="50" max="200" step="5" value="100"><div class="live2d-size-actions"><button type="button" data-size-step="-10" aria-label="缩小 Live2D">−</button><button type="button" data-size-reset>恢复默认</button><button type="button" data-size-step="10" aria-label="放大 Live2D">+</button></div>';
  const maxButton=document.createElement('button');maxButton.type='button';maxButton.dataset.sizeMax='';maxButton.textContent='MAX';maxButton.setAttribute('aria-label','Live2D 适应屏幕');sizePanel.querySelector('.live2d-size-actions').append(maxButton);
  document.body.append(sizePanel);const sizeInput=sizePanel.querySelector('input'),sizeOutput=sizePanel.querySelector('output');
  function closeSize(restore=false){sizePanel.hidden=true;document.querySelectorAll('[data-live2d-size]').forEach(b=>b.setAttribute('aria-expanded','false'));if(restore&&sizeOpener&&sizeOpener.isConnected)sizeOpener.focus();}
  function openSize(button){sizeOpener=button;sizePanel.hidden=false;document.querySelectorAll('[data-live2d-size]').forEach(b=>b.setAttribute('aria-expanded','true'));layout();sizeInput.focus({preventScroll:true});}
  function setSize(value,save=true){if(save)maximized=false;customSize=clamp(Number.isFinite(value)?value:1,.5,2);const percent=Math.round(customSize*100);sizeInput.value=String(percent);sizeInput.setAttribute('aria-valuetext',percent+'%');sizeOutput.textContent=maximized?'MAX':percent+'%';maxButton.setAttribute('aria-pressed',String(maximized));sizePanel.querySelector('[data-size-step="-10"]').disabled=!maximized&&percent<=50;sizePanel.querySelector('[data-size-step="10"]').disabled=!maximized&&percent>=200;if(save)try{localStorage.setItem('linfon-live2d-scale',String(customSize));localStorage.removeItem('linfon-live2d-fit');}catch(_){}layout();}
  sizeInput.addEventListener('input',()=>setSize(Number(sizeInput.value)/100));
  sizePanel.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;if(button.hasAttribute('data-size-step'))setSize(Math.round((customSize+Number(button.dataset.sizeStep)/100)*100)/100);if(button.hasAttribute('data-size-reset')){endGesture(null,true);placement=null;savePosition();setSize(1);}if(button.hasAttribute('data-size-max')){maximized=!maximized;try{if(maximized)localStorage.setItem('linfon-live2d-fit','max');else localStorage.removeItem('linfon-live2d-fit');}catch(_){}setSize(customSize,false);}if(button.classList.contains('live2d-settings-close'))closeSize(true);});
  document.addEventListener('click',e=>{const button=e.target.closest('[data-live2d-size]');if(button){if(sizePanel.hidden)openSize(button);else closeSize(true);return;}if(!e.target.closest('.live2d-settings'))closeSize();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sizePanel.hidden){e.preventDefault();closeSize(true);}});
  function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=reject;document.head.append(el);});}
  function state(){
    const visible=!hidden&&!document.hidden&&!document.querySelector('dialog[open]');
    if(document.hidden||document.querySelector('dialog[open]'))closeSize();
    toggle.setAttribute('aria-pressed',String(!hidden));toggle.setAttribute('aria-label',hidden?'显示 Live2D':'隐藏 Live2D');
    if(!widget)return;if(!visible)endGesture(null,true);widget.hidden=!visible;
    if(!visible){lastSelection='';if(animator)animator.clearGesture();}
    if(app){if(visible)layout();if(visible&&!reduced.matches)app.start();else{app.stop();if(visible)app.renderer.render(app.stage);}}
  }
  function place(){
    const x=placement?limits.left+placement.x*limits.spanX:dock.x,y=placement?limits.top+placement.y*limits.spanY:dock.y;
    widget.style.transform=placement?'translate3d('+(x-dock.x)+'px,'+(y-dock.y)+'px,0)':'';
    widget._bounds=new DOMRect(x,y,dock.width,dock.height);
    if(animator)animator.follow();
  }
  function moveTo(x,y){
    if(!dock||!limits)return;
    placement={x:limits.spanX?clamp((x-limits.left)/limits.spanX):.5,y:limits.spanY?clamp((y-limits.top)/limits.spanY):.5};place();
  }
  function layout(){
    const view=window.visualViewport,viewWidth=Math.min(innerWidth,view?view.width:innerWidth),viewHeight=Math.min(innerHeight,view?view.height:innerHeight);
    const baseWidth=compact.matches?clamp(innerWidth*.28,104,136):clamp(innerWidth*.17,180,240),baseHeight=compact.matches?clamp(innerWidth*.37,138,180):clamp(innerWidth*.22,235,310);
    const available=Math.min(Math.max(1,viewWidth-24)/baseWidth,Math.max(1,viewHeight-(maximized?88:210))/baseHeight);
    const fit=maximized?available:Math.min(customSize,available),targetWidth=Math.max(1,Math.floor(baseWidth*fit)),targetHeight=Math.max(1,Math.floor(baseHeight*fit));
    if(widget&&!widget.hidden){
      widget.style.width=targetWidth+'px';widget.style.height=targetHeight+'px';widget.dataset.scale=maximized?'max':String(Math.round(customSize*100));widget.classList.toggle('is-maximized',maximized);
      widget.style.bottom=(view?Math.max(0,innerHeight-view.height-view.offsetTop):0)+'px';widget.style.transform='';dock=widget.getBoundingClientRect();
      const left=(view?view.offsetLeft:0)+6,top=(view?view.offsetTop:0)+(compact.matches&&!maximized?44:8);
      limits={left,top,spanX:Math.max(0,viewWidth-12-dock.width),spanY:Math.max(0,viewHeight-(compact.matches&&!maximized?44:8)-dock.height)};place();
    }
    sizePanel.style.bottom=Math.max(8,Math.min(targetHeight+16,viewHeight-(sizePanel.offsetHeight||190)-12))+'px';
    if(!app||!model)return;const width=widget.clientWidth,height=widget.clientHeight;if(!width||!height)return;
    const resolution=renderResolution(width,height),renderer=app.renderer;
    app.ticker.maxFPS=compact.matches?30:36;
    if(renderer.resolution!==resolution||renderer.screen.width!==width||renderer.screen.height!==height){renderer.resolution=resolution;renderer.resize(width,height);}
    // Cubism's clipping atlas is independent of the visible canvas resolution.
    const maskSize=height*resolution>500?1024:512,cubism=model.internalModel.renderer;
    if(cubism&&cubism.getClippingMaskBufferSize&&cubism.getClippingMaskBufferSize()!==maskSize){cubism.setClippingMaskBufferSize(maskSize);cubism.startUp(renderer.gl);}
    widget.dataset.resolution=resolution.toFixed(2);widget.dataset.maskSize=String(maskSize);model.scale.set(1);
    const scale=Math.min(width*.98/model.width,height*.98/model.height);model.scale.set(scale);model.anchor.set(.5,1);model.position.set(width/2,height);if(animator)animator.follow();app.renderer.render(app.stage);
  }
  function renderResolution(width,height){
    const zoom=window.visualViewport?visualViewport.scale||1:1,native=Math.max(1,(devicePixelRatio||1)*zoom),budget=compact.matches?3000000:4000000;
    return Math.max(1,Math.min(native,4,Math.sqrt(budget/(width*height))));
  }
  function createAnimator(){
    const core=model.internalModel.coreModel;
    const indices=new Map(core._parameterIds.map((id,i)=>[id,i]));
    const faces=['ParamCheek','Param63','Param3','Param4','Param5','Param6','Param7','Param8','ParamEyeLSmile','ParamEyeRSmile','ParamMouthForm','ParamMouthOpenY','ParamBrowLY','ParamBrowRY','ParamBrowLAngle','ParamBrowRAngle'];
    const offsets=['ParamAngleX','ParamAngleY','ParamAngleZ','ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ','ParamEyeBallX','ParamEyeBallY','Param9','Param10','Param11','Param12','Param59','Param60','Param61','Param62','Param55','Param57'];
    const blend={},lastByZone={},bags={},idleNames=['look','tilt','stretch','ear-idle','hum','yawn'];let idleBag=[],lastIdle='',dragLean=0;
    const blendedParameters=faces.concat(offsets,['wingSpeed','tailSpeed','wingAmp','tailAmp','closeL','closeR','lift']);
    const pools={head:['head','happy','shy','nuzzle'],face:['wink','blush','surprise'],ear:['ear','curious'],body:['body','bounce','wave','tail'],wing:['wing','proud','stretch'],tail:['tail','startled']};
    const duration={angry:6000,dizzy:3000,love:2400,pet:2600,wing:2300,tail:2100,stretch:3400,yawn:3800,look:3300,tilt:2600,'ear-idle':2200,hum:3300,inspect:6200,nuzzle:2300,grumble:2100,wave:2150,land:780};
    const magnifier=widget.querySelector('.dragon-magnifier'),lensText=magnifier.querySelector('text'),umbrella=widget.querySelector('.dragon-umbrella');
    const handIndex=core.getDrawableIndex('ArtMesh102'),headIndices=['ArtMesh87','ArtMesh139','ArtMesh140','ArtMesh16'].map(id=>core.getDrawableIndex(id)).filter(i=>i>=0);let selectionTarget=null;
    const umbrellaRig=umbrella.querySelector('.umbrella-rig'),canopy=umbrella.querySelector('.umbrella-canopy'),shaft=umbrella.querySelector('.umbrella-shaft'),snowCap=umbrella.querySelector('.umbrella-snow');
    const shelter={curve:Array.from({length:17},()=>({x:0,y:0})),impact:0,snow:0,grip:{x:0,y:0}};
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
    function renderOnce(){if(reduced.matches){force=true;model.update(1);holdMagnifier();holdUmbrella();app.renderer.render(app.stage);force=false;}}
    function begin(kind,side=1,idle=false,origin='interaction'){
      if(widget.hidden||action&&action.kind==='angry'&&kind!=='angry')return false;
      if(action&&action.kind==='dizzy'&&!idle&&kind!=='angry')return false;
      clearAction();const length=duration[kind]||1800;action={kind,side,start:model.elapsedTime,duration:length,idle,origin};
      widget.dataset[idle?'activity':'reaction']=kind;widget.dataset.motion=String(++serial);widget.classList.toggle('is-angry',kind==='angry');
      nextIdle=model.elapsedTime+length+random(2200,4500);actionTimer=setTimeout(()=>{clearAction();renderOnce();},length+200);renderOnce();return true;
    }
    function context(kind,side=1){
      const now=performance.now();if(gesture||reduced.matches||now-lastContext<9000||action&&!action.idle)return false;
      if(begin(kind,side,false,'context')){lastContext=now;return true;}return false;
    }
    function notice(){const now=performance.now();if(now-lastNotice>14000&&context('happy'))lastNotice=now;}
    function inspect(text,rect){
      if(!text){if(action&&action.kind==='inspect'){clearAction();renderOnce();}return false;}
      if(!begin('inspect',-1,false,'selection'))return false;
      selectionTarget={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      lensText.textContent=Array.from(text.replace(/\s+/g,' ')).slice(0,12).join('');magnifier.hidden=false;renderOnce();return true;
    }
    function handPoint(){
      if(handIndex<0)return null;
      // Follow the distal arm mesh rather than a fixed screen coordinate.
      const vertices=model.internalModel.getDrawableVertices(handIndex);let bottom=-Infinity;
      for(let n=1;n<vertices.length;n+=2)bottom=Math.max(bottom,vertices[n]);
      let x=0,y=0,count=0;
      for(let n=0;n<vertices.length;n+=2){if(vertices[n+1]>=bottom-model.internalModel.originalHeight*.018){x+=vertices[n];y+=vertices[n+1];count++;}}
      if(!count)return null;
      return model.toGlobal(model.internalModel.localTransform.apply(new PIXI.Point(x/count,y/count)));
    }
    function holdMagnifier(){
      if(!action||action.kind!=='inspect')return;const point=handPoint();if(!point)return;
      const scale=widget.clientHeight/310;
      magnifier.style.width=74*scale+'px';magnifier.style.height=110*scale+'px';
      magnifier.style.transform='translate('+(point.x-14*scale)+'px,'+(point.y-98*scale)+'px)';
    }
    function sheltering(){return weatherActive&&['rain','snow','hail'].includes(weatherEffect)&&(!action||!['inspect','angry'].includes(action.kind));}
    function headBounds(){
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const i of headIndices){const v=model.internalModel.getDrawableVertices(i);for(let n=0;n<v.length;n+=2){left=Math.min(left,v[n]);right=Math.max(right,v[n]);top=Math.min(top,v[n+1]);bottom=Math.max(bottom,v[n+1]);}}
      const points=[[left,top],[right,top],[left,bottom],[right,bottom]].map(([x,y])=>model.toGlobal(model.internalModel.localTransform.apply(new PIXI.Point(x,y))));
      return {x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,y:Math.min(...points.map(p=>p.y))};
    }
    function holdUmbrella(){
      umbrella.hidden=!sheltering();if(umbrella.hidden){widget._weatherShelter=null;return;}
      const point=handPoint();if(!point){umbrella.hidden=true;widget._weatherShelter=null;return;}
      const b=widget._bounds||(widget._bounds=widget.getBoundingClientRect()),scale=b.height/310,head=headBounds();
      const dx=head.x-point.x-4*scale,dy=head.y-point.y-54*scale,length=Math.hypot(dx,dy)/scale,angle=clamp(Math.atan2(dx,-dy),-.45,.45)+shelter.impact*.018;
      const cos=Math.cos(angle),sin=Math.sin(angle),svg=umbrella.firstElementChild,view='0 0 '+b.width+' '+b.height;
      if(svg.getAttribute('viewBox')!==view)svg.setAttribute('viewBox',view);
      umbrellaRig.setAttribute('transform','translate('+point.x+' '+point.y+') rotate('+(angle*180/Math.PI)+') scale('+scale+')');
      canopy.setAttribute('transform','translate(0 '+(-length)+')');shaft.setAttribute('d','M0 '+(-length+1)+'V9q0 8-7 8');
      shelter.x=Infinity;shelter.y=Infinity;let right=-Infinity;
      for(let i=0;i<shelter.curve.length;i++){const x=-86+i/16*172,y=36*(x/86)**2-length,p=shelter.curve[i];p.x=b.x+point.x+(x*cos-y*sin)*scale;p.y=b.y+point.y+(x*sin+y*cos)*scale;shelter.x=Math.min(shelter.x,p.x);right=Math.max(right,p.x);shelter.y=Math.min(shelter.y,p.y);}
      shelter.w=right-shelter.x;shelter.bottom=b.bottom;shelter.scale=scale;shelter.grip.x=b.x+point.x;shelter.grip.y=b.y+point.y;
      if(weatherEffect!=='snow')shelter.snow=0;
      snowCap.style.strokeWidth=String(1+Math.min(3,shelter.snow));snowCap.style.opacity=String(Math.min(1,shelter.snow));
      widget._weatherShelter=shelter;
      umbrella.dataset.weather=weatherEffect;
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
    function tap(hit,double){
      const now=performance.now();widget.dataset.taps=String(Number(widget.dataset.taps||0)+1);widget.dataset.zone=hit.zone;if(now<spamUntil)return;
      clicks=clicks.filter(time=>now-time<1600);clicks.push(now);
      const kind=clicks.length>=5?'dizzy':double?'love':choose(hit.zone);
      if(kind==='dizzy'){spamUntil=now+3200;clicks=[];}
      if(begin(kind,hit.side))burst(kind,hit.x,hit.y);
    }
    function hold(hit){
      const kind=['head','face'].includes(hit.zone)?'nuzzle':hit.zone==='body'?'wave':hit.zone==='wing'?'stretch':'grumble';
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
        case 'nuzzle':smile(.95);eyes(.92);t.ParamCheek=.6*e;t.ParamAngleZ=side*(6+3*w)*e;t.ParamAngleY=-8*e;t.tailSpeed=2.8;ears(.35);break;
        case 'grumble':t.ParamMouthForm=-.65*e;t.ParamBrowLY=-.55*e;t.ParamBrowRY=-.55*e;t.ParamAngleX=side*8*e;t.ParamAngleZ=-side*5*e;t.tailSpeed=4;ears(-.55);break;
        case 'wave':smile(.85);t.Param55=-16*e;t.Param57=(9+7*w)*e;t.ParamAngleZ=side*5*e;t.tailSpeed=2;break;
        case 'land':t.ParamBodyAngleZ=side*Math.sin(p*tau*1.5)*5*e;t.ParamAngleY=-5*e;eyes(.55);t.wingSpeed=4;t.wingAmp=.66;t.lift=Math.sin(p*Math.PI)*3;break;
      }
      return t;
    }
    function tick(){
      const elapsed=model.elapsedTime,dt=clamp(elapsed-lastElapsed,0,120);lastElapsed=elapsed;if(action&&elapsed-action.start>=action.duration)clearAction();
      if(action&&action.kind==='inspect'&&selectionTarget){const r=widget._bounds;model.internalModel.focusController.focus(clamp((selectionTarget.x-r.left-r.width*.5)/(innerWidth*.4),-.8,.8),clamp((r.top+r.height*.35-selectionTarget.y)/(innerHeight*.5),-.5,.6));}
      if(!gesture&&!action&&!reduced.matches&&elapsed>=nextIdle){
        if(!idleBag.length){idleBag=shuffle(idleNames.slice());if(idleBag[idleBag.length-1]===lastIdle)[idleBag[0],idleBag[idleBag.length-1]]=[idleBag[idleBag.length-1],idleBag[0]];}
        lastIdle=idleBag.pop();begin(lastIdle,Math.random()<.5?-1:1,true);
      }
      const target=action?pose(action.kind,reduced.matches?.45:clamp((elapsed-action.start)/action.duration),action.side):{wingSpeed:.9,tailSpeed:1.3,wingAmp:.36,tailAmp:.65,closeL:0,closeR:0,lift:0};
      if(!reduced.matches&&gesture&&gesture.dragging&&(!action||action.kind!=='angry')){
        dragLean+=(gesture.lean-dragLean)*(1-Math.exp(-dt/85));gesture.lean*=Math.exp(-dt/180);
        Object.assign(target,{ParamAngleZ:dragLean*10,ParamBodyAngleZ:dragLean*9,ParamBrowLY:.34,ParamBrowRY:.34,ParamMouthOpenY:.24,wingSpeed:5,wingAmp:.75,tailSpeed:3.2});
      }else dragLean=0;
      shelter.impact*=Math.exp(-dt/260);
      if(sheltering()){target.Param55=-16-shelter.impact*3;target.Param57=12;target.wingAmp=Math.min(target.wingAmp,.2);target.closeL=Math.max(target.closeL||0,shelter.impact*.35);target.closeR=Math.max(target.closeR||0,shelter.impact*.35);}
      const alpha=force||reduced.matches?1:1-Math.exp(-dt/85);
      for(const id of blendedParameters){const value=target[id]||0;blend[id]=(blend[id]||0)+(value-(blend[id]||0))*alpha;}
      for(const id of faces)set(id,blend[id]);for(const id of offsets)add(id,blend[id]);
      if(!reduced.matches&&(!action||action.idle)){
        add('ParamBodyAngleZ',Math.sin(elapsed/1700)*.65);add('ParamAngleZ',Math.sin(elapsed/2100)*1.2);
        if(elapsed>=nextEar){earStart=elapsed;earSide=Math.random()<.5?-1:1;nextEar=elapsed+random(3000,6000);}
        const earAge=(elapsed-earStart)/1000;if(earAge>=0&&earAge<.8){const twitch=Math.sin(earAge*Math.PI*5)*Math.sin(earAge/.8*Math.PI)*.48;add(earSide<0?'Param9':'Param59',twitch);add(earSide<0?'Param11':'Param62',twitch*.7);}
      }
      set('ParamEyeLOpen',core.getParameterValueById('ParamEyeLOpen')*(1-blend.closeL));set('ParamEyeROpen',core.getParameterValueById('ParamEyeROpen')*(1-blend.closeR));
      wing+=dt/1000*blend.wingSpeed;tail+=dt/1000*blend.tailSpeed;set('Param41',Math.sin(wing)*blend.wingAmp);set('Param50',Math.sin(tail)*blend.tailAmp);model.position.y=widget.clientHeight-blend.lift;
    }
    model.internalModel.on('beforeModelUpdate',tick);
    return {begin,context,notice,tap,hold,inspect,clearGesture,pickUp(){if(action&&action.kind!=='angry')clearAction();clearGesture();},follow(){holdMagnifier();holdUmbrella();},weather(){holdUmbrella();renderOnce();},isInspecting:()=>!!action&&action.kind==='inspect',move(hit,x,y){if(performance.now()-lastHitAt<55)return;lastHitAt=performance.now();strokeAt(hit,x,y);}};
  }
  async function load(){
    if(hidden||model||loading)return;loading=true;
    try{
      // Both touch and mouse devices load the same model after the page is ready.
      await script('/assets/vendor/pixi.min.js?v=6.5.10');await script('/assets/vendor/live2dcubismcore.min.js?v=25ae938c');await script('/assets/vendor/cubism4.min.js?v=0.4.0');
      widget=document.createElement('aside');widget.className='live2d-widget';widget.hidden=true;widget.setAttribute('aria-label','蓝龙 Live2D');
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','蓝龙：点按、长按或拖动；回车摸头，空格扇翅，Shift 加方向键移动');canvas.setAttribute('role','button');canvas.tabIndex=0;
      canvas.addEventListener('keydown',e=>{
        const step={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];
        if(e.shiftKey&&step&&widget._bounds){e.preventDefault();moveTo(widget._bounds.x+step[0],widget._bounds.y+step[1]);savePosition();return;}
        if(['+','=','-','0'].includes(e.key)){e.preventDefault();setSize(e.key==='0'?1:Math.round((customSize+(e.key==='-'?-.1:.1))*100)/100);return;}
        const kind=e.key==='Enter'?'head':e.key===' '?'wing':e.key==='ArrowDown'?'tail':e.key==='ArrowUp'?'surprise':e.key==='ArrowLeft'||e.key==='ArrowRight'?'curious':'';
        if(kind&&animator){e.preventDefault();animator.begin(kind,e.key==='ArrowLeft'?-1:1);}
      });
      const grip=document.createElementNS('http://www.w3.org/2000/svg','svg');grip.setAttribute('class','live2d-grip');grip.setAttribute('viewBox','0 0 100 100');grip.setAttribute('preserveAspectRatio','none');grip.setAttribute('aria-hidden','true');
      // Keep touch-action on the model's central grab area, leaving the canvas corners scrollable.
      grip.innerHTML='<path d="M48 13Q61 12 63 25Q67 35 57 41L62 61L57 74H43L38 61L42 41Q32 35 37 25Q39 14 48 13Z" fill="transparent"/>';
      grip.addEventListener('contextmenu',e=>e.preventDefault());
      grip.addEventListener('lostpointercapture',e=>{if(gesture&&gesture.id===e.pointerId)endGesture(e,true);});
      const magnifier=document.createElement('span');magnifier.className='dragon-magnifier';magnifier.hidden=true;magnifier.setAttribute('aria-hidden','true');
      magnifier.innerHTML='<svg viewBox="0 0 74 110" fill="none"><defs><clipPath id="dragon-lens-clip"><circle cx="42" cy="34" r="20"/></clipPath><radialGradient id="dragon-lens-glow" cx=".3" cy=".25" r=".8"><stop stop-color="#f2fcff" stop-opacity=".95"/><stop offset="1" stop-color="#a2dded" stop-opacity=".75"/></radialGradient></defs><path d="M32 57 14 98" stroke="#182c42" stroke-width="11" stroke-linecap="round"/><path d="M31 58 16 92" stroke="#47677a" stroke-width="6" stroke-linecap="round"/><path d="m29 63 4-9" stroke="#e9be65" stroke-width="9"/><circle cx="42" cy="34" r="24" fill="#e6b75b" stroke="#243e55" stroke-width="2"/><circle cx="42" cy="34" r="20.5" fill="url(#dragon-lens-glow)" stroke="#628b9f" stroke-width="1.5"/><g clip-path="url(#dragon-lens-clip)"><text x="42" y="38" text-anchor="middle" fill="#233e51" font-family="sans-serif" font-size="12" font-weight="600"></text><path d="M27 28a16 16 0 0 1 12-10M52 43l3-4" stroke="white" stroke-opacity=".8" stroke-width="3" stroke-linecap="round"/></g></svg>';
      const umbrella=document.createElement('span');umbrella.className='dragon-umbrella';umbrella.hidden=true;umbrella.setAttribute('aria-hidden','true');
      umbrella.innerHTML='<svg viewBox="0 0 240 310" fill="none"><defs><linearGradient id="dragon-rain-fabric" x1="-75" y1="0" x2="85" y2="45" gradientUnits="userSpaceOnUse"><stop stop-color="#789da8"/><stop offset=".5" stop-color="#385e78"/><stop offset="1" stop-color="#183d58"/></linearGradient></defs><g class="umbrella-rig"><path class="umbrella-shaft" stroke="#aac3c9" stroke-width="2.8" stroke-linecap="round"/><g class="umbrella-canopy"><path d="M-86 36Q0-36 86 36q-14-12-28.7 0-14-11-28.6 0Q14 26 0 36q-14-10-28.7 0-14-11-28.6 0-14-12-28.7 0Z" fill="url(#dragon-rain-fabric)" stroke="#142f46" stroke-width="1.3"/><path d="M0 0Q-34 0-57.3 36M0 0Q-14 4-28.7 36M0 0V36M0 0Q14 4 28.7 36M0 0Q34 0 57.3 36" stroke="#c5e2e8" stroke-opacity=".36" stroke-width=".8"/><path d="M0-4V1M-86 36v2m28.7-2v2m28.6-2v2M0 36v2m28.7-2v2m28.6-2v2M86 36v2" stroke="#234359" stroke-width="1.6" stroke-linecap="round"/><path d="M-81 31Q0-32 81 31" stroke="#d4edf1" stroke-opacity=".25" stroke-width="1"/><path class="umbrella-snow" d="M-80 31Q0-31 80 31" stroke="#f3f9fc" stroke-linecap="round"/></g></g></svg>';
      const close=document.createElement('button');close.className='live2d-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','隐藏 Live2D');close.addEventListener('click',()=>setHidden(true));
      const sizing=document.createElement('button');sizing.type='button';sizing.className='live2d-size-button';sizing.textContent='⤢';sizing.dataset.live2dSize='';sizing.setAttribute('aria-label','调整 Live2D 大小');sizing.setAttribute('aria-controls','live2d-size-controls');sizing.setAttribute('aria-expanded','false');widget.append(canvas,magnifier,grip,sizing,close);document.body.append(widget);
      widget.insertBefore(umbrella,magnifier);
      app=new PIXI.Application({view:canvas,width:240,height:310,backgroundAlpha:0,antialias:true,resolution:renderResolution(240,310),autoDensity:true,autoStart:false,powerPreference:'low-power'});app.ticker.maxFPS=compact.matches?30:36;
      model=await PIXI.live2d.Live2DModel.from('/assets/live2d/blue-dragon/dragon.model3.json',{autoInteract:false,autoUpdate:false});app.stage.addChild(model);app.ticker.add(()=>{if(reduced.matches||widget.hidden||document.hidden){state();return;}model.update(app.ticker.deltaMS);});animator=createAnimator();
      // Live2DModel.update queues time; the mesh is deformed later inside _render.
      const updateModel=model.internalModel.update;
      model.internalModel.update=function(...args){const result=updateModel.apply(this,args);animator.follow();return result;};model.update(0);
      widget._renderCache=window.cacheLive2DGeometry(model,app.renderer);
      // Hit testing is handled by this module; Pixi's independent polling ticker is redundant.
      if(app.renderer.plugins.interaction)app.renderer.plugins.interaction.useSystemTicker=false;
      widget._live2d=model;widget._app=app;widget.dataset.ready='true';state();layout();animator.weather();if(!reduced.matches)animator.begin('happy',1,false,'context');
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
  addEventListener('site-weather',e=>{weatherEffect=e.detail.effect;weatherActive=e.detail.active;if(animator){animator.weather();if(weatherActive&&['rain','snow','hail'].includes(weatherEffect))animator.context('curious');}});
  function drawDrag(){
    dragFrame=0;if(!gesture||!gesture.dragging)return;
    moveTo(gesture.x-gesture.offsetX,gesture.y-gesture.offsetY);
  }
  function endGesture(e,cancelled=false){
    if(!gesture||(e&&e.pointerId!==gesture.id))return;
    const g=gesture;clearTimeout(g.holdTimer);cancelAnimationFrame(dragFrame);dragFrame=0;
    if(g.dragging&&!cancelled){g.x=e.clientX;g.y=e.clientY;drawDrag();}
    gesture=null;widget.classList.remove('is-dragging');
    if(g.grip.hasPointerCapture(g.id))g.grip.releasePointerCapture(g.id);
    if(g.dragging){savePosition();if(!cancelled&&!reduced.matches)animator.begin('land',g.hit.side);}
    if(cancelled)return;
    suppressClick={x:e.clientX,y:e.clientY,at:performance.now()};
    if(g.dragging||g.held){previousTap=null;return;}
    const t=suppressClick,previous=previousTap;
    const double=!!(previous&&t.at-previous.at<350&&Math.hypot(t.x-previous.x,t.y-previous.y)<25);
    previousTap=double?null:t;animator.tap(g.hit,double);
  }
  document.addEventListener('pointerdown',e=>{
    suppressClick=null;
    if(gesture||!e.isPrimary||e.button!==0||!model||!widget||widget.hidden||!widget._bounds||e.target.closest('.live2d-close,.live2d-settings,[data-live2d-toggle],[data-live2d-size]'))return;
    const b=widget._bounds,x=e.clientX-b.x,y=e.clientY-b.y;
    if(x<0||y<0||x>b.width||y>b.height)return;
    const target=hit(x,y);if(!target)return;
    const grip=widget.querySelector('.live2d-grip');
    gesture={id:e.pointerId,grip,hit:target,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,offsetX:x,offsetY:y,lean:0,dragging:false,held:false,canDrag:e.pointerType==='mouse'||grip.contains(e.target)};
    const g=gesture;
    g.holdTimer=setTimeout(()=>{if(gesture===g&&!g.dragging){g.held=true;animator.hold(target);}},490);
    if(e.pointerType==='mouse')widget.querySelector('canvas').focus({preventScroll:true});
    e.preventDefault();if(g.canDrag)grip.setPointerCapture(e.pointerId);
  },true);
  document.addEventListener('pointermove',e=>{
    const g=gesture;if(!g||e.pointerId!==g.id)return;
    const dx=e.clientX-g.x;g.x=e.clientX;g.y=e.clientY;
    if(!g.dragging&&Math.hypot(g.x-g.startX,g.y-g.startY)>=(e.pointerType==='mouse'?5:8)){
      clearTimeout(g.holdTimer);if(!g.canDrag){endGesture(e,true);return;}
      g.dragging=true;widget.classList.add('is-dragging');animator.pickUp();
    }
    if(g.dragging){g.lean=clamp(g.lean*.65+dx*.045,-1,1);if(!dragFrame)dragFrame=requestAnimationFrame(drawDrag);}
  },{passive:true});
  document.addEventListener('pointerup',e=>endGesture(e));
  document.addEventListener('pointercancel',e=>endGesture(e,true));
  document.addEventListener('click',e=>{
    const c=suppressClick;
    if(!c||!e.detail||performance.now()-c.at>500||Math.hypot(e.clientX-c.x,e.clientY-c.y)>25)return;
    suppressClick=null;e.preventDefault();e.stopImmediatePropagation();
  },true);
  let lastPointerHit=0,nearby=false;
  addEventListener('pointermove',e=>{
    if(gesture||!model||!widget||widget.hidden||!widget._bounds||reduced.matches||e.pointerType==='touch'||animator.isInspecting())return;const rect=widget._bounds;model.internalModel.focusController.focus(clamp((e.clientX-rect.x-rect.width*.5)/(innerWidth*.4),-1,1),clamp((rect.y+rect.height*.35-e.clientY)/(innerHeight*.5),-1,1));
    const x=e.clientX-rect.x,y=e.clientY-rect.y,near=x> -85&&y> -85&&x<rect.width+85&&y<rect.height+85;if(near&&!nearby)animator.notice();nearby=near;
    if(performance.now()-lastPointerHit<60)return;lastPointerHit=performance.now();animator.move(x>=0&&y>=0&&x<=rect.width&&y<=rect.height?hit(x,y):null,e.clientX,e.clientY);
  },{passive:true});
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
  addEventListener('blur',()=>{endGesture(null,true);selecting=false;clearTimeout(selectionTimer);if(animator)animator.clearGesture();});
  addEventListener('resize',layout);addEventListener('site-viewport',layout);compact.addEventListener('change',layout);reduced.addEventListener('change',state);
  if(window.visualViewport){visualViewport.addEventListener('resize',layout);visualViewport.addEventListener('scroll',layout);}
  // A monitor change or browser zoom can change DPR without changing CSS size.
  let densityQuery=null;
  function watchDensity(){if(densityQuery)densityQuery.removeEventListener('change',densityChanged);densityQuery=matchMedia('(resolution: '+(devicePixelRatio||1)+'dppx)');densityQuery.addEventListener('change',densityChanged);}
  function densityChanged(){watchDensity();layout();}watchDensity();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)awayAt=performance.now();state();if(!document.hidden&&animator&&performance.now()-awayAt>20000)animator.context('happy');});
  addEventListener('pagehide',()=>{endGesture(null,true);if(app)app.stop();});addEventListener('pageshow',state);new MutationObserver(state).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  new MutationObserver(()=>{if(animator)animator.context('curious');}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  let terminalObserver=null;
  function watchTerminal(){
    if(terminalObserver)terminalObserver.disconnect();
    const terminal=document.querySelector('[data-linux-screen]');if(!terminal)return;
    terminalObserver=new MutationObserver(()=>{if(!animator||terminal.classList.contains('is-interacting'))return;const kind={sl:'surprise',gdb:'curious',gcc:'proud',vim:'tilt',network:'look',apt:'ear'}[terminal.dataset.scene];if(kind)animator.context(kind);});
    terminalObserver.observe(terminal,{attributes:true,attributeFilter:['data-scene']});
  }
  watchTerminal();addEventListener('site-page',()=>{watchTerminal();state();layout();});
  document.addEventListener('site-page-before',()=>{endGesture(null,true);closeSize();if(terminalObserver)terminalObserver.disconnect();clearTimeout(selectionTimer);lastSelection='';selecting=false;if(animator)animator.clearGesture();});
  setSize(customSize,false);state();if('requestIdleCallback' in window)requestIdleCallback(load,{timeout:1800});else setTimeout(load,700);
})();
