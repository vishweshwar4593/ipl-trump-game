if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', () => {
    self.registration.unregister()
      .then(() => self.clients.matchAll())
      .then(clients => {
        clients.forEach(client => {
          client.navigate(client.url);
        });
      });
  });
} else {
  const CACHE_NAME = "ipl-trump-cache-v1";
  const PRECACHE_ASSETS = [
    "/",
    "/index.html",
    "/favicon.ico",
    "/manifest.json"
  ];

  self.addEventListener("install", event => {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(PRECACHE_ASSETS);
      }).then(() => self.skipWaiting())
    );
  });

  self.addEventListener("activate", event => {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(name => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      }).then(() => self.clients.claim())
    );
  });

  self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);

    // Bypass cache for Socket.io, Firebase RTDB, and Auth APIs
    const isOnlineEndpoint = 
      url.pathname.includes("socket.io") || 
      url.hostname.includes("firebaseio.com") || 
      url.hostname.includes("googleapis.com");

    // Bypass cache for media files to avoid range request errors (206 partial content caching crashes)
    const isMediaFile = 
      url.pathname.endsWith(".wav") || 
      url.pathname.endsWith(".mp3") || 
      url.pathname.endsWith(".ogg") ||
      url.pathname.endsWith(".mp4");

    if (isOnlineEndpoint || isMediaFile || event.request.method !== "GET") {
      return;
    }

    // Stale-While-Revalidate strategy for internal static assets
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // Fetch new version in background to update cache
          fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(err => {
          // Fallback for navigation requests (SPA support)
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
      })
    );
  });
}
