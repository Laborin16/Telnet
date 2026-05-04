// Incrementar CACHE_VERSION al desplegar nueva versión para limpiar caché anterior
const CACHE_VERSION = 'sit-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/Logo-Telnet.png',
  '/manifest.json',
];

// ── Install: precachear el shell de la app ────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: eliminar cachés viejos y tomar control inmediato ────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: estrategias de caché por tipo de recurso ───────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API y media de push: siempre red (nunca cachear respuestas de API)
  if (url.pathname.startsWith('/api/')) return;

  // Assets con hash y fotos subidas: cache-first (nombre único → nunca cambia)
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/media/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((resp) => {
            if (resp.ok) {
              caches.open(CACHE_VERSION).then((c) => c.put(request, resp.clone()));
            }
            return resp;
          })
      )
    );
    return;
  }

  // App shell y resto: network-first con fallback a caché (permite uso offline)
  event.respondWith(
    fetch(request)
      .then((resp) => {
        if (resp.ok) {
          caches.open(CACHE_VERSION).then((c) => c.put(request, resp.clone()));
        }
        return resp;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached ?? caches.match('/'))
      )
  );
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Notificación', {
      body: data.body ?? '',
      icon: '/Logo-Telnet.png',
      badge: '/Logo-Telnet.png',
      data: data.data ?? {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
