// sw.js
const VERSION = '2025.08.13-065858';
const CACHE_NAME = 'brainlock-cache-' + VERSION;
const ASSETS = ['./','./index.html?v=2025.08.13-065858','./manifest.webmanifest?v=2025.08.13-065858','./app.js?v=2025.08.13-065858','./model.js?v=2025.08.13-065858','./assets/icons/icon-192.png','./assets/icons/icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const keys=await caches.keys(); await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))); await self.clients.claim();})());});
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET') return; e.respondWith((async()=>{ const cache=await caches.open(CACHE_NAME); const cached=await cache.match(e.request); const fetchP=fetch(e.request).then(r=>{ if(r&&r.status===200&&e.request.url.startsWith(self.location.origin)) cache.put(e.request,r.clone()); return r; }).catch(()=>cached); return cached||fetchP; })()); });
