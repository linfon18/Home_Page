/* The ring follows the system pointer without moving any click targets. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const wallpaper = document.querySelector('.wallpaper');
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring);

  const interactive = 'a,button,summary,[data-cursor]';
  const nativeArea = 'input,textarea,select,[contenteditable],.home-console,.live2d-widget,.mct-stage,dialog';
  let x = 0, y = 0, ringX = 0, ringY = 0, scale = 1;
  let sceneX = 0, sceneY = 0, frame = 0, previous = 0;
  let visible = false, shown = false, hovered = false, pressed = false;
  let needsHitTest = false;
  let modalOpen = Boolean(document.querySelector('dialog[open]'));
  const enabled = () => fine.matches && !reduced.matches;

  function wake() {
    if (!frame && enabled() && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    if (needsHitTest) {
      needsHitTest = false;
      updateTarget(visible ? document.elementFromPoint(x, y) : null);
    }
    const dt = previous ? Math.min(4, (now - previous) / 16.67) : 1;
    previous = now;
    const ease = (value, goal, rate) => {
      const next = goal + (value - goal) * Math.pow(1 - rate, dt);
      return Math.abs(next - goal) < .04 ? goal : next;
    };
    const targetScale = pressed ? .76 : hovered ? 1.19 : 1;
    if (shown) {
      ringX = ease(ringX, x, .36);
      ringY = ease(ringY, y, .36);
      // Keep the pointer inside the circle even during a very fast flick.
      const lag = Math.hypot(x - ringX, y - ringY);
      if (lag > 9) {
        ringX = x + (ringX - x) * 9 / lag;
        ringY = y + (ringY - y) * 9 / lag;
      }
      scale = ease(scale, targetScale, .25);
      ring.style.transform = `translate3d(${ringX}px,${ringY}px,0) scale(${scale})`;
    }

    const targetX = visible ? (x / innerWidth - .5) * -10 : 0;
    const targetY = (visible ? (y / innerHeight - .5) * -8 : 0) + Math.min(scrollY, 700) * .004;
    const nextX = ease(sceneX, targetX, .065), nextY = ease(sceneY, targetY, .065);
    if (wallpaper && (nextX !== sceneX || nextY !== sceneY)) {
      wallpaper.style.transform = `translate3d(${nextX.toFixed(3)}px,${nextY.toFixed(3)}px,0) scale(1.045)`;
    }
    sceneX = nextX;
    sceneY = nextY;
    if ((shown && (ringX !== x || ringY !== y || scale !== targetScale)) || sceneX !== targetX || sceneY !== targetY) wake();
    else previous = 0;
  }

  function updateTarget(target) {
    const nextShown = visible && !modalOpen && !target?.closest(nativeArea);
    if (nextShown && !shown) {
      ringX = x;
      ringY = y;
    }
    shown = nextShown;
    hovered = shown && Boolean(target?.closest(interactive));
    ring.classList.toggle('is-visible', shown);
    ring.classList.toggle('is-hover', hovered);
  }

  function leave() {
    visible = false;
    pressed = false;
    updateTarget(null);
    wake();
  }

  function refreshTarget() {
    needsHitTest = visible;
    wake();
  }

  addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !enabled()) return;
    x = event.clientX;
    y = event.clientY;
    visible = true;
    needsHitTest = false;
    updateTarget(event.target);
    wake();
  }, { passive: true });
  addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') return;
    pressed = true;
    wake();
  }, { passive: true });
  addEventListener('pointerup', () => { pressed = false; wake(); }, { passive: true });
  addEventListener('pointercancel', leave);
  document.addEventListener('pointerleave', leave);
  addEventListener('blur', leave);
  addEventListener('scroll', refreshTarget, { passive: true });
  addEventListener('resize', refreshTarget);
  addEventListener('site-page', refreshTarget);
  new MutationObserver(() => {
    modalOpen = Boolean(document.querySelector('dialog[open]'));
    refreshTarget();
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    leave();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  function updatePreference() {
    if (enabled()) return;
    stop();
    sceneX = sceneY = 0;
    if (wallpaper) wallpaper.style.removeProperty('transform');
  }
  reduced.addEventListener('change', updatePreference);
  fine.addEventListener('change', updatePreference);
})();
