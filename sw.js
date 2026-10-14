/* ── Service worker: makes InvoiceMate work offline ───────
   On first visit it saves a copy of every file the app needs. After
   that the app opens from those saved copies — no internet needed, ever.
   All the data lives on the device (js/api.js), so there are no server
   calls left to worry about.

   TO SHIP AN UPDATE: change CACHE_NAME (e.g. v3 -> v4). The browser
   notices this file changed, downloads the new set of files, and throws
   the old set away. Without that bump, devices keep the old version.
──────────────────────────────────────────────────────────── */
const CACHE_NAME = 'invoicemate-standalone-v2';   // v2: My Details page

// Relative paths, so the app works from a sub-folder address such as
// https://<user>.github.io/InvoiceMate_PWA/ as well as from a domain root.
const APP_FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/vendor/pdf-lib.min.js',
  'js/api.js',
  'js/lock.js',
  'js/backup.js',
  'js/settings.js',
  'js/clients.js',
  'js/invoices.js',
  'js/pdf.js',
  'js/details.js',
  'js/app.js'
];

// Install — save every app file
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

// Activate — delete saved copies from older versions
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — saved copy first, the network only for anything not saved.
// ignoreSearch so 'index.html?source=pwa' still finds 'index.html'.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => cached || fetch(e.request))
  );
});
