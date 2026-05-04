const CACHE_NAME = 'viajero-amba-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './favoritos.html',
    './historial.html',
    './contacto.html',
    './css/styles.css',
    './js/main.js',
    './js/api.js',
    './js/busqueda.js',
    './js/colectivos.js',
    './js/detail.js',
    './js/favoritos.js',
    './js/historial.js',
    './js/storage.js',
    './js/subtes.js',
    './js/trenes.js',
    './js/ui.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// install: precachea los recursos principales para que la interfaz cargue aun sin conexion.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            await Promise.all(STATIC_ASSETS.map(async asset => {
                try {
                    await cache.add(asset);
                } catch (error) {
                    // Algunos archivos, como los iconos, pueden agregarse despues sin bloquear la instalacion.
                    console.warn('No se pudo precachear:', asset, error);
                }
            }));
        })
    );
    self.skipWaiting();
});

// activate: elimina caches viejos para dejar solo la version vigente.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

// fetch: usa cache-first para recursos estaticos del mismo origen y deja las APIs seguir por red.
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);

    if (requestUrl.origin !== self.location.origin) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(networkResponse => {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return networkResponse;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return caches.match('./index.html');
            });
        })
    );
});
