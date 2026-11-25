(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const range = (low, high) => low + Math.random() * (high - low);
  const idleMoves = ['patrol', 'peek', 'roll', 'hop', 'listen', 'scoot', 'double-hop'];
  const playMoves = ['double-hop', 'twirl', 'cheer', 'scoot'];

  SitePage.register('home-pet', scope => {
    const pet = document.querySelector('.home-pet');
    if (!pet || !pet.animate) return;
    const profile = pet.closest('.home-profile');
    const area = pet.parentElement;
    const period = profile.querySelector('.name-period');
    const body = pet.querySelector('.home-pet-body');
    const dockLinks = Array.from(profile.querySelectorAll('.home-buttons a'));
    let bounds, point, travel, shape, timer, pressed, ignoreClick = false;
    let flight, flightFrame = 0;
    let docks = [], docked = null;
    let visible = false, waiting = document.documentElement.dataset.homeVisit === 'first';
    let idleBag = [], lastIdle, playIndex = 0, lastLook = 0, visits = 0;
    const sparks = new Set();

    const pose = name => { pet.dataset.pose = name; };
    const mood = name => { pet.dataset.mood = name; };
    const hitRadius = 18;
    const ballRadius = 8;
    const wallInset = 16;
    const gravity = 1500;
    const dockContains = (dock, x) => x >= dock.left && x <= dock.right;
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
      cancelAnimationFrame(flightFrame);
      flight = null;
      flightFrame = 0;
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
      if (visible && able()) timer = setTimeout(explore, delay);
    }
    function rest(delay) {
      docked = docks.find(dock => point.y === dock.y && dockContains(dock, point.x)) || null;
      pet.toggleAttribute('data-perched', Boolean(docked));
      pose('rest');
      if (delay === undefined) mood('calm');
      schedule(docked ? range(1800, 2900) : delay);
    }
    function leaveDock() {
      docked = null;
      pet.removeAttribute('data-perched');
    }
    function openingDrop() {
      if (!point) return;
      const from = point;
      const x = groundX(from.x + range(17, 30));
      const y = bounds.floor;
      const distance = Math.max(0, y - from.y);
      const descent = clamp(Math.sqrt(distance / 640) * 650, 150, 565);
      const settle = () => rest(330);
      move([from, { x, y }].map((frame, index) => ({
        ...frame, easing: index ? undefined : 'cubic-bezier(.45,.05,.75,.48)'
      })), descent, () => {
        pose('bounce');
        mood('playful');
        burst(x, y + 8, 7);
        form(['scale(1.35,.68)', 'scale(.86,1.16)', 'scale(1.22,.82)', 'scale(1)'], 490);
        const bounce = clamp(distance * .13, 9, 24);
        const nextX = groundX(x + 10);
        move([
          { x, y, offset: 0, easing: 'ease-out' },
          { x: (x + nextX) / 2, y: y - bounce, offset: .32, easing: 'ease-in' },
          { x: nextX, y, offset: .62, easing: 'ease-out' },
          { x: nextX, y: y - bounce * .33, offset: .8, easing: 'ease-in' },
          { x: nextX, y, offset: 1 }
        ], 490, settle);
      });
      pose('fall');
      form(['scale(.8,1.15)', 'scale(.84,1.2)', 'scale(1)'], descent);
    }

    function launch(vx = 0, vy = 0) {
      cancelMotion();
      leaveDock();
      const thrown = Math.hypot(vx, vy) > 85;
      pose(thrown ? 'throw' : 'drop');
      mood(thrown ? 'playful' : 'curious');
      flight = { vx, vy, last: performance.now(), lastImpact: -Infinity };
      flightFrame = requestAnimationFrame(simulate);
    }
    function simulate(now) {
      if (!flight) return;
      if (!able()) { park(); return; }
      const elapsed = clamp((now - flight.last) / 1000, 0, .048);
      flight.last = now;
      let { x, y } = point;
      let { vx, vy } = flight;
      let impact = 0, horizontal = false;
      // Small steps keep collisions stable when a display frame arrives late.
      const steps = Math.max(1, Math.ceil(elapsed * 160));
      const dt = elapsed / steps;
      for (let index = 0; index < steps; index++) {
        const previousX = x;
        const previousY = y;
        const onDock = docks.some(dock => y === dock.y && dockContains(dock, x));
        const rolling = vy === 0 && (onDock || y >= bounds.floor);
        vx *= Math.exp(-(rolling ? 4.4 : .65) * dt);
        if (!rolling) vy += gravity * dt;
        x += vx * dt;
        y += vy * dt;
        if (x < bounds.left || x > bounds.right) {
          const edge = clamp(x, bounds.left, bounds.right);
          x = edge + (edge - x) * .78;
          if (Math.abs(vx) > impact) { impact = Math.abs(vx); horizontal = true; }
          vx *= -.78;
        }
        const dock = vy > 0 && y > previousY && docks.find(dock => {
          if (previousY > dock.y || y < dock.y) return false;
          const fraction = (dock.y - previousY) / (y - previousY);
          return dockContains(dock, previousX + (x - previousX) * fraction);
        });
        if (y < bounds.top || y > bounds.floor || dock) {
          const floor = Boolean(dock) || y > bounds.floor;
          const edge = dock ? dock.y : floor ? bounds.floor : bounds.top;
          const speed = Math.abs(vy);
          if (speed > impact) { impact = speed; horizontal = false; }
          if (floor && speed < 95) {
            y = edge;
            vy = 0;
          } else {
            const rebound = dock ? .42 : floor ? .59 : .73;
            y = edge + (edge - y) * rebound;
            vy *= -rebound;
          }
          if (floor) vx *= .84;
        }
      }
      Object.assign(flight, { vx, vy });
      place({ x, y });
      if (impact > 125 && now - flight.lastImpact > 120) {
        flight.lastImpact = now;
        mood(impact > 420 ? 'startled' : 'playful');
        form(horizontal ? ['scale(.72,1.26)', 'scale(1.14,.89)', 'scale(1)'] :
          ['scale(1.27,.71)', 'scale(.9,1.17)', 'scale(1)'], 240);
        burst(x, y, impact > 420 ? 6 : 3);
      }
      if (vy === 0 && Math.abs(vx) < 14 &&
          (y >= bounds.floor || docks.some(dock => y === dock.y && dockContains(dock, x)))) {
        flight = null;
        flightFrame = 0;
        rest(600);
      } else {
        flightFrame = requestAnimationFrame(simulate);
      }
    }
    function visitDock(dock) {
      if (!dock) return;
      cancelMotion();
      leaveDock();
      pose('perch');
      mood('curious');
      const from = point;
      const x = (dock.left + dock.right) / 2;
      const apex = Math.max(bounds.top, Math.min(from.y, dock.y) - 25);
      form(['scale(1.24,.78)', 'scale(.85,1.16)', 'scale(1)', 'scale(1.22,.82)', 'scale(1)'], 780);
      move([
        { ...from, offset: 0, easing: 'ease-out' },
        { x: from.x + (x - from.x) * .35, y: apex, offset: .48, easing: 'ease-in-out' },
        { x, y: dock.y, offset: 1 }
      ], 780, rest);
    }
    function hop(target, height, done) {
      const x = point.x, y = bounds.floor;
      const destination = groundX(target);
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
      if (docked) {
        const other = docks.find(dock => dock !== docked);
        if (other && (action === 'double-hop' || action === 'patrol')) {
          visitDock(other);
        } else {
          const direction = (bounds.right - docked.right) > (docked.left - bounds.left) ? 1 : -1;
          launch(300 * direction, -180);
        }
        return;
      }
      cancelMotion();
      pose(action);
      mood(action === 'doze' ? 'sleepy' :
        ['peek', 'listen', 'patrol'].includes(action) ? 'curious' : 'playful');
      const x = point.x, y = bounds.floor;
      if (point.y < y - 2) {
        launch();
        return;
      }
      const direction = x > (bounds.left + bounds.right) / 2 ? -1 : 1;
      const heading = Math.random() < .75 ? direction : -direction;
      switch (action) {
        case 'patrol': {
          const target = groundX(x + direction * range(110, 195));
          hop(x + (target - x) * .42, 21, () => hop(target, 15, rest));
          break;
        }
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
      if (!able() || !visible) return;
      if (pressed) { schedule(350); return; }
      visits++;
      if (!docked && docks.length && visits % 4 === 2) {
        visitDock(docks[visits % 8 === 2 ? 0 : docks.length - 1]);
        return;
      }
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
      const box = area.getBoundingClientRect();
      const nextDocks = dockLinks.map(link => {
        const rect = link.getBoundingClientRect();
        return { link, left: Math.max(left, rect.left - box.left + 12),
          right: Math.min(right, rect.right - box.left - 12), y: rect.top - box.top - ballRadius };
      }).filter(dock => dock.left <= dock.right && dock.y >= wallInset && dock.y < floor);
      const unchanged = bounds && bounds.right === right && bounds.floor === floor && nextDocks.length === docks.length &&
        nextDocks.every((dock, index) =>
        docks[index] && Math.abs(dock.y - docks[index].y) < .1 &&
        Math.abs(dock.left - docks[index].left) < .1 && Math.abs(dock.right - docks[index].right) < .1);
      if (unchanged) return;
      const nextDock = docked && nextDocks.find(dock => dock.link === docked.link);
      docks = nextDocks;
      bounds = { left, right, top: wallInset, floor };
      if (!pet.hidden && !pressed) {
        if (nextDock) {
          cancelMotion();
          place({ x: clamp(point.x, nextDock.left, nextDock.right), y: nextDock.y });
          rest();
        } else if (flight) {
          // Keep the current flight when expanding MCT animates the card's height.
          place({ x: groundX(point.x), y: clamp(point.y, bounds.top, floor) });
        } else if (pet.dataset.pose === 'fall' || pet.dataset.pose === 'perch' || docked) {
          cancelMotion();
          place({ x: groundX(point.x), y: clamp(point.y, bounds.top, floor) });
          launch();
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
        timer = setTimeout(openingDrop, 100);
      } else {
        rest();
      }
    }
    function park() {
      cancelMotion();
      for (const spark of sparks) spark.remove();
      sparks.clear();
      const pointerId = pressed && pressed.id;
      pressed = null;
      if (pointerId != null && pet.hasPointerCapture(pointerId)) pet.releasePointerCapture(pointerId);
      leaveDock();
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
      const scale = Math.min(1, 1650 / Math.max(1, Math.hypot(vx, vy))) * (1 - pause / 115);
      return { vx: vx * scale, vy: vy * scale };
    }
    scope.on(pet, 'pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || !able()) return;
      ignoreClick = false;
      const box = area.getBoundingClientRect();
      const from = currentPoint();
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
        cancelMotion();
        leaveDock();
        pose('drag');
        mood('curious');
        form(['scale(.83,1.16)', 'scale(1.15,.86)', 'scale(1)'], 390);
      }
      const box = area.getBoundingClientRect();
      const x = groundX(event.clientX - box.left + pressed.offsetX);
      const y = clamp(event.clientY - box.top + pressed.offsetY, bounds.top, bounds.floor);
      const dock = docks.find(dock => dockContains(dock, x) && Math.abs(y - dock.y) < 7);
      place({
        x,
        y: dock ? dock.y : y
      });
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
      if (!able() || event.pointerType !== 'mouse' || pressed || pet.hidden || travel || flight || now - lastLook < 330) return;
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
    for (const link of dockLinks) resize.observe(link);
    intersection.observe(pet);
    scope.cleanup(() => { park(); resize.disconnect(); intersection.disconnect(); });
    resume();
  });
})();
