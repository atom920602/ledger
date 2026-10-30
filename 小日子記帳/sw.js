/* 小日子記帳 Service Worker：快取 App 檔案，讓斷網時也能開啟。
 * 本站檔案：先回快取、背景更新（下次開啟就是新版）。字型：第一次用到時存起來。 */
const CACHE = 'xiaorizi-v1';
const FONT_CACHE = 'xiaorizi-fonts';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(e, req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
});

async function staleWhileRevalidate(e, req) {
  const cache = await caches.open(CACHE);
  const isPage = req.mode === 'navigate';
  const cached = (await cache.match(req, { ignoreSearch: true })) || (isPage ? await cache.match('./') : undefined);
  const network = fetch(req)
    .then(res => {
      if (res && res.ok) cache.put(isPage ? './' : req, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) {
    e.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

async function cacheFirst(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return Response.error();
  }
}
