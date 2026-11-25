(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const range = (low, high) => low + Math.random() * (high - low);
  const idleMoves = ['patrol', 'peek', 'roll', 'hop', 'listen', 'scoot', 'double-hop'];
  const playMoves = ['double-hop', 'twirl', 'cheer', 'scoot'];
  const navigation = performance.getEntriesByType('navigation')[0];
  let documentOpening = document.body.dataset.page === 'home' &&
    (document.documentElement.dataset.homeVisit === 'first' || (!location.hash && navigation?.type === 'reload'));

  SitePage.register('home-pet', scope => {
    const pet = document.querySelector('.home-pet');
    if (!pet || !pet.animate) return;
    const profile = pet.closest('.home-profile');
    const area = pet.parentElement;
    const period = profile.querySelector('.name-period');
    const titleDot = period.querySelector('.home-period-dot');
    const body = pet.querySelector('.home-pet-body');
    const dockLinks = Array.from(profile.querySelectorAll('.home-buttons a'));
    let bounds, point, shape, timer, pressed, ignoreClick = false;
    let flight, flightFrame = 0, dockFrame = 0, dockUntil = 0;
    let docks = [], docked = null;
    let visible = false, waiting = documentOpening, opening = false, blockedExit = null;
    documentOpening = false;
    let idleBag = [], lastIdle, playIndex = 0, lastLook = 0, visits = 0, patrolRight = false;
    const sparks = new Set();

    const pose = name => { pet.dataset.pose = name; };
    const mood = name => { pet.dataset.mood = name; };
    const hitRadius = 18;
    const ballRadius = 8;
    const wallInset = 12;
    const gravity = 2000;
    const dockContains = (dock, x) => x >= dock.left && x <= dock.right;
    const shift = ({ x, y }) => `translate3d(${x - hitRadius}px,${y - hitRadius}px,0)`;
    const groundX = x => clamp(x, bounds.left, bounds.right);
    const able = () => scope.alive() && !document.hidden && !reduced.matches;

    function place(target) {
      point = target;
      pet.style.transform = shift(target);
    }
    function cancelMotion() {
      clearTimeout(timer);
      cancelAnimationFrame(flightFrame);
      flight = null;
      flightFrame = 0;
      if (shape) {
        shape.cancel();
        shape = null;
      }
    }
    function form(transforms, duration, easing = 'ease-in-out') {
      if (shape) shape.cancel();
      shape = body.animate(transforms.map(transform => ({ transform })), { duration, easing });
    }
    function burst(x, y, count = 5) {
      if (!able()) return;
      const tone = getComputedStyle(pet).getPropertyValue('--pet-tone').trim();
      for (let index = 0; index <= count && sparks.size < 16; index++) {
        const spark = document.createElement('span');
        spark.className = index ? 'home-pet-spark' : 'home-pet-spark is-ring';
        spark.setAttribute('aria-hidden', 'true');
        if (tone) spark.style.setProperty('--spark-tone', tone);
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
    function schedule(delay = range(420, 1150)) {
      clearTimeout(timer);
      if ((visible || opening) && able()) timer = setTimeout(explore, delay);
    }
    function rest(delay) {
      if (point.y >= bounds.floor - 1) {
        opening = false;
        blockedExit = null;
      }
      const dock = docks.find(dock => Math.abs(point.y - dock.y) < .5 && dockContains(dock, point.x));
      docked = dock ? { ...dock, fraction: (point.x - dock.center) / dock.halfWidth } : null;
      pet.toggleAttribute('data-perched', Boolean(docked));
      if (docked) {
        if (shape) { shape.cancel(); shape = null; }
        syncDock();
        if (docked) followDock();
      }
      pose('rest');
      if (delay === undefined) mood('calm');
      schedule(opening ? 200 : docked ? range(1800, 2900) : delay);
    }
    function leaveDock() {
      cancelAnimationFrame(dockFrame);
      dockFrame = 0;
      docked = null;
      pet.removeAttribute('data-perched');
    }

    function readDocks(box = area.getBoundingClientRect()) {
      docks = dockLinks.map(link => {
        const rect = link.getBoundingClientRect();
        const radius = Math.min(rect.width / 2, rect.height / 2);
        const top = rect.top - box.top;
        const center = rect.left - box.left + rect.width / 2;
        return { link, center, halfWidth: rect.width / 2,
          left: center - rect.width / 2 + radius, right: center + rect.width / 2 - radius,
          top, bottom: top + rect.height, radius, y: top - ballRadius };
      }).filter(dock => dock.radius > 0 && dock.y >= bounds.top && dock.bottom < bounds.floor);
    }
    function syncDock() {
      const dock = docks.find(candidate => candidate.link === docked.link);
      if (!dock) { launch(); return; }
      const x = clamp(dock.center + dock.halfWidth * docked.fraction, dock.left, dock.right);
      if (point.x !== x || point.y !== dock.y) place({ x, y: dock.y });
    }
    function followDock() {
      if (!docked) return;
      dockUntil = performance.now() + 420;
      if (dockFrame) return;
      function track(now) {
        if (!docked) { dockFrame = 0; return; }
        readDocks();
        syncDock();
        dockFrame = docked && now < dockUntil ? requestAnimationFrame(track) : 0;
      }
      dockFrame = requestAnimationFrame(track);
    }
    function openingDrop() {
      if (pressed) { timer = setTimeout(openingDrop, 120); return; }
      placeAtTitle();
      launch(28, 0, 'fall');
    }

    function launch(vx = 0, vy = 0, action) {
      cancelMotion();
      leaveDock();
      const thrown = Math.hypot(vx, vy) > 85;
      pose(action || (thrown ? 'throw' : 'drop'));
      mood(action === 'patrol' || !thrown ? 'curious' : 'playful');
      flight = { vx, vy, last: performance.now(), lastImpact: -Infinity, still: 0 };
      flightFrame = requestAnimationFrame(simulate);
    }
    function takeDetour() {
      readDocks();
      const obstacles = docks.filter(dock => dock.bottom + ballRadius >= point.y - 1);
      if (!obstacles.length) { launch(); return; }
      const clear = x => !obstacles.some(dock => Math.abs(x - dock.center) < dock.halfWidth + ballRadius + 2);
      const exits = [];
      for (let x = bounds.left; x <= bounds.right; x += 3) {
        if (clear(x)) exits.push(x);
      }
      if (clear(bounds.right)) exits.push(bounds.right);
      if (!exits.length) { launch(); return; }
      const options = exits.filter(x => Math.sign(x - point.x) !== blockedExit);
      const target = (options.length ? options : exits)
        .reduce((best, x) => Math.abs(x - point.x) < Math.abs(best - point.x) ? x : best);
      const direction = Math.sign(target - point.x);
      const nearestDockTop = Math.min(...obstacles.filter(dock =>
        dock.center + dock.halfWidth >= Math.min(point.x, target) &&
        dock.center - dock.halfWidth <= Math.max(point.x, target)).map(dock => dock.y));
      const rise = clamp(point.y - nearestDockTop + 14, 0, 42);
      launch(0, rise ? -Math.sqrt(2 * gravity * rise) : 0, 'detour');
      flight.detour = { target, direction, anchor: point.x, lastProgress: flight.last };
    }
    // Closest point on a rounded rectangle expanded by the ball's radius.
    function buttonContact(dock, x, y, previousX, previousY) {
      const cx = clamp(x, dock.left, dock.right);
      const cy = clamp(y, dock.top + dock.radius, dock.bottom - dock.radius);
      const dx = x - cx, dy = y - cy;
      const distance = Math.hypot(dx, dy);
      const radius = dock.radius + ballRadius;
      if (distance >= radius) return null;
      if (distance > .001) return { nx: dx / distance, ny: dy / distance, depth: radius - distance };
      // A drag or a moving button can start inside the inner rectangle.
      const sides = [
        { nx: -1, ny: 0, depth: x - dock.left + radius, prior: dock.left - previousX },
        { nx: 1, ny: 0, depth: dock.right + radius - x, prior: previousX - dock.right },
        { nx: 0, ny: -1, depth: y - dock.y, prior: dock.top - previousY },
        { nx: 0, ny: 1, depth: dock.bottom + ballRadius - y, prior: previousY - dock.bottom }
      ];
      return sides.reduce((best, side) => side.prior > best.prior ? side : best);
    }
    function simulate(now) {
      if (!flight) return;
      if (!able()) { park(); return; }
      if (point.y < bounds.floor - 20 || flight.vy < -120) readDocks();
      const elapsed = clamp((now - flight.last) / 1000, 0, .048);
      flight.last = now;
      let { x, y } = point;
      let { vx, vy } = flight;
      const route = flight.detour;
      let impact = 0, horizontal = false, supported = false;
      // Small steps keep collisions stable when a display frame arrives late.
      const steps = Math.max(1, Math.ceil(elapsed * 160));
      const dt = elapsed / steps;
      for (let index = 0; index < steps; index++) {
        const previousX = x;
        const previousY = y;
        const onDock = docks.some(dock => Math.abs(y - dock.y) < .1 && dockContains(dock, x));
        const rolling = vy === 0 && (onDock || y >= bounds.floor);
        vx *= Math.exp(-(rolling ? 2.5 : .42) * dt);
        if (route && y < bounds.floor - 1) {
          const desired = clamp((route.target - x) * 10, -250, 250);
          vx += clamp(desired - vx, -1450 * dt, 1450 * dt);
        }
        if (!rolling) vy += gravity * dt;
        x += vx * dt;
        y += vy * dt;
        if (x < bounds.left || x > bounds.right) {
          const edge = clamp(x, bounds.left, bounds.right);
          x = edge;
          if (Math.abs(vx) > impact) { impact = Math.abs(vx); horizontal = true; }
          vx *= -.55;
        }
        for (const dock of docks) {
          const hit = buttonContact(dock, x, y, previousX, previousY);
          if (!hit) continue;
          const { nx, ny, depth } = hit;
          x += nx * depth;
          y += ny * depth;
          const approach = vx * nx + vy * ny;
          if (approach < 0) {
            const bounce = -approach > 115 ? .31 : 0;
            vx -= (1 + bounce) * approach * nx;
            vy -= (1 + bounce) * approach * ny;
          }
          if (ny < -.999 && Math.abs(vy) < 52) { y = dock.y; vy = 0; }
          if (ny < -.3) supported = true;
          if (-approach > impact) { impact = -approach; horizontal = Math.abs(nx) > .5; }
        }
        if (y < bounds.top || y > bounds.floor) {
          const floor = y > bounds.floor;
          const edge = floor ? bounds.floor : bounds.top;
          const speed = Math.abs(vy);
          if (speed > impact) { impact = speed; horizontal = false; }
          y = edge;
          vy = floor && speed < 105 ? 0 : vy * (floor ? -.40 : -.34);
          if (floor) vx *= .90;
        }
        x = groundX(x);
      }
      Object.assign(flight, { vx, vy });
      place({ x, y });
      if (impact > 125 && now - flight.lastImpact > 120) {
        flight.lastImpact = now;
        if (pet.dataset.pose === 'fall') pose('bounce');
        mood(impact > 420 ? 'startled' : 'playful');
        form(horizontal ? ['scale(.72,1.26)', 'scale(1.14,.89)', 'scale(1)'] :
          ['scale(1.27,.71)', 'scale(.9,1.17)', 'scale(1)'], 240);
        burst(x, y, impact > 420 ? 6 : 3);
      }
      const atRest = vy === 0 && Math.abs(vx) < 14 &&
        (y >= bounds.floor || docks.some(dock => Math.abs(y - dock.y) < .5 && dockContains(dock, x)));
      flight.still = supported && Math.hypot(vx, vy) < 35 ? flight.still + elapsed : 0;
      if (route && Math.abs(route.anchor - x) > 3) {
        route.anchor = x;
        route.lastProgress = now;
      }
      const trapped = route && supported && now - route.lastProgress > 400;
      if (trapped || (!route && flight.still > .16) || (atRest && (!route || y >= bounds.floor - 1))) {
        if (trapped) blockedExit = route.direction;
        flight = null;
        flightFrame = 0;
        rest(trapped ? 260 : 600);
      } else {
        flightFrame = requestAnimationFrame(simulate);
      }
    }
    function act(action) {
      if (point.y < bounds.floor - 2) {
        takeDetour();
        return;
      }
      cancelMotion();
      pose(action);
      mood(action === 'doze' ? 'sleepy' :
        ['peek', 'listen', 'patrol'].includes(action) ? 'curious' : 'playful');
      const x = point.x, y = bounds.floor;
      const direction = x > (bounds.left + bounds.right) / 2 ? -1 : 1;
      const heading = Math.random() < .75 ? direction : -direction;
      switch (action) {
        case 'patrol': {
          patrolRight = !patrolRight;
          const side = patrolRight ? bounds.right : bounds.left;
          const toWall = Math.abs(side - x);
          launch((side === bounds.left ? -1 : 1) * (toWall * 2.55 + 145), -38, action);
          break;
        }
        case 'roll':
        case 'scoot': {
          launch(heading * (action === 'roll' ? range(235, 375) : range(135, 200)), 0, action);
          break;
        }
        case 'hop':
          launch(heading * range(105, 155), -205, action);
          break;
        case 'double-hop':
          launch(direction * 160, -255, action);
          break;
        case 'twirl':
          form(['scale(1)', 'scale(.76,1.16)', 'scale(1.12,.93)', 'scale(1)'], 520);
          burst(x, y - 1, 7);
          timer = setTimeout(rest, 525);
          break;
        case 'cheer':
          burst(x, y - 8, 8);
          form(['scale(1)', 'scale(1.26,.8)', 'scale(.91,1.19)', 'scale(1.12,.9)', 'scale(1)'], 680);
          timer = setTimeout(rest, 690);
          break;
        case 'doze':
          form(['scale(1)', 'scale(1.18,.74)', 'scale(1.1,.8)', 'scale(1.18,.74)', 'scale(1)'], 1730);
          timer = setTimeout(rest, 1740);
          break;
        case 'peek':
        case 'listen':
          form(['rotate(0deg)', `rotate(${heading * 23}deg) scale(.9,1.12)`, `rotate(${-heading * 16}deg)`, 'rotate(0deg)'], 920);
          timer = setTimeout(rest, 950);
          break;
      }
    }
    function explore() {
      if (!able() || (!visible && !opening)) return;
      if (pressed) { schedule(350); return; }
      if (point.y < bounds.floor - 2) { takeDetour(); return; }
      visits++;
      if (!docked && visits % 4 === 2) { act('patrol'); return; }
      if (visits % 12 === 0) { act('doze'); return; }
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
      const left = wallInset;
      const right = area.clientWidth - left;
      const floor = area.clientHeight - hitRadius;
      const unchanged = bounds && bounds.right === right && bounds.floor === floor;
      bounds = { left, right, top: wallInset, floor };
      readDocks();
      if (docked) syncDock();
      if (unchanged) return;
      if (!pet.hidden && !pressed && !docked) {
        if (pet.dataset.pose === 'seed') {
          placeAtTitle();
        } else if (flight) {
          // Keep the current flight when expanding MCT animates the card's height.
          place({ x: groundX(point.x), y: clamp(point.y, bounds.top, floor) });
        } else {
          cancelMotion();
          place({ x: groundX(point.x), y: floor });
          rest();
        }
      }
    }
    function placeAtTitle() {
      const dot = titleDot.getBoundingClientRect();
      const box = area.getBoundingClientRect();
      pet.style.setProperty('--pet-seed-scale', dot.width / (2 * ballRadius));
      place({ x: groundX(dot.left + dot.width / 2 - box.left), y: dot.top + dot.height / 2 - box.top });
    }
    function start() {
      if (!pet.hidden || !able() || document.documentElement.dataset.homeEntrance === 'waiting') return;
      measure();
      opening = waiting;
      waiting = false;
      placeAtTitle();
      if (!opening) place({ x: point.x, y: bounds.floor });
      profile.classList.add('has-pet');
      pet.hidden = false;
      if (opening) {
        pose('seed');
        timer = setTimeout(openingDrop, 220);
      } else {
        rest();
      }
    }
    function park(keepOpening = false) {
      cancelMotion();
      for (const spark of sparks) spark.remove();
      sparks.clear();
      const pointerId = pressed && pressed.id;
      pressed = null;
      if (pointerId != null && pet.hasPointerCapture(pointerId)) pet.releasePointerCapture(pointerId);
      leaveDock();
      if (reduced.matches || (opening && keepOpening)) {
        waiting = !reduced.matches;
        opening = false;
        pet.hidden = true;
        profile.classList.remove('has-pet');
      } else if (!pet.hidden) {
        opening = false;
        place({ x: groundX(point.x), y: bounds.floor });
        pose('rest');
      }
    }
    function resume() {
      if (!able()) return;
      if (pet.hidden) {
        const arriving = waiting && period.getAnimations().some(animation =>
          animation.animationName === 'arrival-letter' && animation.playState === 'running');
        if (!arriving) start();
      } else if (!flight && pet.dataset.pose === 'rest') {
        schedule();
      }
    }

    scope.on(period, 'animationend', event => {
      if (event.animationName === 'arrival-letter' && waiting) start();
    });
    scope.on(pet, 'click', event => {
      if (ignoreClick && event.detail) return;
      if (able() && pet.dataset.pose !== 'seed') act(playMoves[playIndex++ % playMoves.length]);
    });
    function recordPointer(gesture, event) {
      const sample = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      gesture.samples.push(sample);
      while (gesture.samples.length > 2 && sample.time - gesture.samples[1].time > 90) {
        gesture.samples.shift();
      }
    }
    function flingVelocity(gesture, releaseTime) {
      const samples = gesture.samples;
      const last = samples[samples.length - 1];
      const pause = releaseTime - last.time;
      if (samples.length < 2 || pause > 95) return { vx: 0, vy: 0 };
      const cutoff = last.time - 90;
      let first = samples[0];
      if (first.time < cutoff && samples[1].time > cutoff) {
        const next = samples[1];
        const ratio = (cutoff - first.time) / (next.time - first.time);
        first = { x: first.x + (next.x - first.x) * ratio,
          y: first.y + (next.y - first.y) * ratio, time: cutoff };
      }
      const seconds = Math.max(16, last.time - first.time) / 1000;
      const vx = (last.x - first.x) / seconds, vy = (last.y - first.y) / seconds;
      const scale = Math.min(1, 1020 / Math.max(1, Math.hypot(vx, vy))) * (1 - pause / 115);
      return { vx: vx * scale, vy: Math.max(-580, vy * scale) };
    }
    scope.on(pet, 'pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || !able()) return;
      ignoreClick = false;
      const box = area.getBoundingClientRect();
      const from = point;
      pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false,
        offsetX: from.x - (event.clientX - box.left), offsetY: from.y - (event.clientY - box.top), samples: [] };
      recordPointer(pressed, event);
      pet.setPointerCapture(event.pointerId);
    });
    scope.on(pet, 'pointermove', event => {
      if (!pressed || pressed.id !== event.pointerId) return;
      recordPointer(pressed, event);
      if (!pressed.dragging) {
        if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < 6) return;
        pressed.dragging = true;
        opening = false;
        blockedExit = null;
        cancelMotion();
        leaveDock();
        pose('drag');
        mood('curious');
      }
      const box = area.getBoundingClientRect();
      readDocks(box);
      let { x, y } = point;
      const targetX = groundX(event.clientX - box.left + pressed.offsetX);
      const targetY = clamp(event.clientY - box.top + pressed.offsetY, bounds.top, bounds.floor);
      const steps = Math.max(1, Math.ceil(Math.hypot(targetX - x, targetY - y) / 5));
      const dx = (targetX - x) / steps, dy = (targetY - y) / steps;
      for (let index = 0; index < steps; index++) {
        const previousX = x, previousY = y;
        x += dx;
        y += dy;
        for (const dock of docks) {
          const hit = buttonContact(dock, x, y, previousX, previousY);
          if (hit) { x += hit.nx * hit.depth; y += hit.ny * hit.depth; }
        }
      }
      x = groundX(x);
      y = clamp(y, bounds.top, bounds.floor);
      const dock = docks.find(dock => dockContains(dock, x) && y <= dock.y + .5 && y > dock.y - 5);
      place({ x, y: dock ? dock.y : y });
    });
    function release(event) {
      if (!pressed || pressed.id !== event.pointerId) return;
      const gesture = pressed;
      pressed = null;
      if (!gesture.dragging) return;
      ignoreClick = true;
      if (!able()) return;
      const velocity = event.type === 'pointerup' ? flingVelocity(gesture, event.timeStamp) : { vx: 0, vy: 0 };
      if (Math.hypot(velocity.vx, velocity.vy) < 85 &&
          docks.some(dock => dock.y === point.y && dockContains(dock, point.x))) {
        cancelMotion();
        rest();
      } else {
        launch(velocity.vx, velocity.vy);
      }
    }
    scope.on(pet, 'pointerup', release);
    scope.on(pet, 'pointercancel', release);
    scope.on(pet, 'lostpointercapture', release);
    scope.on(profile, 'pointermove', event => {
      const now = performance.now();
      if (!able() || event.pointerType !== 'mouse' || pressed || pet.hidden || flight || now - lastLook < 330) return;
      const target = pet.getBoundingClientRect();
      const dx = event.clientX - (target.left + target.width / 2);
      const dy = event.clientY - (target.top + target.height / 2);
      if (Math.hypot(dx, dy) > 175) return;
      lastLook = now;
      if (pet.dataset.pose === 'doze') {
        cancelMotion();
        mood('curious');
        rest(450);
      } else if (!docked && pet.dataset.pose === 'rest' && Math.hypot(dx, dy) < 95) {
        mood('curious');
        form(['scale(1) rotate(0deg)', `scale(1.08,.94) rotate(${Math.sign(dx) * 17}deg)`, 'scale(1) rotate(0deg)'], 330);
      }
    }, { passive: true });
    scope.on(document, 'visibilitychange', () => { if (document.hidden) park(true); else resume(); });
    scope.on(window, 'pagehide', () => { waiting = false; park(); });
    scope.on(window, 'pageshow', resume);
    scope.on(reduced, 'change', () => { if (reduced.matches) park(); else resume(); });
    const resize = new ResizeObserver(measure);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && pet.dataset.pose === 'rest') schedule();
      else if (!visible && pet.dataset.pose === 'rest') clearTimeout(timer);
    });
    resize.observe(profile);
    for (const link of dockLinks) {
      resize.observe(link);
      for (const event of ['pointerenter', 'pointerleave', 'pointerdown', 'pointerup', 'transitionrun']) {
        scope.on(link, event, followDock);
      }
    }
    intersection.observe(pet);
    scope.cleanup(() => { park(); resize.disconnect(); intersection.disconnect(); });
    resume();
  });
})();
