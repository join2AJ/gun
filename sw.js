// Offline cache: app shell is cached on install, everything else is
// served stale-while-revalidate so updates land on the next visit.
const CACHE = 'arsenal-v2';
const SHELL = [
  './', 'index.html', 'css/app.css',
  'js/app.js', 'js/data.js', 'js/render.js', 'js/audio.js', 'js/fx.js', 'js/scenes.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      const net = fetch(e.request).then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) cache.put(e.request, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
