const CACHE_NAME = 'trackit-cache';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/design-tokens.css',
    '/css/styles.css',
    '/js/db.js',
    '/js/utils.js',
    '/js/markdown.js',
    '/js/app.js',
    '/js/components/icons.js',
    '/js/components/header.js',
    '/js/components/toast.js',
    '/js/components/modal.js',
    '/js/pages/home.js',
    '/js/pages/history.js',
    '/js/pages/workout-detail.js',
    '/js/pages/create-workout.js',
    '/js/pages/settings.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
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

// Fetch — Network-first, then cache
self.addEventListener('fetch', (e) => {
    // Skip non-GET
    if (e.request.method !== 'GET') return;

    // Skip cross-origin requests (e.g., Google Fonts) to prevent CORS issues
    if (!e.request.url.startsWith(self.location.origin)) return;

    e.respondWith(
        fetch(e.request).then(response => {
            // Cache successful responses
            if (response.status === 200 || response.type === 'opaque') {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
            }
            return response;
        }).catch(() => {
            // Fallback to cache
            return caches.match(e.request).then(cached => {
                if (cached) return cached;
                // Fallback for navigation requests
                if (e.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                // Must return a Response object to avoid undefined promise rejection
                return Response.error();
            });
        })
    );
});
