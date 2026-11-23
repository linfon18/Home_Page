/* A short packet exchange over a deformable contour map. Only draw while a wave travels. */
SitePage.register('relay-preview', scope => {
  const canvas = document.querySelector('.home-project-preview canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.hidden = true; return; }
  const card = canvas.closest('a');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const rows = 20, cols = 54, routeRow = 10;
  let w, h, points = [], waves = [], packet = -Infinity, frame = 0, visible = false, lastStroke = -Infinity;
  let ink, surface, accent, lastX = 0, lastY = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    const density = Math.min(devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(w * density); canvas.height = Math.round(h * density);
    ctx.setTransform(density, 0, 0, density, 0, 0);
    const style = getComputedStyle(canvas);
    ink = style.color; surface = style.backgroundColor; accent = style.getPropertyValue('--route-ink').trim();
    points = Array.from({length: rows}, (_, z) => Array.from({length: cols}, (_, x) => {
      const u = x / (cols - 1), v = z / (rows - 1);
      const ridge = (cx, cz, sx, sz) => Math.exp(-(((u-cx)/sx)**2 + ((v-cz)/sz)**2));
      const elevation = .49*ridge(.31,.48,.12,.48) + .35*ridge(.69,.26,.19,.32) + .11*ridge(.48,.57,.21,.65);
      const py = h*(.23 + .82*v - elevation + .035*Math.sin(u*23+v*3));
      return {x: w*(u*1.12-.06+.07*(v-.5)), y: py, py};
    }));
    wake();
  }
  function wake() {
    if (visible && !document.hidden && !frame) frame = requestAnimationFrame(draw);
  }
  function draw(now) {
    frame = 0;
    if (!points.length || !w || !h || !visible || document.hidden) return;
    waves = waves.filter(wave => now-wave.start < 1050);
    ctx.clearRect(0,0,w,h);
    points.forEach((row,z) => {
      ctx.beginPath();
      row.forEach((p,i) => {
        p.py = p.y;
        for (const wave of waves) {
          const age = (now-wave.start)/1000;
          const phase = (Math.hypot(p.x-wave.x,(p.y-wave.y)*1.3)-age*210)/19;
          if (Math.abs(phase)<3.5) p.py -= 17*Math.cos(phase*1.4)*Math.exp(-phase*phase*.48)*(1-age/1.05)**2;
        }
        if (i) ctx.lineTo(p.x,p.py); else ctx.moveTo(p.x,p.py);
      });
      ctx.lineTo(row[cols-1].x,h+1);ctx.lineTo(row[0].x,h+1);ctx.fillStyle=surface;ctx.fill();
      ctx.beginPath();row.forEach((p,i)=>i ? ctx.lineTo(p.x,p.py) : ctx.moveTo(p.x,p.py));
      ctx.strokeStyle = z===routeRow ? accent : ink;ctx.lineWidth = z===routeRow ? 1.8 : .8;ctx.stroke();
    });
    const route = points[routeRow], host = 12, peer = 41;
    const travel = (now-packet)/900;
    function pin(index,label) {
      const p=route[index], top=Math.max(14,p.py-18);
      ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(p.x,top+3);ctx.lineTo(p.x,p.py);ctx.stroke();
      ctx.fillRect(p.x-2,p.py-2,4,4);ctx.font='10px Consolas, monospace';ctx.fillText(label,p.x+5,top);
    }
    ctx.strokeStyle=accent;ctx.lineWidth=1.6;ctx.beginPath();
    for(let n=host;n<=peer;n++){const p=route[n];if(n===host)ctx.moveTo(p.x,p.py);else ctx.lineTo(p.x,p.py);}
    ctx.stroke();
    pin(host,'HOST');pin(peer,'PEER');
    if (travel>=0 && travel<2) {
      const t=travel<1 ? travel : 2-travel, n=host+(peer-host)*t;
      const a=route[Math.floor(n)], b=route[Math.ceil(n)], f=n%1;
      const x=a.x+(b.x-a.x)*f, y=a.py+(b.py-a.py)*f;
      ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x,y,3.3,0,Math.PI*2);ctx.fill();
      if(travel>=1 && travel<1.4){const p=route[peer];ctx.globalAlpha=1-(travel-1)/.4;ctx.beginPath();ctx.arc(p.x,p.py,3+(travel-1)*38,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    }
    if(waves.length || travel<2) wake();
  }
  function exchange() {if(reduced.matches)return;packet=performance.now();wake();}
  function disturb(e) {
    if(reduced.matches)return;
    const now=performance.now(), box=canvas.getBoundingClientRect();
    const x=e.clientX-box.left,y=e.clientY-box.top;
    if(e.type==='pointermove' && (now-lastStroke<85 || Math.hypot(x-lastX,y-lastY)<6))return;
    lastStroke=now;lastX=x;lastY=y;
    waves.push({x,y,start:now});if(waves.length>4)waves.shift();wake();
  }
  function park() {cancelAnimationFrame(frame);frame=0;waves=[];packet=-Infinity;}
  scope.on(card,'pointerenter',exchange);scope.on(card,'focus',exchange);
  scope.on(canvas,'pointermove',disturb,{passive:true});scope.on(canvas,'pointerdown',disturb,{passive:true});
  scope.on(document,'visibilitychange',()=>{park();wake();});scope.on(reduced,'change',()=>{park();wake();});
  let first = document.documentElement.dataset.homeVisit==='first';
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible){park();return;}if(first){first=false;exchange();}wake();});
  const sizing=new ResizeObserver(resize), theme=new MutationObserver(resize);
  sizing.observe(canvas);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});observer.observe(canvas);
  scope.cleanup(()=>{park();sizing.disconnect();observer.disconnect();theme.disconnect();});
});
