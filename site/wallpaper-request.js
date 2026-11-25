'use strict';

// Inlined in the head so loading can overlap stylesheet and script downloads.
module.exports = function prepareWallpaper(isHome) {
  const preference = 'linfon-daily-wallpaper';
  const resolution = matchMedia('(max-width: 680px)').matches ? 1366 : 1920;
  const cacheKey = 'linfon-bing-wallpaper-' + resolution;
  const dayMs = 86400000;
  const chinaTime = () => Date.now() + 8 * 3600000;
  const day = () => new Date(chinaTime()).toISOString().slice(0, 10);
  const saved = key => {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  };
  const enabled = saved(preference) !== 'off';
  const api = 'https://bing.biturl.top/?resolution=' + resolution + '&index=0&mkt=zh-CN';

  function directUrl(value) {
    try {
      const url = new URL(value);
      if (url.origin === 'https://www.bing.com' && url.pathname === '/th' &&
          url.searchParams.get('id')?.startsWith('OHR.')) return url.href;
    } catch (_) {}
    return '';
  }

  async function metadata(date) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2600);
    try {
      const response = await fetch(api + '&format=json&day=' + date, { signal: controller.signal });
      if (!response.ok) return '';
      return directUrl((await response.json()).url);
    } catch (_) {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  function load(url) {
    const image = new Image();
    image.className = 'daily-wallpaper';
    image.alt = '';
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.fetchPriority = isHome ? 'high' : 'auto';
    return new Promise(resolve => {
      const timer = setTimeout(() => finish(null), 9000);
      function finish(result) {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (!result) image.removeAttribute('src');
        resolve(result);
      }
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      image.src = url;
    });
  }

  async function request(date) {
    let cached;
    try { cached = JSON.parse(saved(cacheKey)); } catch (_) {}
    const address = cached?.day === date && directUrl(cached.url);
    let image = address ? await load(address) : null;
    if (image) return image;
    const url = await metadata(date);
    if (url && url !== address) image = await load(url);
    if (image) {
      try { localStorage.setItem(cacheKey, JSON.stringify({ day: date, url })); } catch (_) {}
      return image;
    }
    return load(api + '&format=image&day=' + date);
  }

  const initialDay = day();
  if (enabled) {
    const connection = document.createElement('link');
    connection.rel = 'preconnect';
    connection.href = 'https://www.bing.com';
    connection.crossOrigin = 'anonymous';
    document.head.append(connection);
  }
  window.dailyWallpaperRequest = {
    enabled, preference, day, request, initialDay,
    initial: enabled ? request(initialDay) : null,
    untilTomorrow: () => dayMs - chinaTime() % dayMs + 1000
  };
};
