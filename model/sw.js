const CACHE = 'idol-stage-v14';
const FILES = [
  './', './index.html', './idol-hunter-layers.html', './stage-looks.css',
  './stage-layered.css', './stage-layered.js', './idol-hunter-layers.webmanifest',
  './icon.svg',
  './layers/base.png',
  './layers/hair-01-back.png', './layers/hair-01-front.png',
  './layers/hair-02-back.png', './layers/hair-02-front.png',
  './layers/outfit-01.png', './layers/outfit-02.png',
  './layers/socks-01.png', './layers/socks-02.png', './layers/socks-03.png',
  './layers/shoes-01.png', './layers/shoes-02.png', './layers/shoes-03.png',
  './layers/hair-accessory-01.png', './layers/hair-accessory-02.png',
  './layers/necklace-01.png', './layers/necklace-02.png',
  './layers/bracelet-01.png', './layers/bracelet-02.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('little-stylist-') || key.startsWith('idol-stage-')) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./idol-hunter-layers.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
