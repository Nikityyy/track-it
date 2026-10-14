const CACHE_NAME = 'trackit-cache-v9';

const PRECACHE_URLS = [
    './',
    './index.html',
    './design-tokens.css',
    './fonts/archivo-latin.woff2',
    './fonts/archivo-latin-ext.woff2',
    './css/styles.css',
    './vendor/lucide.min.js',
    './vendor/web-haptics.js',
    './js/db.js',
    './js/utils.js',
    './js/markdown.js',
    './js/form-history.js',
    './js/rest-timer.js',
    './js/app.js',
    './js/components/icons.js',
    './js/components/header.js',
    './js/components/toast.js',
    './js/components/modal.js',
    './js/pages/home.js',
    './js/pages/history.js',
    './js/pages/workout-detail.js',
    './js/pages/create-workout.js',
    './js/pages/settings.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Install — precache
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// Activate — cleanup old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — Stale-While-Revalidate for same-origin static assets to prevent hangs on weak networks
self.addEventListener('fetch', (e) => {
    // Skip non-GET
    if (e.request.method !== 'GET') return;

    // Skip cross-origin requests (e.g., Google Fonts) to prevent CORS issues
    if (!e.request.url.startsWith(self.location.origin)) return;

    e.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(e.request);

            // Revalidate / fetch in background (or foreground if not cached)
            const networkFetch = fetch(e.request)
                .then((networkResponse) => {
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                })
                .catch(() => {
                    if (e.request.mode === 'navigate') {
                        return cache.match('./index.html');
                    }
                    return null;
                });

            // If found in cache, return immediately (fast, resilient against weak networks)
            if (cachedResponse) {
                try { e.waitUntil(networkFetch); } catch {}
                return cachedResponse;
            }

            // Navigation fallback if requested URL path was not exact match in cache
            if (e.request.mode === 'navigate') {
                const navCached = await cache.match('./index.html') || await cache.match('./');
                if (navCached) {
                    try { e.waitUntil(networkFetch); } catch {}
                    return navCached;
                }
            }

            // If not cached, await network response
            const response = await networkFetch;
            if (response) return response;

            // Final offline fallback for navigation requests
            if (e.request.mode === 'navigate') {
                const fallback = await cache.match('./index.html') || await cache.match('./');
                if (fallback) return fallback;
            }

            return Response.error();
        })
    );
});
