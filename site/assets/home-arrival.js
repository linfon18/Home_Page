(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  SitePage.register('home-arrival', scope => {
    const title = document.querySelector('#home-name');
    if (!title) return;
    const letters = Array.from(title.querySelectorAll('.name-type i:not(.name-period)'), el => ({ el, y: 0, v: 0, target: 0 }));
    const panel = title.closest('.home-profile');
    let frame = 0, last = 0, pressed = false;
    let rimFrame = 0, pointer = null;

    // A damped string: each glyph has mass, a rest position and two neighbours.
    // Integrate in small steps so a slow frame cannot launch the letters offscreen.
    function step(now) {
      frame = 0;
      const elapsed = last ? Math.min((now - last) / 1000, .04) : 1 / 60;
      last = now;
      const steps = Math.max(1, Math.ceil(elapsed * 120)), dt = elapsed / steps;
      for (let n = 0; n < steps; n++) {
        letters.forEach((l, i) => {
          const left = i ? letters[i - 1].y : l.y;
          const right = i + 1 < letters.length ? letters[i + 1].y : l.y;
          l.v += ((l.target - l.y) * 270 + (left + right - 2 * l.y) * 75 - 17 * l.v) * dt;
        });
        letters.forEach(l => { l.y += l.v * dt; });
      }
      const busy = letters.some(l => Math.abs(l.v) > .15);
      // Residual displacement from neighbouring letters is expected at rest.
      letters.forEach((l, i) => {
        const slope = (letters[Math.min(i + 1, letters.length - 1)].y - letters[Math.max(0, i - 1)].y) * .48;
        if (!busy && !letters.some(n => n.target)) l.el.style.removeProperty('transform');
        else l.el.style.transform = `translateY(${l.y.toFixed(2)}px) rotate(${slope.toFixed(2)}deg)`;
      });
      if (busy) frame = requestAnimationFrame(step);
      else last = 0;
    }
    function wake() {
      if (!frame) frame = requestAnimationFrame(step);
    }
    function respond(event) {
      if (reduce.matches || document.hidden) return;
      const x = event.clientX - title.getBoundingClientRect().left;
      const amplitude = pressed ? 16 : -8;
      letters.forEach(l => {
        const distance = (x - l.el.offsetLeft - l.el.offsetWidth / 2) / 28;
        l.target = amplitude * Math.exp(-.5 * distance * distance);
      });
      wake();
    }
    function release() {
      pressed = false;
      if (!letters.some(l => l.target)) return;
      letters.forEach(l => { l.target = 0; });
      wake();
    }
    function reset() {
      cancelAnimationFrame(frame);
      clearRim();
      frame = last = 0;
      pressed = false;
      letters.forEach(l => { l.target = l.v = l.y = 0; l.el.style.removeProperty('transform'); });
    }
    function clearRim() {
      cancelAnimationFrame(rimFrame);
      rimFrame = 0;
      panel.classList.remove('is-lit');
    }
    function lightRim(event) {
      if (reduce.matches || event.pointerType !== 'mouse') return;
      pointer = event;
      if (rimFrame) return;
      rimFrame = requestAnimationFrame(() => {
        rimFrame = 0;
        const rect = panel.getBoundingClientRect();
        panel.style.setProperty('--rim-x', `${pointer.clientX - rect.left}px`);
        panel.style.setProperty('--rim-y', `${pointer.clientY - rect.top}px`);
        panel.classList.add('is-lit');
      });
    }
    scope.on(panel, 'pointermove', lightRim, { passive: true });
    scope.on(panel, 'pointerleave', clearRim);
    scope.on(title, 'pointermove', respond);
    scope.on(title, 'pointerdown', e => { pressed = true; respond(e); });
    scope.on(title, 'pointerleave', release);
    scope.on(window, 'pointerup', release);
    scope.on(window, 'pointercancel', release);
    scope.on(window, 'scroll', reset, { passive: true });
    scope.on(window, 'blur', reset);
    scope.on(document, 'visibilitychange', () => { if (document.hidden) reset(); });
    scope.on(window, 'pagehide', reset);
    scope.on(reduce, 'change', reset);
    scope.cleanup(reset);
  });
})();
