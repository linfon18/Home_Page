(() => {
  'use strict';
  const toggle = document.querySelector('[data-daily-wallpaper]');
  const layer = document.querySelector('.wallpaper');
  const source = window.dailyWallpaperRequest;
  if (!toggle || !layer || !source) return;

  const key = source.preference;
  const root = document.documentElement;
  let enabled = source.enabled, requestedDay = '', pending = null, timer = 0;
  let opening = root.dataset.homeVisit === 'first';

  // Measure the small patch behind the fixed navigation only when its crop changes.
  const sampler = document.createElement('canvas');
  sampler.width = 20;
  sampler.height = 3;
  const context = sampler.getContext('2d', { willReadFrequently: true });
  const header = document.querySelector('.site-header');
  let sampleFrame = 0;
  function sampleNavigation() {
    sampleFrame = 0;
    const image = layer.firstElementChild;
    if (!image || !context || document.body.dataset.page !== 'home') {
      delete header.dataset.photoInk;
      return;
    }
    const bounds = header.querySelector('.nav-shell').getBoundingClientRect();
    const scale = Math.max(innerWidth / image.naturalWidth, innerHeight / image.naturalHeight) * 1.045;
    const sx = image.naturalWidth / 2 + (bounds.left - innerWidth / 2) / scale;
    const sy = image.naturalHeight / 2 + (bounds.top - innerHeight / 2) / scale;
    context.drawImage(image, sx, sy, bounds.width / scale, bounds.height / scale, 0, 0, 20, 3);
    const data = context.getImageData(0, 0, 20, 3).data;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
    header.dataset.photoInk = total / 60 < 142 ? 'light' : 'dark';
  }
  function scheduleSample() {
    if (!sampleFrame) sampleFrame = requestAnimationFrame(sampleNavigation);
  }
  addEventListener('resize', scheduleSample);
  addEventListener('site-page', scheduleSample);
  function show(image) {
    if (image) {
      if (opening && root.dataset.homeVisit === 'first') image.classList.add('is-opening');
      opening = false;
    }
    layer.replaceChildren(...(image ? [image] : []));
    layer.classList.toggle('has-daily-image', Boolean(image));
    scheduleSample();
    window.dispatchEvent(new CustomEvent('site-wallpaper', { detail: image }));
  }

  function refresh() {
    toggle.setAttribute('aria-pressed', String(enabled));
    clearTimeout(timer);
    if (!enabled) {
      pending = null;
      requestedDay = '';
      show(null);
      return;
    }
    const day = source.day();
    timer = setTimeout(refresh, source.untilTomorrow());
    if (day === requestedDay) return;
    requestedDay = day;
    const request = day === source.initialDay && source.initial ? source.initial : source.request(day);
    source.initial = null;
    pending = request;
    request.then(image => {
      if (pending !== request) return;
      pending = null;
      if (image) show(image);
      else {
        clearTimeout(timer);
        timer = setTimeout(() => { requestedDay = ''; refresh(); }, Math.min(60000, source.untilTomorrow()));
      }
    });
  }

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch (_) {}
    refresh();
  });
  addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    enabled = event.newValue !== 'off';
    refresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && enabled && requestedDay !== source.day()) refresh();
  });
  refresh();
})();
