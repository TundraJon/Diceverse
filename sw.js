// Diceverse service worker (build.mjs stamps the build into the cache name and writes it to sw.js at the repo root). It keeps the app and its icons so Diceverse opens
// offline; a new build has a new cache name, so the old files are dropped. A change that was just deployed shows on the second open (the first open is served from the cache).
const CACHE = 'diceverse-9be4ac7e73';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('diceverse-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net.catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    }),
  );
});
