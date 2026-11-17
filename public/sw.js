// Kill switch for the 2025 Brainlock service worker (cache-first) that was served
// from this same path. Browsers re-check sw.js on navigation, install this one,
// and it clears the old cache, unregisters itself and reloads open tabs.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate(c.url))
    })(),
  )
})
