/* The same points describe the incoming current and the halftone photograph. */
SitePage.register('portrait-field', scope => {
  const cover = document.querySelector('.portrait-cover');
  if (!cover) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = cover.querySelector('canvas');
  const still = cover.querySelector('.portrait-still');
  const gl = canvas.getContext('webgl', {alpha:true, depth:false, antialias:false, powerPreference:'low-power'});
  if (!gl) return;
  const vertex = `
    attribute vec2 sampleUV;
    attribute vec3 rgb;
    uniform vec2 size, aim, cursor;
    uniform float ratio, formation, scrollPhase, dark, strength;
    varying vec4 ink;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      bool narrow = size.x < 620.;
      float side = narrow ? min(size.x*.73,size.y*.82) : min(size.x*.46,size.y*1.02);
      vec2 center = size * (narrow ? vec2(.72,.385) : vec2(.735,.49));
      vec2 local = sampleUV-.5;
      float noise = hash(sampleUV);
      float value = dot(rgb,vec3(.25,.62,.13));
      float depth = .7*(1.-length(local)*1.45)+value*.42;
      vec2 position = center+local*side;
      position += aim*side*(depth-.43)*.15;
      // During the scroll-out the foreground plane peels away from the still type.
      float turn=scrollPhase*.63;
      position.x+=side*(local.x*(cos(turn)-1.)+(depth-.43)*sin(turn)*.68);
      position.y-=scrollPhase*side*(.03+.13*depth);
      vec2 delta=position-cursor;
      float gap=length(delta);
      float influence=exp(-gap*gap/(side*side*.026));
      position+=delta/(gap+1.)*strength*influence*side*.084;
      float t=clamp(formation*1.36-.32*sampleUV.x,0.,1.);
      float spread=(1.-t)*(1.-t);
      float angle=local.y*8.+local.x*3.+noise*.23;
      position.x-=spread*size.x*(.32+.65*sampleUV.x);
      position.y+=spread*(sin(angle)*.35+local.y*.28)*size.y;
      float vignette=1.-smoothstep(.39,.63,length(local*vec2(1.07,.88)));
      vec2 edge=min(sampleUV,1.-sampleUV);
      vignette*=smoothstep(0.,.16,edge.x)*smoothstep(0.,.085,edge.y);
      float weight=mix(1.-value,value,dark);
      vec3 shadow=mix(vec3(.035,.145,.142),vec3(.20,.48,.46),dark);
      vec3 light=mix(vec3(.63,.46,.23),vec3(1.,.91,.71),dark);
      vec3 color=mix(shadow,light,smoothstep(.28,.91,value));
      ink=vec4(mix(color,rgb,.16),vignette*(.52+.48*weight));
      gl_PointSize=max(1.,side/146.*ratio*(.72+.76*weight));
      gl_Position=vec4(position/size*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);
    }`;
  const fragment = `precision mediump float; varying vec4 ink;
    void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(ink.rgb,ink.a*(1.-smoothstep(.34,.5,r)));}`;
  const program = gl.createProgram();
  const shaders = [vertex,fragment].map((source,i) => {
    const shader=gl.createShader(i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER);
    gl.shaderSource(shader,source);gl.compileShader(shader);gl.attachShader(program,shader);return shader;
  });
  gl.linkProgram(program);
  const buffer=gl.createBuffer();
  scope.cleanup(()=>{gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl.getExtension('WEBGL_lose_context')?.loseContext();});
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return;
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  for (const [name,components,offset] of [['sampleUV',2,0],['rgb',3,8]]) {
    const index=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,components,gl.FLOAT,false,20,offset);
  }
  gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const u={};for(const name of ['size','aim','cursor','ratio','formation','scrollPhase','dark','strength'])u[name]=gl.getUniformLocation(program,name);
  let visible=false, count=0, frame=0, start=null, last=0, width=1, height=1, ratio=1;
  let opening=document.documentElement.dataset.homeVisit==='first' && !location.hash;
  let targetX=0,targetY=0,x=0,y=0,force=0,targetForce=0,scrollPhase=0;
  function wake(){if(count && visible && !frame && !reduced.matches && !document.hidden)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;
    if(start===null)start=now;
    const follow=1-Math.exp(-Math.min(64,last ? now-last : 16)/80);last=now;
    x+=(targetX-x)*follow;y+=(targetY-y)*follow;force+=(targetForce-force)*follow;
    const t=opening ? Math.min(1,(now-start)/1460) : 1;
    gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(u.size,width,height);gl.uniform1f(u.ratio,ratio);
    gl.uniform2f(u.aim,x,y);gl.uniform2f(u.cursor,(x+1)*width/2,(y+1)*height/2);gl.uniform1f(u.strength,force);
    gl.uniform1f(u.dark,document.documentElement.dataset.theme==='dark'?1:0);
    gl.uniform1f(u.scrollPhase,scrollPhase);gl.uniform1f(u.formation,t);gl.drawArrays(gl.POINTS,0,count);
    cover.classList.add('has-portrait');if(t===1)opening=false;
    if(opening || Math.abs(x-targetX)+Math.abs(y-targetY)+Math.abs(force-targetForce)>.002)wake();else last=0;
  }
  function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);gl.viewport(0,0,canvas.width,canvas.height);wake();}
  function sample(){
    if(!still.naturalWidth)return;
    const n=146, image=document.createElement('canvas');image.width=image.height=n;
    const ctx=image.getContext('2d');let pixels;
    try{ctx.drawImage(still,0,0,n,n);pixels=ctx.getImageData(0,0,n,n).data;}catch(_){return;}
    const data=new Float32Array(n*n*5);
    for(let i=0;i<n*n;i++){const k=i*5;data[k]=(i%n+.5)/n;data[k+1]=(Math.floor(i/n)+.5)/n;
      for(let ch=0;ch<3;ch++)data[k+2+ch]=pixels[i*4+ch]/255;}
    gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);count=n*n;wake();
  }
  function point(e){const r=canvas.getBoundingClientRect();targetX=2*(e.clientX-r.left)/width-1;targetY=2*(e.clientY-r.top)/height-1;targetForce=e.buttons?1.7:1;wake();}
  function release(){targetX=targetY=targetForce=0;wake();}
  function pause(){cancelAnimationFrame(frame);frame=0;last=0;}
  function preference(){pause();if(reduced.matches){opening=false;cover.classList.remove('has-portrait');}else wake();}
  const viewport=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible)wake();else pause();});viewport.observe(cover);
  const sizing=new ResizeObserver(resize);sizing.observe(cover);
  const theme=new MutationObserver(wake);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  scope.on(still,'load',sample);sample();scope.on(cover,'pointermove',point,{passive:true});scope.on(cover,'pointerdown',point,{passive:true});
  scope.on(cover,'pointerleave',release);scope.on(cover,'pointercancel',release);scope.on(window,'pointerup',release);
  scope.on(window,'scroll',()=>{if(visible){scrollPhase=Math.min(1,Math.max(0,-cover.getBoundingClientRect().top/height));wake();}},{passive:true});
  scope.on(document,'visibilitychange',()=>{if(document.hidden)pause();else wake();});scope.on(reduced,'change',preference);
  scope.on(canvas,'webglcontextlost',()=>{count=0;pause();cover.classList.remove('has-portrait');});
  scope.cleanup(()=>{pause();viewport.disconnect();sizing.disconnect();theme.disconnect();});
});
