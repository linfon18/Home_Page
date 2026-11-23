import * as THREE from './three-0.160.1.js';

const positions = {
  you: [-3.2, 0, .65], friend: [3.2, 0, .65],
  relay: [0, 0, -1.65], peer: [0, 0, -1.85], spare: [.1, 0, 2.65]
};
const labels = {you:'你的电脑', friend:'朋友的电脑', relay:'中继服务器', peer:'对等节点 A', spare:'对等节点 B'};
const routes = {
  p2p: {path:['you','friend'], extra:[]},
  link: {path:['you','relay','friend'], extra:[]},
  et: {path:['you','peer','friend'], extra:[['you','spare'],['spare','friend'],['spare','peer']]}
};

export function mount(stage, scope) {
  const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.domElement.setAttribute('aria-hidden','true');
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6,6,3,-3,.1,60);
  const focus = new THREE.Vector3(0,.45,0);
  const hemi = new THREE.HemisphereLight(0xf2fbff,0x667a79,2.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dd,2.1);
  sun.position.set(-4,9,5);scene.add(sun);
  const block = new THREE.BoxGeometry(1,1,1);
  const materials = new Map();
  function part(parent, color, x,y,z, w,h,d) {
    if(!materials.has(color)) materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.78}));
    const mesh = new THREE.Mesh(block, materials.get(color));
    mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);
  }
  const nodes = new Map();
  for(const [name,point] of Object.entries(positions)) {
    const device = new THREE.Group();
    device.position.set(...point);
    scene.add(device);
    part(device,0x566c79,0,.08,0,1.34,.16,1.06);
    if(name==='relay'){
      for(let i=0;i<3;i++){
        part(device,0x2d4354,0,.33+i*.27,0,1.02,.23,.75);
        part(device,0x9adfff,-.34,.33+i*.27,.39,.09,.055,.025);
      }
    }else{
      part(device,0x506575,0,.25,0,.13,.26,.14);
      part(device,0x293d4a,0,.68,0,1.09,.69,.12);
      part(device,name==='friend'?0x75bca8:0x76c5df,0,.68,.072,.94,.52,.025);
      part(device,0xd1dfe1,0,.18,.33,.73,.045,.19);
    }
    const tag=document.createElement('span');
    tag.className='mct-node-name';tag.textContent=labels[name];stage.append(tag);
    nodes.set(name,{device,tag,anchor:new THREE.Vector3(point[0],1.37,point[2])});
  }
  const grid = new THREE.GridHelper(14,28,0x8598a3,0x8598a3);
  grid.material.transparent=true;grid.material.opacity=.18;scene.add(grid);
  const cable = new THREE.MeshBasicMaterial({color:0x438bb6});
  const secondary = new THREE.LineDashedMaterial({color:0x77919c,dashSize:.14,gapSize:.1});
  const packetMaterial = new THREE.MeshBasicMaterial({color:0xbceeff});
  const packetShape = new THREE.SphereGeometry(.085,8,6);
  const packetCount=8;
  const packets = new THREE.InstancedMesh(packetShape,packetMaterial,packetCount);
  packets.frustumCulled=false;scene.add(packets);
  const wireGroup = new THREE.Group();scene.add(wireGroup);
  const matrix = new THREE.Matrix4(), projected = new THREE.Vector3(), sample = new THREE.Vector3();
  let journey=null,mode=null,angle=.22,elevation=.57,width=0,height=0,time=0,last=0,timer=0,frame=0;
  let visible=false,viewDirty=true,pointer=null,paused=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function clearWires(){
    for(const item of [...wireGroup.children]){item.geometry.dispose();wireGroup.remove(item);}
  }
  function curveBetween(a,b){
    const from=new THREE.Vector3(...positions[a]), to=new THREE.Vector3(...positions[b]);
    from.y=to.y=.21;
    const middle=from.clone().lerp(to,.5);middle.y+=.3;
    return new THREE.QuadraticBezierCurve3(from,middle,to);
  }
  function setMode(next){
    if(mode===next)return;
    mode=next;clearWires();time=0;journey=new THREE.CurvePath();
    const route=routes[next];
    const present=new Set([...route.path,...route.extra.flat()]);
    for(const [key,{device,tag}] of nodes){device.visible=present.has(key);tag.hidden=!device.visible;}
    route.path.slice(1).forEach((to,index)=>{
      const curve=curveBetween(route.path[index],to);
      wireGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve,18,.035,5,false),cable));
      journey.add(curve);
    });
    for(const [from,to] of route.extra){
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curveBetween(from,to).getPoints(18)),secondary);
      line.computeLineDistances();wireGroup.add(line);
    }
    viewDirty=true;repaint();
  }
  function updateView(){
    const aspect=width/height,half=Math.max(2.65,4.65/aspect);
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
    camera.position.set(12*Math.sin(angle)*Math.cos(elevation),12*Math.sin(elevation),12*Math.cos(angle)*Math.cos(elevation));
    camera.lookAt(focus);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    for(const {tag,anchor} of nodes.values()){
      if(tag.hidden)continue;
      projected.copy(anchor).project(camera);
      tag.style.left=((projected.x+1)*50)+'%';tag.style.top=((1-projected.y)*50)+'%';
    }
    viewDirty=false;
  }
  function stop(){clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=last=0;}
  function repaint(){
    if(!visible||document.hidden||paused||!journey||!width||!height)return;
    clearTimeout(timer);timer=0;
    if(!frame)frame=requestAnimationFrame(draw);
  }
  function draw(now){
    frame=0;
    if(!visible||document.hidden||paused)return;
    if(viewDirty)updateView();
    if(!reduced.matches&&last)time+=Math.min((now-last)/1000,.15);
    last=now;
    for(let i=0;i<packetCount;i++){
      const forward=i<packetCount/2;
      const t=(time*.19+(i%4)/4+.06)%1;
      journey.getPoint(forward?t:1-t,sample);
      sample.y+=forward?.055:-.055;
      matrix.makeTranslation(sample.x,sample.y,sample.z);packets.setMatrixAt(i,matrix);
    }
    packets.instanceMatrix.needsUpdate=true;renderer.render(scene,camera);
    if(!reduced.matches)timer=setTimeout(repaint,1000/30);
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
    angle+=dx;elevation=THREE.MathUtils.clamp(elevation+dy,.32,1.15);viewDirty=true;repaint();
  }
  scope.on(stage,'pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;pointer=[e.clientX,e.clientY,e.pointerId];stage.setPointerCapture(e.pointerId);});
  scope.on(stage,'pointermove',e=>{
    if(!pointer||pointer[2]!==e.pointerId)return;
    orbit((pointer[0]-e.clientX)*.012,(e.clientY-pointer[1])*.008);
    pointer=[e.clientX,e.clientY,e.pointerId];
  });
  scope.on(stage,'lostpointercapture',()=>{pointer=null;});
  scope.on(stage,'keydown',e=>{
    const delta={ArrowLeft:[-.16,0],ArrowRight:[.16,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]}[e.key];
    if(delta){e.preventDefault();orbit(...delta);}
    if(e.key==='Home'){e.preventDefault();angle=.22;elevation=.57;orbit(0,0);}
  });
  scope.on(document,'visibilitychange',()=>{stop();repaint();});
  scope.on(reduced,'change',()=>{stop();repaint();});
  const dialogs=new MutationObserver(()=>{paused=!!document.querySelector('dialog[open]');stop();repaint();});
  dialogs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  paused=!!document.querySelector('dialog[open]');
  stage.querySelector('.mct-fallback').hidden=true;
  scope.cleanup(()=>{
    stop();viewport.disconnect();resize.disconnect();dialogs.disconnect();clearWires();
    for(const material of materials.values())material.dispose();
    for(const item of [block,packetShape,packetMaterial,cable,secondary,grid.geometry,grid.material,packets])item.dispose();
    renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    for(const {tag} of nodes.values())tag.remove();
  });
  return {setMode};
}
