const CACHE_VERSION = "uketune-v1";
const CACHE_PREFIX = "uketune-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./sw.js",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./src/tuning-config.js",
  "./src/tuning-math.js",
  "./src/yin-pitch-detector.js",
  "./src/pitch-stabilizer.js",
  "./src/microphone-source.js",
  "./src/audio-file-analyzer.js",
  "./src/tuner-controller.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX)
            && cacheName !== CACHE_VERSION)
          .map((cacheName) => caches.delete(cacheName))
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true }))
      ?? (await cache.match("./index.html"))
      ?? (await cache.match("./"));
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_VERSION);
  const cachedResponse = await cache.match(request, { ignoreSearch: true });
  const networkResponse = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  });

  if (cachedResponse) {
    event.waitUntil(networkResponse.catch(() => {}));
    return cachedResponse;
  }

  return networkResponse;
}
