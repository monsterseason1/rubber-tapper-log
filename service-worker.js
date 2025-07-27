// --- START OF FILE service-worker.js ---

const CACHE_NAME = 'rubber-tapper-log-cache-v10'; // A new, clean start.
const DATA_CACHE_NAME = 'rubber-tapper-data-cache-v1';
const EXTERNAL_CACHE_NAME = 'external-assets-cache-v1';

const urlsToCache = [
  // IMPORTANT: The path for the root MUST be the actual file, not the directory.
  './index.html',
  './style.css',
  './manifest.json',
  './game_data.json',
  './images/icon-192x192.png',
  './images/icon-512x512.png',
  './js/main.js',
  './js/dom.js',
  './js/state.js',
  './js/ui.js',
  './js/session.js',
  './js/analysis.js',
  './js/missions.js',
  './js/upgrades.js',
  './js/plantation.js',
  './js/breeding.js',
  './js/marketplace.js',
  './js/gameDataService.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[Service Worker] Caching App Shell for version ${CACHE_NAME}`);
        // This is the most reliable way to handle the root.
        // We fetch index.html and put it in the cache with the root URL as the key.
        return fetch('./index.html')
            .then(response => cache.put('./', response))
            .then(() => cache.addAll(urlsToCache));
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('[Service Worker] Failed to cache App Shell. This is a critical error.', error);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, DATA_CACHE_NAME, EXTERNAL_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignore non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Strategy 1: Stale-While-Revalidate for game_data.json
    if (url.pathname.endsWith('game_data.json')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then(async cache => {
                const cachedResponse = await cache.match(request);
                const fetchPromise = fetch(request).then(networkResponse => {
                    if (networkResponse.ok) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                });
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // Strategy 2: Cache First, then Network for external assets
    if (url.origin !== self.location.origin) {
        event.respondWith(
            caches.open(EXTERNAL_CACHE_NAME).then(async cache => {
                const cachedResponse = await cache.match(request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                try {
                    const networkResponse = await fetch(request);
                    if (networkResponse.ok) {
                        await cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    return new Response(null, { status: 503, statusText: 'Service Unavailable' });
                }
            })
        );
        return;
    }

    // Strategy 3: Cache First for all local assets (HTML, JS, CSS, images)
    // This is the most robust and standard offline-first strategy.
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            // If not in cache, something is wrong, but we try to fetch it as a last resort.
            return fetch(request);
        })
    );
});