/* One screen-space compositor for actual page surfaces. Text stays in the DOM.
   Rounded slab normals refract the wallpaper; there is no demonstration object. */
(() => {
  'use strict';
  const canvas=document.querySelector('[data-global-glass]');
  if(!canvas)return;
  const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl)return;
  const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const max=Math.min(24,Math.floor((gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)-16)/2));
  if(max<4)return;
  const vertex='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const fragment=`precision mediump float;
  #define N ${max}
  uniform vec2 uSize,uImage,uPointer,uHit,uSceneOffset;
  uniform float uRatio,uTime,uDark,uHitAge;
  uniform int uCount;
  uniform vec4 uRect[N];
  uniform vec2 uShape[N];
  uniform sampler2D uTexture,uBlurTexture;
  float rounded(vec2 p,vec2 halfSize,float radius){vec2 q=abs(p)-halfSize+radius;return length(max(q,0.))+min(max(q.x,q.y),0.)-radius;}
  vec2 uv(vec2 p){float scale=max(uSize.x/uImage.x,uSize.y/uImage.y);return clamp((p-uSize*.5-uSceneOffset)/(uImage*scale*1.045)+.5,vec2(.001),vec2(.999));}
  void main(){
    vec2 p=vec2(gl_FragCoord.x/uRatio,uSize.y-gl_FragCoord.y/uRatio);
    float distance=10000.,radius=0.,strength=0.;vec2 local=vec2(0.),halfSize=vec2(0.);
    for(int j=0;j<N;j++){
      if(j<uCount){vec4 r=uRect[j];vec2 h=r.zw*.5;vec2 q=p-r.xy-h;float d=rounded(q,h,uShape[j].x);
        if(d<1.){distance=d;radius=uShape[j].x;strength=uShape[j].y;local=q;halfSize=h;}}
    }
    if(distance>1.){gl_FragColor=vec4(0.);return;}
    vec2 normal=normalize(vec2(rounded(local+vec2(.8,0.),halfSize,radius)-rounded(local-vec2(.8,0.),halfSize,radius),rounded(local+vec2(0.,.8),halfSize,radius)-rounded(local-vec2(0.,.8),halfSize,radius))+vec2(.0001));
    float depth=max(0.,-distance);
    float bevel=mix(19.,10.,step(.5,strength)* (1.-step(1.5,strength)));
    float slope=clamp(1.-depth/bevel,0.,.96);
    float nz=sqrt(1.-slope*slope);
    vec3 surfaceNormal=normalize(vec3(normal*slope,nz));
    // Snell refraction through a convex meniscus with a 1.46 index of refraction.
    vec3 ray=refract(vec3(0.,0.,-1.),surfaceNormal,1./1.46);
    vec2 bend=ray.xy/max(abs(ray.z),.2)*30.;
    float pointerGlow=exp(-length(p-uPointer)/190.);
    float wave=sin(length(p-uHit)*.045-uHitAge*7.)*exp(-uHitAge*1.6)*exp(-abs(length(p-uHit)-uHitAge*240.)/110.);
    vec2 flow=vec2(sin(p.y*.010+uTime*.65),cos(p.x*.008-uTime*.5));
    vec2 lens=local*.023+flow*(1.3+pointerGlow*2.3);
    lens+=normalize(p-uPointer+vec2(.001))*pointerGlow*5.;
    vec2 refracted=p+bend-lens+normal*wave*5.;
    float edge=1.-smoothstep(0.,bevel+10.,depth);
    vec3 scene=texture2D(uBlurTexture,uv(refracted)).rgb;
    scene=mix(scene,texture2D(uTexture,uv(refracted)).rgb,edge*.85);
    vec3 split=vec3(texture2D(uTexture,uv(refracted-normal*5.)).r,scene.g,texture2D(uTexture,uv(refracted+normal*5.)).b);
    scene=mix(scene,split,edge*.28);
    vec3 tint=mix(vec3(.906,.941,.984),vec3(.024,.059,.125),uDark);
    // Match the wallpaper's exposure first; then add a small clear material tint.
    vec3 color=mix(scene,tint,mix(.66,.77,uDark));
    float textProtection=(1.-smoothstep(-.20,.55,local.x/max(halfSize.x,1.)))*.26;
    float reading=step(1.5,strength);
    float coating=mix(.055,.025,uDark)+textProtection+reading*.18;
    color=mix(color,mix(vec3(.97,.984,1.),vec3(.025,.046,.078),uDark),coating);
    float fresnel=pow(1.-nz,3.);
    float directional=dot(normal,normalize(uPointer-p+vec2(-250.,-350.)));
    float rim=exp(-pow((depth-1.5)/1.2,2.));
    float innerRim=exp(-pow((depth-8.)/3.5,2.));
    float caustic=exp(-pow((depth-19.)/5.,2.));
    color+=fresnel*.11+rim*(.16+.22*max(directional,0.));
    color-=innerRim*.065;
    color+=caustic*max(-directional,0.)*.11;
    color+=edge*pointerGlow*.07+wave*.015;
    gl_FragColor=vec4(color,1.-smoothstep(-.5,1.,distance));
  }`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;}
  const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
  if(!vs||!fs)return;
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
  gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const attr=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
  const uniforms={};['uSceneOffset','uSize','uImage','uPointer','uHit','uRatio','uTime','uDark','uHitAge','uCount','uRect[0]','uShape[0]','uTexture','uBlurTexture'].forEach(name=>uniforms[name]=gl.getUniformLocation(program,name));
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1i(uniforms.uTexture,0);
  let ready=false,ratio=1,request=0,last=0,hitAt=-100000,hit=[-1000,-1000],pointer=[-1000,-1000],scene=[0,0],nodes=[];
  function layer(el){
    if(el._glassLayer)return;
    const c=document.createElement('canvas');c.className='layer-glass';c.setAttribute('aria-hidden','true');el.prepend(c);el._glassLayer=c;el._glassContext=c.getContext('2d');
  }
  function surfaces(){document.querySelectorAll('.nav-shell,.theme-menu,.main-nav.is-open').forEach(layer);nodes=Array.from(document.querySelectorAll('.pane,.nav-shell,.theme-menu,.main-nav.is-open')).filter(el=>!el.closest('dialog'));nodes.sort((a,b)=>score(a)-score(b));wake();}
  function score(el){return el.matches('.theme-menu,.main-nav')?3:el.matches('.nav-shell')?2:el.closest('.site-header')?1:0;}
  function resize(){ratio=Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.35);canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);gl.viewport(0,0,canvas.width,canvas.height);wake();}
  function draw(now){request=0;if(!ready||document.hidden||gl.isContextLost())return;
    if(!reduced.matches&&now-last<32){request=requestAnimationFrame(draw);return;}last=now;
    const rects=new Float32Array(max*4),shapes=new Float32Array(max*2);let count=0;
    for(const node of nodes){if(!node.getClientRects().length)continue;const r=node.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;const style=getComputedStyle(node);if(style.visibility==='hidden'||Number(style.opacity)<.15)continue;if(count===max)break;rects.set([r.x,r.y,r.width,r.height],count*4);shapes.set([Math.min(parseFloat(style.borderTopLeftRadius)||20,r.width/2,r.height/2),node.matches('.reading-page,.article-pane,.writing-index')?2:node.matches('.nav-shell,.theme-menu')?1:0],count*2);count++;}
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2fv(uniforms.uSceneOffset,scene);gl.uniform2f(uniforms.uSize,innerWidth,innerHeight);gl.uniform1f(uniforms.uRatio,ratio);gl.uniform1f(uniforms.uTime,reduced.matches?0:now*.001);gl.uniform1f(uniforms.uDark,root.dataset.theme==='dark'?1:0);gl.uniform2fv(uniforms.uPointer,pointer);gl.uniform2fv(uniforms.uHit,hit);gl.uniform1f(uniforms.uHitAge,reduced.matches?100:Math.min(100,(now-hitAt)*.001));gl.uniform1i(uniforms.uCount,count);gl.uniform4fv(uniforms['uRect[0]'],rects);gl.uniform2fv(uniforms['uShape[0]'],shapes);gl.drawArrays(gl.TRIANGLES,0,6);
    // Copy the same GPU result into the header stacking layer. This occludes
    // lower DOM text without rasterizing the header's own accessible text.
    for(const el of nodes){
      if(!el._glassLayer||!el._glassContext||!el.getClientRects().length)continue;
      if(el.matches('.main-nav')&&!el.classList.contains('is-open'))continue;
      const r=el.getBoundingClientRect(),c=el._glassLayer,ctx=el._glassContext;
      if(r.bottom<0||r.top>innerHeight)continue;
      const w=Math.max(1,Math.round(r.width*ratio)),h=Math.max(1,Math.round(r.height*ratio));
      if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
      ctx.clearRect(0,0,w,h);ctx.drawImage(canvas,r.left*ratio,r.top*ratio,r.width*ratio,r.height*ratio,0,0,w,h);
    }
    canvas.dataset.surfaces=String(count);
    if(!reduced.matches)request=requestAnimationFrame(draw);
  }
  function wake(){if(ready&&!request&&!document.hidden)request=requestAnimationFrame(draw);}
  const picture=new Image();picture.onload=()=>{
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,picture);
    // Blur once on load, rather than approximating blur with offset copies each frame.
    const soft=document.createElement('canvas');soft.width=1024;soft.height=Math.round(1024*picture.naturalHeight/picture.naturalWidth);
    const ctx=soft.getContext('2d');ctx.drawImage(picture,0,0,soft.width,soft.height);ctx.filter='blur(8px)';ctx.drawImage(picture,0,0,soft.width,soft.height);
    const blurred=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,blurred);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,soft);gl.uniform1i(uniforms.uBlurTexture,1);
    gl.uniform2f(uniforms.uImage,picture.naturalWidth,picture.naturalHeight);ready=true;root.classList.add('global-glass-ready');surfaces();resize();
  };picture.src='/assets/original-background.jpg';
  addEventListener('resize',resize);addEventListener('scroll',wake,{passive:true});
  addEventListener('pointermove',e=>{pointer=[e.clientX,e.clientY];if(!reduced.matches)wake();},{passive:true});
  addEventListener('pointerdown',e=>{hit=[e.clientX,e.clientY];hitAt=performance.now();wake();},{passive:true});
  addEventListener('site-theme',wake);addEventListener('scene-shift',event=>{scene=event.detail;wake();});
  document.addEventListener('visibilitychange',wake);reduced.addEventListener('change',wake);
  new MutationObserver(surfaces).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class','open'],childList:true});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;root.classList.remove('global-glass-ready');});
})();
