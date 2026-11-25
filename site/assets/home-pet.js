(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const range = (low, high) => low + Math.random() * (high - low);
  const idleMoves = ['peek', 'roll', 'hop', 'listen', 'doze', 'scoot'];
  const playMoves = ['double-hop', 'twirl', 'cheer', 'scoot'];

  SitePage.register('home-pet', scope => {
    const pet = document.querySelector('.home-pet');
    if (!pet || !pet.animate) return;
    const profile = pet.closest('.home-profile');
    const area = pet.parentElement;
    const period = profile.querySelector('.name-period');
    const body = pet.querySelector('.home-pet-body');
    let bounds, point, travel, shape, timer, blinkTimer, pressed, ignoreClick = false;
    let visible = false, waiting = document.documentElement.dataset.homeVisit === 'first';
    let idleBag = [], lastIdle, playIndex = 0, lastLook = 0;
    const sparks = new Set();

    const pose = name => { pet.dataset.pose = name; };
    const hitRadius = 18;
    const shift = ({ x, y }) => `translate3d(${x - hitRadius}px,${y - hitRadius}px,0)`;
    const groundX = x => clamp(x, bounds.left, bounds.right);
    const able = () => scope.alive() && !document.hidden && !reduced.matches;

    function place(target) {
      point = target;
      pet.style.transform = shift(target);
    }
    function currentPoint() {
      if (!travel) return point;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(pet).transform);
      return { x: matrix.m41 + hitRadius, y: matrix.m42 + hitRadius };
    }
    function cancelMotion() {
      clearTimeout(timer);
      clearTimeout(blinkTimer);
      pet.classList.remove('is-blinking');
      if (travel) {
        place(currentPoint());
        travel.cancel();
        travel = null;
      }
      if (shape) {
        shape.cancel();
        shape = null;
      }
    }
    function move(frames, duration, done) {
      const end = frames[frames.length - 1];
      const animation = pet.animate(frames.map(frame => ({
        transform: shift(frame), offset: frame.offset, easing: frame.easing
      })), { duration, fill: 'forwards' });
      travel = animation;
      animation.onfinish = () => {
        if (travel !== animation) return;
        place(end);
        travel = null;
        animation.cancel();
        if (done) done();
      };
    }
    function form(transforms, duration, easing = 'ease-in-out') {
      if (shape) shape.cancel();
      shape = body.animate(transforms.map(transform => ({ transform })), { duration, easing });
    }
    function look(x, y) {
      pet.style.setProperty('--gaze-x', `${clamp(x, -2.6, 2.6)}px`);
      pet.style.setProperty('--gaze-y', `${clamp(y, -2, 2)}px`);
    }
    function blink() {
      clearTimeout(blinkTimer);
      pet.classList.add('is-blinking');
      blinkTimer = setTimeout(() => pet.classList.remove('is-blinking'), 155);
    }
    function burst(x, y, count = 5) {
      if (!able()) return;
      for (let index = 0; index <= count && sparks.size < 16; index++) {
        const spark = document.createElement('span');
        spark.className = index ? 'home-pet-spark' : 'home-pet-spark is-ring';
        spark.setAttribute('aria-hidden', 'true');
        area.append(spark);
        sparks.add(spark);
        const dx = range(-24, 24), dy = range(-18, -5);
        spark.animate([
          { transform: `translate(${x}px,${y}px) scale(${index ? 1 : .45})`, opacity: .9 },
          { transform: `translate(${x + (index ? dx : 0)}px,${y + (index ? dy : 0)}px) scale(${index ? .25 : 1.85})`, opacity: 0 }
        ], { duration: range(260, 460), easing: 'ease-out' }).onfinish = () => {
          spark.remove();
          sparks.delete(spark);
        };
      }
    }
    function schedule(delay = range(1100, 2800)) {
      clearTimeout(timer);
      if (visible && able()) timer = setTimeout(explore, delay);
    }
    function rest(delay) {
      pose('rest');
      schedule(delay);
    }

    function drop(initial) {
      if (!point) return;
      const from = point;
      const x = groundX(from.x + (initial ? range(17, 30) : 0));
      const y = bounds.floor;
      const distance = Math.max(0, y - from.y);
      const descent = clamp(Math.sqrt(distance / 640) * 650, 150, 565);
      const settle = () => rest(initial ? 360 : 800);
      move([from, { x, y }].map((frame, index) => ({
        ...frame, easing: index ? undefined : 'cubic-bezier(.45,.05,.75,.48)'
      })), descent, () => {
        pose('bounce');
        burst(x, y + 10, initial ? 7 : 4);
        form(['scale(1.35,.68)', 'scale(.86,1.16)', 'scale(1.22,.82)', 'scale(1)'], 490);
        const bounce = clamp(distance * .13, 9, 24);
        const nextX = groundX(x + (initial ? 10 : 0));
        move([
          { x, y, offset: 0, easing: 'ease-out' },
          { x: (x + nextX) / 2, y: y - bounce, offset: .32, easing: 'ease-in' },
          { x: nextX, y, offset: .62, easing: 'ease-out' },
          { x: nextX, y: y - bounce * .33, offset: .8, easing: 'ease-in' },
          { x: nextX, y, offset: 1 }
        ], 490, settle);
      });
      pose(initial ? 'fall' : 'drop');
      look(0, 2);
      form(['scale(.8,1.15)', 'scale(.84,1.2)', 'scale(1)'], descent);
    }
    function hop(target, height, done) {
      const x = point.x, y = bounds.floor;
      const destination = groundX(target);
      look(Math.sign(destination - x) * 2, -1.5);
      form(['scale(1.3,.75)', 'scale(.83,1.21)', 'scale(1)', 'scale(1.25,.78)', 'scale(1)'], 500);
      move([
        { x, y, offset: 0, easing: 'ease-out' },
        { x: (x + destination) / 2, y: y - height, offset: .48, easing: 'ease-in' },
        { x: destination, y, offset: 1 }
      ], 490, () => {
        burst(destination, y + 10, 3);
        done();
      });
    }
    function act(action) {
      cancelMotion();
      pose(action);
      const x = point.x, y = bounds.floor;
      if (point.y < y - 2) {
        drop(false);
        return;
      }
      const direction = x > (bounds.left + bounds.right) / 2 ? -1 : 1;
      const heading = Math.random() < .75 ? direction : -direction;
      look(heading * 2, 0);
      switch (action) {
        case 'roll':
        case 'scoot': {
          const distance = action === 'roll' ? range(76, 138) : range(38, 64);
          const target = groundX(x + heading * distance);
          const spin = Math.sign(target - x) * 360;
          form(['rotate(0deg) scale(1)', `rotate(${spin / 2}deg) scale(.94,1.08)`, `rotate(${spin}deg) scale(1)`], 720);
          move([{ x, y, easing: 'ease-in-out' }, { x: target, y }], 720, rest);
          break;
        }
        case 'hop':
          hop(x + heading * range(20, 55), 19, rest);
          break;
        case 'double-hop':
          hop(x + direction * 24, 26, () => hop(point.x + direction * 22, 20, rest));
          break;
        case 'twirl':
          blink();
          form(['rotate(0deg)', 'scale(.76,1.2) rotate(180deg)', 'scale(1) rotate(360deg)'], 520);
          burst(x, y - 1, 7);
          timer = setTimeout(rest, 525);
          break;
        case 'cheer':
          burst(x, y - 8, 8);
          form(['scale(1)', 'scale(1.26,.8)', 'scale(.91,1.19)', 'scale(1.12,.9)', 'scale(1)'], 680);
          timer = setTimeout(rest, 690);
          break;
        case 'doze':
          look(0, 1.5);
          form(['scale(1)', 'scale(1.18,.74)', 'scale(1.1,.8)', 'scale(1.18,.74)', 'scale(1)'], 1730);
          timer = setTimeout(rest, 1740);
          break;
        case 'peek':
        case 'listen':
          blink();
          form(['rotate(0deg)', `rotate(${heading * 23}deg) scale(.9,1.12)`, `rotate(${-heading * 16}deg)`, 'rotate(0deg)'], 920);
          timer = setTimeout(() => { look(-heading * 2, -.7); rest(); }, 950);
          break;
      }
    }
    function explore() {
      if (!able() || !visible || pressed) return;
      if (!idleBag.length) {
        idleBag = idleMoves.slice();
        for (let index = idleBag.length - 1; index > 0; index--) {
          const other = Math.floor(range(0, index + 1));
          [idleBag[index], idleBag[other]] = [idleBag[other], idleBag[index]];
        }
        if (idleBag.at(-1) === lastIdle) idleBag.unshift(idleBag.pop());
      }
      lastIdle = idleBag.pop();
      act(lastIdle);
    }

    function measure() {
      const left = 25;
      const right = area.clientWidth - left;
      const floor = area.clientHeight - hitRadius;
      if (bounds && bounds.left === left && bounds.right === right && bounds.floor === floor) return;
      bounds = { left, right, floor };
      if (!pet.hidden && !pressed) {
        if (pet.dataset.pose === 'fall' || pet.dataset.pose === 'drop') {
          cancelMotion();
          drop(false);
        } else {
          cancelMotion();
          place({ x: groundX(point.x), y: floor });
          rest();
        }
      }
    }
    function start() {
      if (!pet.hidden || !able() || document.documentElement.dataset.homeEntrance === 'waiting') return;
      profile.classList.add('has-pet');
      measure();
      const titleDot = period.getBoundingClientRect(), box = area.getBoundingClientRect();
      const x = titleDot.x - box.x + titleDot.width / 2;
      const falling = waiting && document.documentElement.dataset.homeVisit === 'first';
      waiting = false;
      place({ x: groundX(x), y: falling ? titleDot.bottom - box.top - 8 : bounds.floor });
      pet.hidden = false;
      if (falling) {
        pose('seed');
        timer = setTimeout(() => drop(true), 100);
      } else {
        rest();
      }
    }
    function park() {
      cancelMotion();
      for (const spark of sparks) spark.remove();
      sparks.clear();
      if (pressed && pet.hasPointerCapture(pressed.id)) pet.releasePointerCapture(pressed.id);
      pressed = null;
      if (reduced.matches) {
        waiting = false;
        pet.hidden = true;
        profile.classList.remove('has-pet');
      } else if (!pet.hidden) {
        place({ x: groundX(point.x), y: bounds.floor });
        pose('rest');
      }
    }
    function resume() {
      if (!able()) return;
      if (pet.hidden) {
        if (!waiting || document.documentElement.dataset.homeEntrance === 'played') start();
      } else {
        schedule();
      }
    }

    scope.on(period, 'animationend', event => {
      if (event.animationName === 'arrival-letter' && waiting) start();
    });
    scope.on(pet, 'click', event => {
      if (ignoreClick && event.detail) return;
      if (able()) act(playMoves[playIndex++ % playMoves.length]);
    });
    scope.on(pet, 'pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || !able()) return;
      ignoreClick = false;
      pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
      pet.setPointerCapture(event.pointerId);
    });
    scope.on(pet, 'pointermove', event => {
      if (!pressed || pressed.id !== event.pointerId) return;
      if (!pressed.dragging) {
        if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < 6) return;
        pressed.dragging = true;
        cancelMotion();
        pose('drag');
        form(['scale(.83,1.16)', 'scale(1.15,.86)', 'scale(1)'], 390);
      }
      const box = area.getBoundingClientRect();
      place({
        x: groundX(event.clientX - box.left),
        y: clamp(event.clientY - box.top, 25, bounds.floor)
      });
      look(0, 2);
    });
    function release(event) {
      if (!pressed || pressed.id !== event.pointerId) return;
      const dragged = pressed.dragging;
      pressed = null;
      if (!dragged) return;
      ignoreClick = true;
      if (able()) drop(false);
    }
    scope.on(pet, 'pointerup', release);
    scope.on(pet, 'pointercancel', release);
    scope.on(pet, 'lostpointercapture', release);
    scope.on(profile, 'pointermove', event => {
      const now = performance.now();
      if (event.pointerType !== 'mouse' || pressed || pet.hidden || travel || now - lastLook < 90) return;
      lastLook = now;
      const target = pet.getBoundingClientRect();
      const dx = event.clientX - (target.left + target.width / 2);
      const dy = event.clientY - (target.top + target.height / 2);
      if (Math.hypot(dx, dy) > 175) return;
      if (pet.dataset.pose === 'doze') {
        cancelMotion();
        blink();
        rest(900);
      }
      look(dx / 27, dy / 27);
    }, { passive: true });
    scope.on(profile, 'pointerleave', () => { if (!pressed && !travel) look(0, 0); });
    scope.on(document, 'visibilitychange', () => { if (document.hidden) park(); else resume(); });
    scope.on(window, 'pagehide', park);
    scope.on(window, 'pageshow', resume);
    scope.on(reduced, 'change', () => { if (reduced.matches) park(); else resume(); });
    const resize = new ResizeObserver(measure);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && pet.dataset.pose === 'rest') schedule();
      else if (!visible && pet.dataset.pose === 'rest') clearTimeout(timer);
    });
    resize.observe(profile);
    intersection.observe(pet);
    scope.cleanup(() => { park(); resize.disconnect(); intersection.disconnect(); });
    resume();
  });
})();
