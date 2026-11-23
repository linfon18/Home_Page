import * as THREE from './three-0.160.1.js';

// The geometry describes network roles, not the physical hardware at either end.
const nodes = {
  client: {x:-5.05,z:1.05, kind:'endpoint', title:'加入方', code:'CLIENT'},
  host: {x:5.05,z:1.05, kind:'endpoint', title:'房主', code:'LAN HOST'},
  natA: {x:-2.55,z:1.05, kind:'nat', title:'NAT A', code:'EDGE'},
  natB: {x:2.55,z:1.05, kind:'nat', title:'NAT B', code:'EDGE'},
  gateway: {x:0,z:-2.25, kind:'control', title:'协调网关', code:'GATEWAY'},
  shared: {x:0,z:-1.92, kind:'relay', title:'共享节点', code:'OPENP2P'},
  relay: {x:0,z:-1.92, kind:'relay', title:'公共中继', code:'MCILM-LINK'},
  public: {x:0,z:-2.25, kind:'control', title:'公共节点', code:'BOOTSTRAP'},
  peerA: {x:0,z:-2.25, kind:'peer', title:'对等节点 A', code:'PEER'},
  peerB: {x:0,z:2.6, kind:'peer', title:'对等节点 B', code:'PEER'}
};
const topology = {
  signal: {show:['natA','natB'], routes:[['control','client','natA','gateway'],['control','host','natB','gateway']]},
  punch: {show:['gateway'], routes:[['idle','natA','gateway','natB'],['punch','client','natA','natB','host']]},
  direct: {show:['gateway'], routes:[['control','natA','gateway','natB'],['data','client','natA','natB','host']]},
  shared: {routes:[['data','client','natA','shared','natB','host']]},
  allocate: {routes:[['control','client','relay'],['control','host','relay']]},
  relay: {routes:[['data','client','relay','host']]},
  join: {routes:[['control','client','public'],['control','host','public']]},
  mesh: {routes:[['idle','client','peerA','host'],['idle','client','peerB','host'],['data','client','host']]},
  forward: {routes:[['idle','client','peerB','host'],['idle','peerB','peerA'],['data','client','peerA','host']]}
};
const styles = {
  data:{line:0x3c9ed2, shine:0xbdefff, width:.036, speed:2.65, count:5, twoWay:true},
  control:{line:0xf35769, shine:0xffa5ad, speed:1.8, count:2, twoWay:true},
  punch:{line:0xe6bb48, shine:0xffec91, speed:3.5, count:2, twoWay:true},
  idle:{line:0x635071, count:0}
};
const colors = {endpoint:0x69d6f2,nat:0xf7cf63,control:0xff677a,relay:0xff899c,peer:0xa9a9ff};
const initialYaw=-.12, initialPitch=.81;
const maxPackets=16;

function cutRect(width, depth, corner, y) {
  const x=width/2, z=depth/2;
  return [[-x,y,-z+corner],[-x+corner,y,-z],[x,y,-z],[x,y,z-corner],[x-corner,y,z],[-x,y,z],[-x,y,-z+corner]];
}

