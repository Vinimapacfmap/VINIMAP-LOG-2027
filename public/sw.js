const CACHE_NAME = 'vinimap-driver-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192.jpg',
  '/icon-512.jpg',
  '/logo.jpg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install Event: Pre-cache core assets for immediate offline availability
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core app assets for driver offline availability');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Non-critical precache item failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old cache versions and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Removing old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Offline-first & Network Fallback Strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip dev server hot reload / API requests if any
  if (url.pathname.startsWith('/@vite') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle HTML navigation requests (e.g., Opening the driver app link / standalone PWA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline or network unavailable, serve cached index.html SPA entry point
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || caches.match('/');
          });
        })
    );
    return;
  }

  // General Static Assets / External CDN Assets Strategy: Network-First with Cache Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse && 
            networkResponse.status === 200 && 
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse;
        });

      // Return cached version immediately if available, otherwise wait for network fetch
      return cachedResponse || fetchPromise;
    })
  );
});
