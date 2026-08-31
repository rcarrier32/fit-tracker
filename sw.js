/**
 * Service worker — offline fallback for catalogs; app code always loads from network.
 */
const CACHE = 'fit-tracker-v51';

self.addEventListener('install', e => {
  self.skipWaiting(); // activate immediately so stale HTTP-cached JS gets bypassed on next reload
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Shell entry points only. Module URLs carry a ?v= query that lives in index.html,
      // so precaching them by bare path would never match the real request — they get
      // cached at runtime on first online load instead.
      c.addAll([
        './',
        './index.html',
        './data/library.json',
        './data/meal_library.json',
        './data/common_foods.json',
      ]).catch(err => console.warn('cache miss', err))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Navigations ("/" has no .html suffix, so the extension test below never catches it).
  // Network-first, then the cached shell — without this the app cannot boot offline at all.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request)
          .then(hit => hit || caches.match('./index.html'))
          .then(hit => hit || Promise.reject(new Error('offline, no cached shell'))))
    );
    return;
  }

  // App shell + modules: network ALWAYS wins so stale code never serves (the v33 fix).
  // The only change from "network only" is a cache fallback when the fetch itself fails —
  // i.e. offline. Online behaviour is byte-identical to before: no-store, straight to network.
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('version.json')
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          // Stash a copy for offline. version.json is deliberately excluded — serving a
          // stale version number offline would fight the update checker.
          if (res.ok && !url.pathname.endsWith('version.json')) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(hit => hit || Promise.reject(new Error('offline, not cached'))))
    );
    return;
  }

  // Data JSON: network-first, cache fallback for offline
  if (url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});