function createModels(scene, stage, managed){
  const store=resource=>{managed.add(resource);return resource;};
  const tagLayer=document.createElement('div');
  tagLayer.className='mct-tags';tagLayer.setAttribute('aria-hidden','true');stage.append(tagLayer);
  const models=new Map();
  const materials=new Map();
  function style(kind){
    if(!materials.has(kind)){
      const color=colors[kind];
      materials.set(kind,{
        body:store(new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.1,depthWrite:false})),
        outline:store(new THREE.LineBasicMaterial({color,transparent:true,opacity:.93})),
        detail:store(new THREE.LineBasicMaterial({color,transparent:true,opacity:.34}))
      });
    }
    return materials.get(kind);
  }
  function circuits(group, paths, material){
    const vertices=[];
    for(const points of paths)for(let i=1;i<points.length;i++)vertices.push(...points[i-1],...points[i]);
    const geometry=store(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    group.add(new THREE.LineSegments(geometry,material));
  }
  function fill(group, points, material){
    const vertices=[];
    for(let i=1;i<points.length-2;i++)vertices.push(...points[0],...points[i],...points[i+1]);
    const geometry=store(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    group.add(new THREE.Mesh(geometry,material));
  }
  for(const [id,{x,z,kind,title,code}] of Object.entries(nodes)){
    const group=new THREE.Group();
    group.position.set(x,0,z);scene.add(group);
    const {body,outline,detail}=style(kind);
    const nat=kind==='nat';
    const rim=cutRect(nat?1.1:1.85,nat?1.7:1.55,.22,.15);
    const ground=cutRect(nat?1.35:2.16,nat?1.98:1.86,.26,.022);
    const hatch=[ground];
    const high=[];
    fill(group,rim,body);high.push(rim);
    for(let i=0;i<rim.length-1;i++)hatch.push([rim[i],ground[i]]);

    if(nat){
      // The vertical cut shows a boundary that packets must cross.
      const wall=[[0,.18,-.66],[0,.79,-.66],[0,1.01,-.42],[0,1.01,.61],[0,.37,.61],[0,.18,.4],[0,.18,-.66]];
      fill(group,wall,body);high.push(wall);
      for(let n=0;n<6;n++){
        const z=-.53+n*.19;
        hatch.push([[0,.23,z],[0,.44,z],[0,.67,z+.08],[0,.9,z+.08]]);
      }
      high.push([[-.5,.52,0],[0,.52,0],[.5,.52,0]]);
    }else{
      const chip=cutRect(.81,.6,.1,.32);
      fill(group,chip,body);high.push(chip);
      high.push([[-.34,.33,.01],[-.16,.33,.01],[-.08,.33,-.16],[.04,.33,.16],[.13,.33,-.02],[.33,.33,-.02]]);
      for(let i=0;i<5;i++){
        const dx=(i-2)*.13;
        for(const sign of [-1,1]){
          hatch.push([[dx,.32,sign*.3],[dx,.17,sign*.41],[dx+sign*.13,.17,sign*.56],[dx+sign*.13,.17,sign*.72]]);
          const dz=(i-2)*.14;
          hatch.push([[sign*.42,.32,dz],[sign*.53,.17,dz],[sign*.71,.17,dz-.1],[sign*.89,.17,dz-.1]]);
        }
      }
      for(const sign of [-1,1]){
        high.push([[sign*.59,.17,-.67],[sign*.72,.17,-.67]],[[sign*.59,.17,.67],[sign*.72,.17,.67]]);
        high.push([[sign*.95,.5,0],[sign*.73,.5,0],[sign*.54,.34,0]]);
      }
    }
    circuits(group,hatch,detail);circuits(group,high,outline);
    const tag=document.createElement('span');
    tag.className='mct-node-name';tag.dataset.kind=kind;
    const idLabel=document.createElement('small');idLabel.textContent=code;
    const titleLabel=document.createElement('b');titleLabel.textContent=title;
    tag.append(idLabel,titleLabel);tagLayer.append(tag);
    models.set(id,{group,tag,anchor:new THREE.Vector3(x,nat?1.06:.79,z)});
  }
  return {models,tagLayer};
}

function createFloor(scene, managed){
  const plane=new THREE.PlaneGeometry(16,9.4);
  plane.rotateX(-Math.PI/2);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{scan:{value:-9}, sweepStrength:{value:0}},
    vertexShader:`varying vec2 panel; void main(){panel=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec2 panel;
      uniform float scan;
      uniform float sweepStrength;
      float grid(vec2 p, float scale){
        vec2 q=p/scale;
        vec2 g=abs(fract(q-.5)-.5)/max(fwidth(q),vec2(.001));
        return 1.-clamp(min(g.x,g.y),0.,1.);
      }
      void main(){
        vec2 a=abs(panel);
        float fade=1.-smoothstep(.77,1.,max(a.x/7.9,a.y/4.65));
        float fine=grid(panel,.3)*.16;
        float major=grid(panel,1.2)*.27;
        float frame=max(a.x/1.85,max(a.y,(a.x+a.y)/2.54));
        float edge=(1.-smoothstep(.012,.045,abs(frame-3.63)))*.64;
        float lane=(1.-smoothstep(.013,.045,abs(a.y-3.21)))*step(2.2,a.x)*.49;
        float rain=step(.83,fract(panel.x/.21))*step(.74,fract(panel.y/.21))*.14;
        float beam=panel.x-scan;
        float sweep=(exp(-abs(beam)*14.)*.53+exp(-abs(beam+.22)*2.6)*.26)*sweepStrength;
        vec3 color=mix(vec3(.56,.13,.23),vec3(.97,.38,.43),edge+sweep);
        color+=vec3(.11,.015,.025)*sweep;
        gl_FragColor=vec4(color,max(max(max(fine,major),max(edge,lane)),rain)*fade+sweep*fade);
      }`
  });
  const floor=new THREE.Mesh(plane,material);
  floor.position.y=-.024;scene.add(floor);
  managed.add(plane);managed.add(material);
  return material.uniforms;
}

