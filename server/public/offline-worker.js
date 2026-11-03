/* Generated substitutions are supplied by the Hono /service-worker.js route. */
const CACHE = __EMERGENZ_CACHE__;
const CORE = __EMERGENZ_CORE__;
self.addEventListener('install', (event) => {
  // An incomplete download never replaces a working offline shell.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' })))));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('emergenz-shell-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') void self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache API responses, credentials, incidents, private imports, live feeds,
  // map tiles or third-party resources. Saved incidents use the existing local store.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const navigation = event.request.mode === 'navigate' && ['/', '/index.html', '/hazard-id', '/chemical-id'].includes(url.pathname);
  const asset = CORE.includes(`${url.pathname}${url.search}`);
  if (!navigation && !asset) return;
  event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(navigation ? '/' : event.request)) || fetch(event.request)));
});
