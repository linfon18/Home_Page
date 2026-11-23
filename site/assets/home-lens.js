(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let map;

  function displacement() {
    if (map) return map;
    const n = 160, canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d');
    const pixels = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = (x + .5) / n * 2 - 1, v = (y + .5) / n * 2 - 1;
      const dx = Math.abs(u) - .36, dy = Math.abs(v) - .36;
      const edge = Math.hypot(Math.max(0, dx), Math.max(0, dy)) + Math.min(Math.max(dx, dy), 0) - .64;
      const bend = .16 + .095 * Math.exp(-Math.pow((edge + .09) / .16, 2));
      const i = (y * n + x) * 4;
      pixels.data.set([128 - u * bend * 254, 128 - v * bend * 254, 128, 255], i);
    }
    ctx.putImageData(pixels, 0, 0);
    map = canvas.toDataURL();
    return map;
  }

  SitePage.register('home-lens', scope => {
    const card = document.querySelector('.home-profile');
    if (!card) return;
    const lens = document.createElement('button');
    lens.className = 'home-lens';
    lens.type = 'button';
    lens.setAttribute('aria-label', '玻璃透镜，拖动或使用方向键移动，回车复位');
    lens.title = '拖动透镜';
    lens.innerHTML = '<svg aria-hidden="true" width="0" height="0"><defs><filter id="home-lens-optics" filterUnits="userSpaceOnUse" x="0" y="0" color-interpolation-filters="sRGB"><feImage result="surface" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="surface" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".32"/></filter></defs></svg><i aria-hidden="true"></i>';
    card.append(lens);
    const filter = lens.querySelector('filter'), texture = lens.querySelector('feImage');
    texture.setAttribute('href', displacement());
    const warp = lens.querySelector('feDisplacementMap');
    let size, bounds, homeX, homeY, gx, gy, x, y, vx = 0, vy = 0, frame = 0, last = 0;
    let drag = null, adjusted = false, entry = true;
    function place() {
      const squash = drag && !reduced.matches ? .955 : 1;
      const stretch = reduced.matches ? 0 : clamp((Math.abs(vx) - Math.abs(vy)) * .0024, -.095, .095);
      lens.style.transform = `translate3d(${x}px,${y}px,0) scale(${squash + stretch},${squash - stretch})`;
    }
    function wake() {
      if (!frame && !document.hidden) frame = requestAnimationFrame(step);
    }
    function step(now) {
      frame = 0;
      const dt = last ? clamp((now - last) / 16.67, .4, 2) : 1;
      last = now;
      for (let i = 0; i < 2; i++) {
        const d = dt / 2;
        vx = (vx + (gx - x) * .19 * d) * Math.pow(.64, d);
        vy = (vy + (gy - y) * .19 * d) * Math.pow(.64, d);
        x += vx * d;
        y += vy * d;
      }
      if (reduced.matches || Math.abs(gx-x) + Math.abs(gy-y) + Math.abs(vx) + Math.abs(vy) < .1) {
        x = gx; y = gy; vx = vy = last = 0;
      } else wake();
      place();
    }
    function aim(px, py) {
      gx = clamp(px, 6, bounds.right);
      gy = clamp(py, bounds.top, bounds.bottom);
      wake();
    }
    function measure() {
      const title = card.querySelector('h1');
      const range = document.createRange();
      range.selectNodeContents(title);
      const label = range.getBoundingClientRect(), rect = card.getBoundingClientRect();
      size = lens.offsetWidth;
      for (const el of [filter, texture]) {
        el.setAttribute('width', size);
        el.setAttribute('height', size);
      }
      warp.setAttribute('scale', size * .58);
      bounds = { right: card.clientWidth - size - 6, top: 6, bottom: card.querySelector('.home-buttons').getBoundingClientRect().top - rect.top - size - 5 };
      homeX = label.right - rect.left - size * .58;
      homeY = label.top - rect.top + label.height / 2 - size * .5;
      aim(adjusted ? gx : homeX, adjusted ? gy : homeY);
      if (entry) {
        entry = false;
        x = gx + (reduced.matches ? 0 : 36); y = gy - (reduced.matches ? 0 : 12);
        place();
      }
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    scope.on(lens, 'pointerdown', e => {
      if (drag || e.button !== 0 || !e.isPrimary) return;
      drag = { id: e.pointerId, cx: e.clientX, cy: e.clientY, x, y, trailX: e.clientX, trailY: e.clientY };
      lens.setPointerCapture(e.pointerId);
      lens.classList.add('is-held');
      wake();
    });
    scope.on(lens, 'pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      adjusted = true;
      aim(drag.x + e.clientX - drag.cx, drag.y + e.clientY - drag.cy);
      if (!reduced.matches && Math.hypot(e.clientX - drag.trailX, e.clientY - drag.trailY) > 17) {
        drag.trailX = e.clientX; drag.trailY = e.clientY;
        const glint = document.createElement('i');
        glint.className = 'lens-glint';
        glint.style.left = `${x + size * .5}px`;
        glint.style.top = `${y + size * .5}px`;
        card.append(glint);
        glint.addEventListener('animationend', () => glint.remove(), { once: true });
        if (card.querySelectorAll('.lens-glint').length > 12) card.querySelector('.lens-glint').remove();
      }
    });
    scope.on(lens, 'lostpointercapture', () => {
      drag = null;
      lens.classList.remove('is-held');
      aim(gx + vx * 2, gy + vy * 2);
    });
    scope.on(lens, 'click', e => {
      if (!e.detail) { adjusted = false; aim(homeX, homeY); }
    });
    scope.on(lens, 'keydown', e => {
      const move = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if (!move) return;
      e.preventDefault();
      adjusted = true;
      aim(gx + move[0] * 16, gy + move[1] * 16);
    });
    scope.cleanup(() => { observer.disconnect(); cancelAnimationFrame(frame); });
  });
})();
