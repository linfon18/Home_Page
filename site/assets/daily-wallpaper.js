(() => {
  'use strict';
  const toggle = document.querySelector('[data-daily-wallpaper]');
  const layer = document.querySelector('.wallpaper');
  if (!toggle || !layer) return;

  const key = 'linfon-daily-wallpaper';
  const dayMs = 86400000;
  let enabled = true, requestedDay = '', pending = null, timer = 0;
  try { enabled = localStorage.getItem(key) !== 'off'; } catch (_) {}

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
    const chinaTime = Date.now() + 8 * 3600000;
    const day = new Date(chinaTime).toISOString().slice(0, 10);
    timer = setTimeout(refresh, dayMs - chinaTime % dayMs + 1000);
    if (day === requestedDay) return;
    requestedDay = day;
    const image = new Image();
    pending = image;
    image.className = 'daily-wallpaper';
    image.alt = '';
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (pending !== image) return;
      pending = null;
      show(image);
    };
    image.onerror = () => {
      if (pending !== image) return;
      pending = null;
      show(null);
      clearTimeout(timer);
      timer = setTimeout(() => { requestedDay = ''; refresh(); }, 15 * 60000);
    };
    image.src = 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN&day=' + day;
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
    if (!document.hidden && enabled && requestedDay !== new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)) refresh();
  });
  refresh();
})();
