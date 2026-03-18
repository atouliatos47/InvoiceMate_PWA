const CACHE_NAME = 'invoicemate-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/api.js',
  '/js/clients.js',
  '/js/invoices.js',
  '/js/pdf.js',
  '/js/settings.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first for API, cache first for static
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'You are offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
