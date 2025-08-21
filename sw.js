
const CACHE = 'brainlock-static-v2';
const ASSETS = [
  './',
  './index.html',
  './assets/app.js',
  './assets/style.css',
  './data/brainlock_dataset.json',
  './data/obstacles.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
