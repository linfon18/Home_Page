SitePage.register('relay-field', scope => {
  const canvas = document.querySelector('.home-network canvas');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  const viewport = canvas.parentElement;
  const section = canvas.closest('.home-network');
  const controls = section.querySelector('.home-network-controls');
  const description = section.querySelector('[data-relay-description]');
  const hint = section.querySelector('[data-relay-hint]');
  const send = section.querySelector('[data-relay-send]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const logo = section.querySelector('.mct-home-icon');
  const showLogo = () => { if (logo.naturalWidth) logo.hidden = false; };
  scope.on(logo, 'load', showLogo);
  showLogo();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const nodes = {
    host: [-.79, .26, '房主'],
    guest: [.79, .10, '加入方'],
    relay: [.03, -.59, '中继服务器'],
    peerA: [-.26, -.62, '节点 A'],
    peerB: [.38, .64, '节点 B']
  };
  const modes = {
    direct: { route: ['host', 'guest'], links: [], text: 'NAT 穿透成功后，游戏数据在房主和加入方之间直传。' },
    relay: { route: ['host', 'relay', 'guest'], links: [], text: '两端各自连接服务器，游戏数据经由 Link 中继转发。' },
    mesh: { route: ['host', 'guest'], links: [['host', 'peerA'], ['peerA', 'guest'], ['guest', 'peerB'], ['peerB', 'host'], ['peerA', 'peerB']], text: 'EasyTier 节点组成虚拟网络。图中展示两端可以直连的一条路径。' }
  };
  const elevation = (x, z) => {
    const hill = (cx, cz, sx, sz) => Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
    return .32 * hill(-.52, .05, .35, .62) + .28 * hill(.54, -.28, .38, .46)
      + .12 * hill(.18, .45, .27, .36) + .027 * Math.sin(x * 10 + z * 3) * Math.cos(z * 6);
  };
  const rows = 35, columns = 73;
  const mesh = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      const x = column * 2.16 / (columns - 1) - 1.08;
      const z = row * 2 / (rows - 1) - 1;
      return { x, z, y: elevation(x, z), sx: 0, sy: 0 };
    })
  );
  const camera = { yaw: -.10, pitch: .08, xVelocity: 0, yVelocity: 0, xGoal: -.10, yGoal: .08 };
  let mode = 'direct', width = 0, height = 0, frame = 0, previous = 0;
  let burst = null, morph = null, wave = null, drag = null, visible = false;
  let entrance = null, first = true;
  let now = 0, sin, cos, pitch, scale, relief, backdrop;

  const tip = (x, z) => {
    if (!wave) return 0;
    const age = (now - wave.start) / 1000;
    const phase = (Math.hypot(x - wave.x, z - wave.z) - age * 2.2) * 8;
    return Math.cos(phase * 2) * Math.exp(-phase * phase * .5) * .13 * Math.max(0, 1 - age * .77);
  };
  function project(point) {
    const x = point.x * cos - point.z * sin * .73;
    const z = point.x * sin + point.z * cos * .73;
    const depth = 3.1 / (3.1 - z * .65);
    point.sx = width * .5 + x * scale * depth;
    point.sy = height * .57 + (z * pitch - point.y * relief) * scale * depth;
    return point;
  }
  function world(x, y, z) {
    return project({ x, y: y + tip(x, z), z });
  }
  function node(key, lift = .15) {
    const [x, z] = nodes[key];
    return world(x, elevation(x, z) + lift, z);
  }
  function line(points) {
    ctx.beginPath();
    points.forEach((p, index) => index ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy));
  }
  function routeSegment(a, b, t) {
    const [x0, z0] = nodes[a], [x1, z1] = nodes[b];
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const start = elevation(x0, z0), end = elevation(x1, z1);
    const y = start + (end - start) * t + .15 + Math.sin(Math.PI * t) * .19;
    return world(x, y, z);
  }
  function drawRoute([a, b], featured, alpha) {
    const points = Array.from({ length: 25 }, (_, i) => routeSegment(a, b, i / 24));
    line(points);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = featured ? '#89dbff' : '#507e99';
    ctx.lineWidth = featured ? 1.55 : 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function drawNode(key, alpha) {
    const base = node(key, 0), head = node(key);
    const label = nodes[key][2];
    ctx.globalAlpha = alpha;
    line([base, head]);
    ctx.strokeStyle = '#6fbad6';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#b6edff';
    ctx.beginPath();
    ctx.arc(head.sx, head.sy, 3.2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    const textWidth = ctx.measureText(label).width;
    const x = clamp(head.sx - textWidth / 2, 12, width - textWidth - 12);
    const y = Math.max(17, head.sy - 13);
    ctx.fillStyle = '#0b1b29';
    ctx.fillRect(x - 5, y - 12, textWidth + 10, 16);
    ctx.fillStyle = '#e2f5ff';
    ctx.fillText(label, x, y);
    ctx.globalAlpha = 1;
  }
  function drawMode(name, alpha) {
    const { route, links } = modes[name];
    const keys = new Set(route);
    for (const link of links) {
      drawRoute(link, false, alpha * .75);
      link.forEach(key => keys.add(key));
    }
    for (let i = 1; i < route.length; i++) drawRoute(route.slice(i - 1, i + 1), true, alpha);
    keys.forEach(key => drawNode(key, alpha));
  }
  function drawPackets() {
    const route = modes[mode].route;
    const elapsed = (now - burst.start) / 1250;
    for (let i = 0; i < 4; i++) {
      const progress = elapsed - i * .13;
      if (progress <= 0 || progress >= 1) continue;
      const path = progress * (route.length - 1), segment = Math.floor(path);
      const point = routeSegment(route[segment], route[segment + 1], path % 1);
      const glow = ctx.createRadialGradient(point.sx, point.sy, 0, point.sx, point.sy, 16);
      glow.addColorStop(0, '#8cdeffb8');
      glow.addColorStop(1, '#5ccfff00');
      ctx.fillStyle = glow;
      ctx.fillRect(point.sx - 16, point.sy - 16, 32, 32);
      ctx.fillStyle = '#effbff';
      ctx.beginPath();
      ctx.arc(point.sx, point.sy, 2.6, 0, 2 * Math.PI);
      ctx.fill();
    }
    if (elapsed >= 1 && elapsed < 1.55) {
      const end = node('guest'), progress = (elapsed - 1) / .55;
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = '#97e5ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(end.sx, end.sy, 4 + progress * 21, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  function step(time) {
    frame = 0;
    if (!width || !height || !visible || document.hidden) return;
    now = time;
    const dt = previous ? clamp((now - previous) / 1000, 0, .032) : 1 / 60;
    previous = now;
    const substeps = Math.max(1, Math.ceil(dt * 120));
    for (let i = 0; i < substeps; i++) {
      camera.xVelocity += ((camera.xGoal - camera.yaw) * 130 - camera.xVelocity * 16) * dt / substeps;
      camera.yVelocity += ((camera.yGoal - camera.pitch) * 130 - camera.yVelocity * 16) * dt / substeps;
      camera.yaw += camera.xVelocity * dt / substeps;
      camera.pitch += camera.yVelocity * dt / substeps;
    }
    sin = Math.sin(camera.yaw); cos = Math.cos(camera.yaw);
    if (entrance !== null && now - entrance > 1000) entrance = null;
    const exposure = entrance === null ? 1 : clamp((now - entrance) / 1000, 0, 1);
    relief = .42 + .58 * (1 - (1 - exposure) ** 3);
    pitch = .31 + .09 * relief + camera.pitch;
    scale = Math.min(width * .37, height * 1.05);
    if (wave && now - wave.start > 1300) wave = null;
    if (burst && now - burst.start > 1950) burst = null;
    if (morph && now - morph.start > 300) morph = null;

    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#456e842d';
    for (let y = 17; y < height; y += 21) {
      for (let x = 17; x < width; x += 21) ctx.fillRect(x, y, 1, 1);
    }
    mesh.forEach(row => row.forEach(point => {
      const y = point.y;
      point.y += tip(point.x, point.z);
      project(point);
      point.y = y;
    }));
    for (let i = 0; i < rows; i++) {
      if (width < 520 && i % 2) continue;
      line(mesh[i]);
      ctx.strokeStyle = i % 4 === 0 ? '#5197ae76' : '#32607c70';
      ctx.lineWidth = i % 4 === 0 ? .9 : .65;
      ctx.stroke();
    }
    for (let i = 0; i < columns; i += 6) {
      line(mesh.map(row => row[i]));
      ctx.strokeStyle = '#31576b66';
      ctx.lineWidth = .55;
      ctx.stroke();
    }
    if (morph) {
      const progress = clamp((now - morph.start) / 300, 0, 1);
      drawMode(morph.from, (1 - progress) * .57);
      drawMode(mode, .48 + progress * .52);
    } else drawMode(mode, 1);
    if (burst) drawPackets();
    const moving = Math.abs(camera.xGoal - camera.yaw) + Math.abs(camera.yGoal - camera.pitch)
      + Math.abs(camera.xVelocity) + Math.abs(camera.yVelocity) > .004;
    if (moving || burst || morph || wave || entrance !== null) wake();
    else previous = 0;
  }
  function wake() {
    if (visible && !frame && !document.hidden) frame = requestAnimationFrame(step);
  }
  function resize() {
    const rect = viewport.getBoundingClientRect();
    width = rect.width; height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const pixelsWide = Math.round(width * ratio), pixelsTall = Math.round(height * ratio);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsTall) {
      canvas.width = pixelsWide; canvas.height = pixelsTall;
    }
    ctx.setTransform(pixelsWide / width, 0, 0, pixelsTall / height, 0, 0);
    backdrop = ctx.createRadialGradient(width * .54, height * .53, 0, width * .54, height * .53, width * .54);
    backdrop.addColorStop(0, '#133149');
    backdrop.addColorStop(.52, '#0b2031');
    backdrop.addColorStop(1, '#08151f');
    wake();
  }
  function exchange() {
    if (reduce.matches) return;
    burst = { start: performance.now() };
    wave = { x: -.79, z: .26, start: burst.start };
    wake();
  }
  function select(name, animate) {
    if (animate && name !== mode && !reduce.matches) morph = { from: mode, start: performance.now() };
    mode = name;
    controls.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.relay === mode));
    });
    description.textContent = modes[mode].text;
    if (animate) exchange();
    wake();
  }
  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    viewport.classList.remove('is-dragging');
  }
  function park() {
    cancelAnimationFrame(frame);
    frame = previous = 0;
    burst = morph = wave = entrance = null;
    drag = null;
    viewport.classList.remove('is-dragging');
    camera.xVelocity = camera.yVelocity = 0;
    camera.xGoal = camera.yaw = -.10;
    camera.yGoal = camera.pitch = .08;
  }
  function syncMotionControls() {
    hint.hidden = reduce.matches;
    canvas.tabIndex = reduce.matches ? -1 : 0;
    canvas.setAttribute('aria-label', reduce.matches ? '联机路线示意图' : '联机路线示意图，方向键旋转，Home 重置视角');
  }
  scope.on(controls, 'click', event => {
    const button = event.target.closest('button[data-relay]');
    if (button) select(button.dataset.relay, true);
  });
  scope.on(send, 'click', exchange);
  scope.on(canvas, 'pointerdown', event => {
    if (reduce.matches || !event.isPrimary || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: camera.yaw, pitch: camera.pitch };
    viewport.classList.add('is-dragging');
  });
  scope.on(canvas, 'pointermove', event => {
    if (reduce.matches) return;
    if (drag?.id === event.pointerId) {
      camera.xGoal = clamp(drag.yaw + (event.clientX - drag.x) * .0045, -.66, .66);
      camera.yGoal = clamp(drag.pitch + (event.clientY - drag.y) * .0035, -.14, .22);
    } else if (event.pointerType === 'mouse' && !event.buttons) {
      const rect = canvas.getBoundingClientRect();
      camera.xGoal = -.10 + (event.clientX - rect.left - width / 2) / width * .21;
      camera.yGoal = .08 + (event.clientY - rect.top - height / 2) / height * .1;
    } else return;
    wake();
  }, { passive: true });
  scope.on(canvas, 'pointerleave', () => {
    if (drag || reduce.matches) return;
    camera.xGoal = -.10;
    camera.yGoal = .08;
    wake();
  });
  scope.on(canvas, 'lostpointercapture', release);
  scope.on(canvas, 'keydown', event => {
    if (reduce.matches) return;
    switch (event.key) {
      case 'ArrowLeft': camera.xGoal = clamp(camera.xGoal - .10, -.66, .66); break;
      case 'ArrowRight': camera.xGoal = clamp(camera.xGoal + .10, -.66, .66); break;
      case 'ArrowUp': camera.yGoal = clamp(camera.yGoal - .05, -.14, .22); break;
      case 'ArrowDown': camera.yGoal = clamp(camera.yGoal + .05, -.14, .22); break;
      case 'Home': camera.xGoal = -.10; camera.yGoal = .08; break;
      default: return;
    }
    event.preventDefault();
    wake();
  });
  scope.on(document, 'visibilitychange', () => { park(); wake(); });
  scope.on(reduce, 'change', () => { syncMotionControls(); park(); wake(); });
  const sizing = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) { park(); return; }
    if (first && entry.intersectionRatio >= .28) {
      first = false;
      if (!reduce.matches) entrance = performance.now();
      if (!burst) exchange();
    }
    wake();
  }, { threshold: [0, .28] });
  scope.cleanup(() => { park(); sizing.disconnect(); intersection.disconnect(); });
  controls.hidden = viewport.hidden = false;
  syncMotionControls();
  sizing.observe(viewport);
  intersection.observe(viewport);
  resize();
  select(mode, false);
});
