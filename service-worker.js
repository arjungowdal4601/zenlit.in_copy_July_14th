const CACHE_NAME = 'pwa-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/index.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
