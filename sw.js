/* PWA service worker — offline app shell for GitHub Pages / any http(s) host (not used on file://).
   Strategy: precache everything on install; network-first for navigations/data/code so updates arrive when online,
   cache fallback when offline. Bump VERSION on every release so clients pick up the new shell. */
const VERSION = '2.2.0';
const CACHE = 'tft-lab-' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './data/bundle.js',
  './assets/index.js', './js/core.js', './js/dashboard.js', './js/meta.js', './js/builder.js', './js/sim.js', './js/augments.js', './js/scout.js',
  './js/drill.js', './js/records.js', './js/settings.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
];
self.addEventListener('install', e => {
  // cache: 'reload' bypasses the HTTP cache so a new version never precaches stale files
  // app shell + every bundled art asset (portraits, trait & item icons) so the PWA looks right offline
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
    try { const list = await (await fetch('./assets/files.json', { cache: 'reload' })).json(); await c.addAll(list.map(u => './' + u)); } catch (err) { /* art is optional; runtime cache fills it */ }
  }));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('tft-lab-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.includes('/assets/')) { // art: cache-first
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(r => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
    return;
  }
  e.respondWith(
    fetch(req).then(r => {
      if (r && r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(m => m || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
