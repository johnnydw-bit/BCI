// Minimal service worker — required for PWA installability
// No caching strategy: all requests go straight to the network.
// This keeps the app always up to date (important for a live data tool).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)))