function routeMaterial(type, style, charge, elapsed, translucent=false){
  const tube=Boolean(style.width);
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:!translucent,side:THREE.FrontSide,
    uniforms:{
      charge,elapsed,
      color:{value:new THREE.Color(style.line).convertLinearToSRGB()},
      opacity:{value:translucent?.33:type==='idle'?.6:1}
    },
    vertexShader:`
      ${tube?'':'attribute float progress; attribute float lineDistance;'}
      varying float along;
      varying float distanceOnLine;
      void main(){
        along=${tube?'uv.x':'progress'};
        distanceOnLine=${tube?'uv.x':'lineDistance'};
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      uniform float charge,elapsed,opacity;
      uniform vec3 color;
      varying float along,distanceOnLine;
      void main(){
        float positionOnRoute=${style.twoWay?'min(along,1.-along)*2.':'along'};
        float frontier=charge-positionOnRoute;
        float reveal=smoothstep(-.045,.055,frontier);
        float spark=exp(-abs(frontier)*28.);
        ${tube?'':`if(mod(distanceOnLine-${type==='idle'?'0.':'elapsed*.34'},${type==='idle'?'.25':'.31'})>${type==='idle'?'.125':'.19'})discard;`}
        vec3 light=mix(color,vec3(.91,.97,1.),spark*.7);
        gl_FragColor=vec4(light,max(reveal,spark*.52)*opacity);
        if(gl_FragColor.a<.012)discard;
      }`
  });
}

