const CACHE_NAME = "listora-shell-v3";
const APP_ROOT = new URL("./", self.location.href).pathname;
const APP_SHELL = [APP_ROOT, APP_ROOT + "manifest.webmanifest", APP_ROOT + "icons/listora.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("listora-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache API traffic, Supabase requests, or dynamic application data.
  if (url.pathname.includes("/rest/") || url.pathname.includes("/auth/") || url.pathname.includes("/realtime/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT, copy));
        }
        return response;
      }).catch(async () => (await caches.match(request)) || (await caches.match(APP_ROOT)))
    );
    return;
  }

  if (url.pathname.startsWith(APP_ROOT + "assets/") || url.pathname === APP_ROOT + "manifest.webmanifest" || url.pathname === APP_ROOT + "icons/listora.svg") {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }))
    );
  }
});
