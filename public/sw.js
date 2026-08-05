const STATIC_CACHE_NAME = 'vinimap-static-v5';
const TILE_CACHE_NAME = 'vinimap-tiles-v5';
const DYNAMIC_CACHE_NAME = 'vinimap-dynamic-v5';

// Core assets to pre-cache on SW installation
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192.jpg',
  '/icon-512.jpg',
  '/logo.jpg',
  '/logo.png',
  '/apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Helper to determine if a request URL is a Leaflet map tile
function isMapTileRequest(url) {
  const href = url.href.toLowerCase();
  return (
    href.includes('basemaps.cartocdn.com') ||
    href.includes('tile.openstreetmap.org') ||
    href.includes('arcgisonline.com/arcgis/rest/services') ||
    href.includes('stamen-tiles') ||
    href.includes('/rastertiles/') ||
    href.includes('/dark_all/') ||
    /\/tile\/\d+\/\d+\/\d+/.test(href) ||
    /\/\d+\/\d+\/\d+\.png/.test(href)
  );
}

// Helper to determine if a request URL is an external CDN or static dependency
function isStaticOrCdnAsset(url) {
  const href = url.href.toLowerCase();
  return (
    href.includes('unpkg.com/leaflet') ||
    href.includes('fonts.googleapis.com') ||
    href.includes('fonts.gstatic.com') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.woff2')
  );
}

// 1. Install Event: Pre-cache core app shell & Leaflet CDN dependencies
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core app assets & Leaflet CDN for offline mode');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Non-critical precache item failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Purge old cache buckets and claim clients immediately
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE_NAME, TILE_CACHE_NAME, DYNAMIC_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => {
            console.log('[SW] Purging outdated cache bucket:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Offline-first tile caching & Network-First navigation fallback
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS GET requests
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip Vite dev server hot reload and API endpoints
  if (url.pathname.startsWith('/@vite') || url.pathname.startsWith('/api/')) {
    return;
  }

  // --- STRATEGY A: MAP TILES (Cache First -> Network Fallback with Cache API Storage) ---
  if (isMapTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((tileCache) => {
        return tileCache.match(event.request).then((cachedTile) => {
          if (cachedTile) {
            // Instant load from Cache API (Offline ready!)
            return cachedTile;
          }

          // Fetch tile from network and cache response (even opaque type 0 or 200)
          return fetch(event.request)
            .then((networkResponse) => {
              if (
                networkResponse &&
                (networkResponse.status === 200 || networkResponse.type === 'opaque' || networkResponse.type === 'cors')
              ) {
                try {
                  tileCache.put(event.request, networkResponse.clone());
                } catch (e) {
                  console.warn('[SW] Failed to store tile in Cache API:', e);
                }
              }
              return networkResponse;
            })
            .catch(() => {
              // Return cached tile if available, else standard fallback
              return cachedTile;
            });
        });
      })
    );
    return;
  }

  // --- STRATEGY B: HTML NAVIGATION (Network First -> SPA index.html Fallback) ---
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Serve cached index.html SPA entry point when offline in low 4G signal area
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || caches.match('/');
          });
        })
    );
    return;
  }

  // --- STRATEGY C: STATIC ASSETS & CDN DEPENDENCIES (Stale-While-Revalidate / Cache First) ---
  if (isStaticOrCdnAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              (networkResponse.status === 200 || networkResponse.type === 'opaque' || networkResponse.type === 'cors')
            ) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // --- STRATEGY D: GENERAL REQUESTS (Network First with Dynamic Cache Fallback) ---
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// 4. Message Handler for client Cache API inspection and management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_TILE_CACHE') {
    caches.delete(TILE_CACHE_NAME).then(() => {
      console.log('[SW] Map tiles cache purged by user command');
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, message: 'Map tile cache cleared' });
      }
    });
  }
});
