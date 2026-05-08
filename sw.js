/**
 * Service worker — cache app shell + data on install, network-first for HTML, cache-first for static.
 */
const CACHE = 'fit-tracker-v15';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './src/styles.css',
  './src/app.js',
  './src/db.js',
  './src/lib/tdee.js',
  './src/lib/e1rm.js',
  './src/lib/static_data.js',
  './src/lib/plan_builder.js',
  './src/views/home.js',
  './src/views/workout.js',
  './src/views/meals.js',
  './src/views/body.js',
  './src/views/dashboard.js',
  './src/views/schedule.js',
  './src/views/cardio.js',
  './src/views/programs.js',
  './data/library.json',
  './data/meal_library.json',
  './data/common_foods.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL).catch(err => console.warn('cache miss', err))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  // Don't intercept cross-origin requests (Open Food Facts, YouTube, CDNs)
  if (new URL(request.url).origin !== location.origin) return;
  // Network-first: always fetch fresh when online, fall back to cache offline
  e.respondWith(
    fetch(request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
      }
      return res;
    }).catch(() => caches.match(request))
  );
});