function createNodePulses(scene, managed){
  const entries=Object.entries(nodes);
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  const locations=[],uvs=[],colorsArray=[],indices=[];
  for(const [index,[,node]] of entries.entries()){
    const color=new THREE.Color(colors[node.kind]).convertLinearToSRGB();
    const size=node.kind==='nat'?.91:1.42;
    for(const [x,z] of corners){
      locations.push(node.x+x*size,.195,node.z+z*size);uvs.push(x,z);
      colorsArray.push(color.r,color.g,color.b);
    }
    const offset=index*4;
    indices.push(offset,offset+2,offset+1,offset,offset+3,offset+2);
  }
  const phase=new THREE.Float32BufferAttribute(new Float32Array(entries.length*4),1);
  phase.setUsage(THREE.DynamicDrawUsage);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(locations,3));
  geometry.setAttribute('nodeUV',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('nodeColor',new THREE.Float32BufferAttribute(colorsArray,3));
  geometry.setAttribute('phase',phase);
  geometry.setIndex(indices);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec2 nodeUV; attribute vec3 nodeColor; attribute float phase;
      varying vec2 panel; varying vec3 tone; varying float pulse;
      void main(){panel=nodeUV;tone=nodeColor;pulse=phase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 panel; varying vec3 tone; varying float pulse;
      void main(){
        float age=pulse;
        if(age>=1.)discard;
        vec2 axes=abs(panel);
        float d=max(max(axes.x,axes.y),(axes.x+axes.y)*.63);
        float ring=abs(d-(.18+age*.78));
        float rays=step(.44,fract((panel.x+panel.y)*9.));
        float light=(exp(-ring*35.)*(.65+rays*.35)+exp(-ring*9.)*.12)*(1.-age);
        float core=exp(-dot(panel,panel)*17.)*pow(1.-age,4.)*.37;
        gl_FragColor=vec4(tone,light+core);
      }`
  });
  scene.add(new THREE.Mesh(geometry,material));managed.add(geometry);managed.add(material);
  return {phase,indexes:new Map(entries.map(([key],index)=>[key,index]))};
}

function makePath(ids,type){
  const points=[];
  ids.forEach((id,index)=>{
    const {x,z,kind}=nodes[id];
    const y=type==='control'?.82:type==='idle'?.21:kind==='nat'?.52:.5;
    const target=new THREE.Vector3(x,y,z);
    if(index){
      const from=points[points.length-1];
      const dx=x-from.x, dz=z-from.z;
      const corner=Math.min(Math.abs(dx)*.55,Math.abs(dz));
      if(corner>.08){
        const midX=(from.x+x)/2;
        points.push(new THREE.Vector3(midX-Math.sign(dx)*corner*.5,from.y,from.z));
        points.push(new THREE.Vector3(midX+Math.sign(dx)*corner*.5,y,z));
      }
    }
    points.push(target);
  });
  const path=new THREE.CurvePath();
  let cursor=points[0];
  for(let i=1;i<points.length-1;i++){
    const point=points[i];
    const before=point.clone().lerp(points[i-1],.04);
    const after=point.clone().lerp(points[i+1],.04);
    path.add(new THREE.LineCurve3(cursor,before));
    path.add(new THREE.QuadraticBezierCurve3(before,point,after));
    cursor=after;
  }
  path.add(new THREE.LineCurve3(cursor,points[points.length-1]));
  return path;
}

export function mount(stage, scope, onVisibility){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-7,7,3,-3,.1,60);
  const focus=new THREE.Vector3(0,.58,.28);
  const managed=new Set();
  const wireGroup=new THREE.Group();scene.add(wireGroup);
  const scan=createFloor(scene,managed);
  const {models,tagLayer}=createModels(scene,stage,managed);
  stage.prepend(renderer.domElement);
  const pulses=createNodePulses(scene,managed);
  const charge={value:1.1}, elapsed={value:0};
  const wireMaterials={};
  for(const [type,style] of Object.entries(styles)){
    const material=routeMaterial(type,style,charge,elapsed);
    managed.add(material);wireMaterials[type]=material;
  }
  const halo=routeMaterial('data',styles.data,charge,elapsed,true);
  const points=new THREE.BoxGeometry(.22,.079,.079);
  const heads=new THREE.MeshBasicMaterial();
  const tails=new THREE.MeshBasicMaterial({transparent:true,opacity:.3,depthWrite:false});
  const packets=new THREE.InstancedMesh(points,heads,maxPackets);
  const trails=new THREE.InstancedMesh(points,tails,maxPackets*2);
  for(const mesh of [packets,trails]){
    mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);managed.add(mesh);
  }
  for(const item of [halo,points,heads,tails])managed.add(item);
  const matrix=new THREE.Matrix4(), projected=new THREE.Vector3(), sample=new THREE.Vector3();
  const previous=new THREE.Vector3(), axis=new THREE.Vector3(1,0,0), direction=new THREE.Vector3(), spin=new THREE.Quaternion(), scale=new THREE.Vector3();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const narrow=matchMedia('(max-width: 700px)');
  let active=null, journeys=[], yaw=initialYaw,pitch=initialPitch,width=0,height=0,time=0,last=0,timer=0,frame=0;
  let visible=false,viewDirty=true,pointer=null,lost=false;
  let paused=!!document.querySelector('dialog[open]');

  function clearWires(){
    for(const item of [...wireGroup.children]){item.geometry.dispose();wireGroup.remove(item);}
  }
  function nodePositions(path,ids){
    const segments=64;
    const samples=path.getSpacedPoints(segments);
    return ids.map(id=>{
      const {x,z}=nodes[id];
      let nearest=0,min=Infinity;
      for(let i=0;i<=segments;i++){
        const point=samples[i];
        const distance=(point.x-x)**2+(point.z-z)**2;
        if(distance<min){min=distance;nearest=i;}
      }
      return [pulses.indexes.get(id)*4,nearest/segments];
    });
  }
  function setScene(next){
    if(active===next)return;
    active=next;clearWires();journeys=[];time=0;last=0;
    const configuration=topology[next];
    const present=new Set([...(configuration.show||[]),...configuration.routes.flatMap(route=>route.slice(1))]);
    for(const [id,{group,tag}] of models){group.visible=present.has(id);tag.hidden=!group.visible;}
    let count=0;
    for(const [type,...ids] of configuration.routes){
      const path=makePath(ids,type), style=styles[type];
      const length=path.getLength();
      if(style.width){
        wireGroup.add(new THREE.Mesh(new THREE.TubeGeometry(path,48,style.width,5,false),wireMaterials[type]));
        wireGroup.add(new THREE.Mesh(new THREE.TubeGeometry(path,48,.12,6,false),halo));
      }else{
        const geometry=new THREE.BufferGeometry().setFromPoints(path.getSpacedPoints(64));
        geometry.setAttribute('progress',new THREE.Float32BufferAttribute(Float32Array.from({length:65},(_,i)=>i/64),1));
        const line=new THREE.Line(geometry,wireMaterials[type]);
        line.computeLineDistances();wireGroup.add(line);
      }
      if(!style.count)continue;
      // The direct scene keeps its gateway as a reference while game packets bypass it.
      if(next==='direct'&&type==='control')continue;
      const copies=style.count*(style.twoWay?2:1);
      const color=new THREE.Color(style.shine);
      for(let i=count;i<count+copies;i++){
        packets.setColorAt(i,color);trails.setColorAt(i*2,color);trails.setColorAt(i*2+1,color);
      }
      journeys.push({path,style,length,checkpoints:nodePositions(path,ids)});count+=copies;
    }
    packets.count=count;trails.count=count*2;
    if(packets.instanceColor)packets.instanceColor.needsUpdate=true;
    if(trails.instanceColor)trails.instanceColor.needsUpdate=true;
    viewDirty=true;repaint();
  }
  function updateView(){
    const aspect=width/height;
    const horizontal=width<480?6.8:6.65;
    const half=Math.max(2.9,horizontal/aspect);
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
    camera.position.set(15*Math.sin(yaw)*Math.cos(pitch),15*Math.sin(pitch),15*Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(focus);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    for(const {tag,anchor} of models.values()){
      if(tag.hidden)continue;
      projected.copy(anchor).project(camera);
      const x=THREE.MathUtils.clamp((projected.x+1)*width*.5,32,width-32);
      tag.style.left=x+'px';tag.style.top=(1-projected.y)*50+'%';
    }
    viewDirty=false;
  }
  function stop(){clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=last=0;}
  function repaint(){
    if(!visible||document.hidden||paused||lost||!active||!width||!height)return;
    clearTimeout(timer);timer=0;
    if(!frame)frame=requestAnimationFrame(draw);
  }
  function draw(now){
    frame=0;
    if(!visible||document.hidden||paused||lost)return;
    if(viewDirty)updateView();
    if(!reduced.matches&&last)time+=Math.min((now-last)/1000,.12);
    last=now;
    const animate=!reduced.matches;
    const activeTime=animate?Math.max(0,time-.44):0;
    charge.value=animate?Math.min(1.13,time*1.46):1.13;
    elapsed.value=activeTime;
    pulses.phase.array.fill(1);
    let index=0;
    for(const {path,style,length,checkpoints} of journeys){
      for(let lane=0;lane<(style.twoWay?2:1);lane++)for(let i=0;i<style.count;i++){
        const progress=(activeTime*style.speed/length+i/style.count+.11+lane*.09)%1;
        const t=lane?1-progress:progress;
        const sign=lane?-1:1;
        const shift=style.twoWay?sign*.08:0;
        const frontier=style.twoWay?Math.min(t,1-t)*2:t;
        const packetScale=THREE.MathUtils.smoothstep(charge.value-frontier,0,.12);
        if(animate&&packetScale>.77){
          for(const [offset,point] of checkpoints){
            const travelled=(1+(t-point)*sign)%1;
            const age=travelled*length/(style.speed*.66);
            if(age<pulses.phase.array[offset])pulses.phase.array.fill(age,offset,offset+4);
          }
        }
        path.getPoint(t,sample);path.getPoint(THREE.MathUtils.clamp(t+sign*.01,0,1),previous);
        direction.subVectors(previous,sample).normalize();spin.setFromUnitVectors(axis,direction);
        sample.z+=shift;
        scale.set(1.5,.54,.54).multiplyScalar(packetScale);matrix.compose(sample,spin,scale);packets.setMatrixAt(index,matrix);
        for(let tail=0;tail<2;tail++){
          const offset=(tail?.63:.26)/length;
          path.getPoint(THREE.MathUtils.clamp(t-sign*offset,0,1),sample);sample.z+=shift;
          scale.set(tail?1.3:2.1,tail?.16:.31,tail?.16:.31).multiplyScalar(packetScale);
          matrix.compose(sample,spin,scale);trails.setMatrixAt(index*2+tail,matrix);
        }
        index++;
      }
    }
    const sweepTime=time%7.4;
    scan.scan.value=sweepTime*10.5-10;
    scan.sweepStrength.value=animate&&sweepTime<1.9?1:0;
    pulses.phase.needsUpdate=true;
    packets.instanceMatrix.needsUpdate=true;trails.instanceMatrix.needsUpdate=true;
    renderer.render(scene,camera);
    if(!reduced.matches&&index)timer=setTimeout(repaint,narrow.matches?1000/24:1000/30);
  }
  const resize=new ResizeObserver(()=>{
    width=stage.clientWidth;height=stage.clientHeight;
    if(width&&height)renderer.setSize(width,height,false);
    viewDirty=true;repaint();
  });
  resize.observe(stage);
  const viewport=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)repaint();else stop();});
  viewport.observe(stage);
  function orbit(dx,dy){
    yaw=THREE.MathUtils.clamp(yaw+dx,-.72,.72);
    pitch=THREE.MathUtils.clamp(pitch+dy,.44,1.12);viewDirty=true;repaint();
  }
  function reset(){yaw=initialYaw;pitch=initialPitch;orbit(0,0);}
  scope.on(stage,'pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    pointer=[event.clientX,event.clientY,event.pointerId];stage.setPointerCapture(event.pointerId);
  });
  scope.on(stage,'pointermove',event=>{
    if(!pointer||pointer[2]!==event.pointerId)return;
    orbit((pointer[0]-event.clientX)*.01,(event.clientY-pointer[1])*.008);
    pointer=[event.clientX,event.clientY,event.pointerId];
  });
  scope.on(stage,'lostpointercapture',()=>{pointer=null;});
  scope.on(stage,'keydown',event=>{
    const delta={ArrowLeft:[-.16,0],ArrowRight:[.16,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]}[event.key];
    if(delta){event.preventDefault();orbit(...delta);}
    if(event.key==='Home'){event.preventDefault();reset();}
  });
  scope.on(document,'visibilitychange',()=>{stop();repaint();});
  scope.on(reduced,'change',()=>{stop();repaint();});
  const dialogs=new MutationObserver(records=>{
    if(!records.some(record=>record.target.localName==='dialog'))return;
    paused=!!document.querySelector('dialog[open]');stop();repaint();
  });
  dialogs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  scope.on(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();lost=true;stop();onVisibility(false);});
  scope.on(renderer.domElement,'webglcontextrestored',()=>{lost=false;onVisibility(true);repaint();});
  scope.cleanup(()=>{
    stop();viewport.disconnect();resize.disconnect();dialogs.disconnect();clearWires();
    for(const item of managed)item.dispose();
    renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();tagLayer.remove();
  });
  return {setScene,reset};
}
