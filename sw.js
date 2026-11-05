const CACHE = 'planner-v1';
const PRECACHE = [
  './', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'vendor/react.production.min.js', 'vendor/react-dom.production.min.js', 'vendor/supabase.js',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // запросы к Supabase идут напрямую в сеть

  const cacheFirst = url.pathname.indexOf('/vendor/') !== -1 || url.pathname.indexOf('/icons/') !== -1;

  if (cacheFirst) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
          return res;
        });
      })
    );
  } else {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); });
      })
    );
  }
});
