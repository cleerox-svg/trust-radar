/* Averrow service worker — PWA shell + runtime caching.
 *
 * Scope: /v2/  (set by registration; matches the SPA's vite `base`).
 * Old SPA at / and /legacy is unaffected — its pages are not in scope.
 *
 * Three caching strategies:
 *   1. Navigation requests (/v2/...)   → stale-while-revalidate against the shell cache
 *   2. /api/... GETs                   → network-first, cache fallback (offline 503)
 *   3. /v2/assets/... (Vite hashed)    → cache-first immutable
 *   4. Anything else same-origin       → stale-while-revalidate (runtime cache)
 *
 * Cross-origin (Google Fonts, etc.) is not intercepted — browser handles it.
 * Non-GET methods are not intercepted — the network sees them directly.
 *
 * Bump VERSION on any change here so old caches are evicted on activate.
 */

const VERSION = '2026-04-27.1';
const SHELL_CACHE   = `averrow-shell-${VERSION}`;
const API_CACHE     = `averrow-api-${VERSION}`;
const RUNTIME_CACHE = `averrow-runtime-${VERSION}`;

// Minimal precache: the SPA shell, manifest, and root favicon. Everything
// else fills in opportunistically through SWR + cache-first as the user
// navigates.
const SHELL_PRECACHE = [
  '/v2/',
  '/v2/index.html',
  '/v2/manifest.json',
  '/v2/favicon.svg',
  '/v2/icon-192.svg',
  '/v2/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Use { cache: 'reload' } so the install fetches from network even if
      // the browser HTTP cache has a stale copy.
      Promise.all(
        SHELL_PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const stale = keys.filter(
        (k) =>
          (k.startsWith('averrow-shell-') ||
            k.startsWith('averrow-api-') ||
            k.startsWith('averrow-runtime-')) &&
          !k.endsWith(VERSION)
      );
      await Promise.all(stale.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigations: stale-while-revalidate against the shell.
  if (req.mode === 'navigate') {
    event.respondWith(navigationHandler(req));
    return;
  }

  // API: network-first, cache fallback.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // Vite-hashed bundles are immutable — cache-first is safe.
  if (url.pathname.startsWith('/v2/assets/')) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // Everything else (CSS not in /assets, icons, /favicon.svg, etc.)
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ─── Strategies ─────────────────────────────────────────────────────────

async function navigationHandler(req) {
  // Try network for the latest shell, but always fall back to cached /v2/
  // shell so the app boots offline. The SPA does its own data refetching
  // once it's running.
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(SHELL_CACHE);
    cache.put('/v2/', fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const cached = (await cache.match('/v2/')) || (await cache.match('/v2/index.html'));
    if (cached) return cached;
    return new Response('Offline. Reload when you have a connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ success: false, error: 'offline', message: 'No cached response available.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.status === 200) {
    cache.put(req, fresh.clone()).catch(() => {});
  }
  return fresh;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((fresh) => {
      if (fresh && fresh.status === 200) {
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}
