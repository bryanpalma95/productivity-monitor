/* ============================================================
   Productivity Monitor - Service Worker v2.3.0
   Cache offline para PWA — JS/HTML usan network-first
   ============================================================ */

const CACHE_NAME = 'productivity-monitor-v2.9.0';
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
  './js/firebase-config.js',
  './js/firebase.js',
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

// Activación: limpiar caches viejos y tomar control inmediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Permitir que la página fuerce skipWaiting si hay un SW en espera
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: network-first para JS/HTML (siempre código fresco), cache-first para assets estáticos
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // No interceptar peticiones a APIs externas ni Firebase
  if (
    url.includes('omniroute') ||
    url.includes('fonts.googleapis') ||
    url.includes('cdnjs') ||
    url.includes('gstatic.com') ||
    url.includes('firebaseapp') ||
    url.includes('googleapis.com')
  ) {
    return;
  }

  // Network-first para JS, HTML y partials: siempre intentar red primero
  const isCodeFile = url.endsWith('.js') || url.endsWith('.html') || url.includes('/partials/');

  if (isCodeFile) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Actualizar caché con la versión más nueva
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Sin red: servir desde caché como fallback offline
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Cache-first para CSS, imágenes, fuentes y otros assets estáticos
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            if (event.request.mode === 'navigate') return caches.match('./index.html');
          });
      })
  );
});
