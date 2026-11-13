/**
 * Service worker — offline fallback for catalogs; app code always loads from network.
 */
const CACHE = 'fit-tracker-v161';

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
        './data/providers/pjf.json',
        './data/providers/trainheroic.json',
        './data/providers/hoopstudy.json',
        './data/clips.json',
      ]).catch(err => console.warn('cache miss', err))
    )
  );
});

self.addEventListener('activate', e => {
  // Carry the previous version's cached files over before deleting its cache: the new cache only
  // fills as files load online, so without this the first offline launch after an update is blank.
  e.waitUntil((async () => {
    const cur = await caches.open(CACHE);
    for (const k of (await caches.keys()).filter(k => k !== CACHE)) {
      const old = await caches.open(k);
      for (const req of await old.keys()) {
        if (!(await cur.match(req))) { const res = await old.match(req); if (res) await cur.put(req, res); }
      }
      await caches.delete(k);
    }
  })());
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
        .catch(() => caches.match(e.request)
          // Offline right after an update: app.js?v=<new> isn't cached yet, the previous build's is.
          .then(hit => hit || caches.match(e.request, { ignoreSearch: true }))
          .then(hit => hit || Promise.reject(new Error('offline, not cached'))))
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
