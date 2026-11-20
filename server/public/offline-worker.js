/* Generated substitutions are supplied by the Hono /service-worker.js route. */
const CACHE = __EMERGENZ_CACHE__;
const CORE = __EMERGENZ_CORE__;
// Weak scene connectivity should not leave a responder waiting on a blank
// screen: after this long the cached shell is used instead.
const NETWORK_TIMEOUT_MS = 4000;
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
function networkWithTimeout(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), NETWORK_TIMEOUT_MS);
    Promise.resolve().then(() => fetch(request)).then((response) => {
      clearTimeout(timer);
      if (response && response.ok) resolve(response); else reject(new Error('Network response not usable'));
    }, (error) => { clearTimeout(timer); reject(error); });
  });
}
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache API responses, credentials, incidents, private imports, live feeds,
  // map tiles or third-party resources. Saved incidents use the existing local store.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const navigation = event.request.mode === 'navigate' && ['/', '/index.html', '/hazard-id', '/chemical-id'].includes(url.pathname);
  const asset = CORE.includes(`${url.pathname}${url.search}`);
  if (!navigation && !asset) return;
  // Network-first: when the server is reachable every load gets the current
  // deployed build, so a field device can never stay on a stale release. The
  // cached shell is the offline / weak-signal fallback only.
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    try {
      return await networkWithTimeout(event.request);
    } catch {
      return (await cache.match(navigation ? '/' : event.request)) || fetch(event.request);
    }
  }));
});
