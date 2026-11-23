(() => {
  'use strict';
  const nav = document.querySelector('.main-nav');
  if (!nav) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const glass = document.createElement('span');
  glass.className = 'nav-tracker';
  glass.hidden = true;
  glass.setAttribute('aria-hidden', 'true');
  nav.prepend(glass);

  // One reusable normal map bends the wallpaper at the two ends of the pill.
  const map = document.createElement('canvas');
  map.width = 96; map.height = 48;
  const context = map.getContext('2d');
  if (context) {
    const pixels = context.createImageData(96, 48);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 96; x++) {
      const dx = x + .5 - Math.max(24, Math.min(72, x + .5));
      const dy = y + .5 - 24;
      const radius = Math.hypot(dx, dy) / 24;
      const strength = .18 + .8 * Math.exp(-Math.pow((radius - .82) / .18, 2));
      pixels.data.set([128 - dx * 4.8 * strength, 128 - dy * 4.8 * strength, 128, 255], (y * 96 + x) * 4);
    }
    context.putImageData(pixels, 0, 0);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width','0'); svg.setAttribute('height','0');
    svg.style.position='absolute'; svg.setAttribute('aria-hidden','true');
    svg.innerHTML = '<defs><filter id="nav-refraction" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage width="100%" height="100%" preserveAspectRatio="none" result="normal"/><feDisplacementMap in="SourceGraphic" in2="normal" scale="18" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
    svg.querySelector('feImage').setAttribute('href', map.toDataURL());
    document.body.append(svg);
    glass.classList.add('has-optics');
  }

  let hovered = null, frame = 0, previous = 0, target, position = [], velocity = [0,0,0], heading = 1;
  function paint() {
    const [left,right,top] = position;
    glass.style.transform = `translate3d(${left}px,${top}px,0)`;
    glass.style.width = `${Math.max(target.width * .78, Math.min(target.width * 1.55, right-left))}px`;
  }
  function step(now) {
    frame = 0;
    // Integrate in small steps so reversals keep their momentum at any refresh rate.
    const delta = previous ? Math.min(.042, (now - previous) / 1000) : 1/60;
    previous = now;
    const steps = Math.ceil(delta * 240);
    const dt = delta / steps;
    for (let n = 0; n < steps; n++) for (let i = 0; i < 3; i++) {
      const lead = i === (heading > 0 ? 1 : 0);
      const frequency = lead ? 28 : 21;
      velocity[i] += ((target.edges[i] - position[i]) * frequency ** 2 - 1.62 * frequency * velocity[i]) * dt;
      position[i] += velocity[i] * dt;
    }
    if (position.every((v,i)=>Math.abs(v-target.edges[i])<.12 && Math.abs(velocity[i])<1.5)) {
      position = target.edges.slice(); velocity.fill(0); previous = 0;
    } else frame = requestAnimationFrame(step);
    paint();
  }
  function follow() {
    const link = nav.querySelector('a:focus-visible') || hovered || nav.querySelector('[aria-current=page]');
    const snap = reduced.matches || glass.hidden || document.hidden;
    if (!link || !nav.getClientRects().length || document.hidden) {
      cancelAnimationFrame(frame); frame = previous = 0; glass.hidden = true;
      return;
    }
    const left = link.offsetLeft, width = link.offsetWidth;
    heading = left >= (position[0] || 0) ? 1 : -1;
    target = {width, edges:[left,left+width,link.offsetTop]};
    glass.hidden = false;
    glass.style.height = link.offsetHeight+'px';
    if (snap) {
      cancelAnimationFrame(frame); frame = previous = 0;
      position = target.edges.slice(); velocity.fill(0); paint();
    } else if (!frame) frame = requestAnimationFrame(step);
  }
  nav.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const link = e.target.closest('a');
    if (link && link !== hovered) { hovered = link; follow(); }
  });
  nav.addEventListener('pointerleave', () => { hovered = null; follow(); });
  nav.addEventListener('focusin', follow);
  nav.addEventListener('focusout', () => queueMicrotask(follow));
  addEventListener('site-page', () => { hovered = null; follow(); });
  addEventListener('resize', follow);
  reduced.addEventListener('change', follow);
  document.addEventListener('visibilitychange', follow);
  new MutationObserver(follow).observe(nav,{attributes:true,attributeFilter:['class']});
  if (document.fonts) document.fonts.ready.then(follow);
  follow();
})();
