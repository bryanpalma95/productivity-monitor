/* ============================================================
   Productivity Monitor - Service Worker v2.1.0
   Cache offline para PWA
   ============================================================ */

const CACHE_NAME = 'productivity-monitor-v2.2.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './css/styles.css',
  './css/standalone.css',
  './js/core.js',
  './js/dashboard.js',
  './js/monitor.js',
  './js/sessions.js',
  './js/reports.js',
  './js/init.js',
  './js/app.js',
  './partials/header.html',
  './partials/dashboard.html',
  './partials/monitor.html',
  './partials/sessions.html',
  './partials/reports.html',
  './partials/search.html',
  './partials/data.html',
  './partials/footer.html'
];

// Instalación: cachear assets core
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: estrategia cache-first con fallback a red
self.addEventListener('fetch', (event) => {
  // No interceptar peticiones a APIs externas
  if (event.request.url.includes('omniroute') || event.request.url.includes('fonts.googleapis') || event.request.url.includes('cdnjs')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then((response) => {
            // Cachear solo respuestas válidas
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Fallback offline para navegación
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
