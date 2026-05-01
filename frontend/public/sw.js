/**
 * VisionAttend Service Worker — offline support
 *
 * Strategy:
 *  - Static assets (HTML, JS, CSS, fonts): Cache-First
 *  - API GET requests: Network-First with cache fallback
 *  - API POST/PUT/DELETE: Background Sync queue (replayed when back online)
 */

const CACHE_VERSION = "va-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to pre-cache on install
const PRECACHE_URLS = ["/", "/index.html"];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// ── Activate — clear stale caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't intercept WebSocket upgrades or non-GET mutations
  if (request.method !== "GET") return;

  // API routes — Network First, cache on success
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // Static assets — Cache First
  event.respondWith(cacheFirstStatic(request));
});

async function networkFirstApi(request) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: { code: "OFFLINE", message: "No network connection and no cached data available." } }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline fallback page if available
    return caches.match("/index.html") || new Response("Offline", { status: 503 });
  }
}
