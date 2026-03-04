/* sw.js */
const CACHE = "study-timer-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./log.html",
  "./month.html",
  "./manifest.json",
  "./css/app.css",
  "./js/db.js",
  "./js/subjects.js",
  "./js/time.js",
  "./js/timer.js",
  "./js/ui-today.js",
  "./js/ui-log.js",
  "./js/ui-month.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
    })
  );
});
