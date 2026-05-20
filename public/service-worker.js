// PriceControl Pakistan — minimal offline shell.
// Strategy: cache static shell on install; network-first for navigation
// requests with cache fallback (lets the app open without connectivity).

const CACHE = 'pc-shell-v1'
const SHELL = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/history.html',
  '/admin.html',
  '/cities.html',
  '/login.html',
  '/area-monitors.html',
  '/map.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Use addAll with fallback so a missing file doesn't abort install
      Promise.all(
        SHELL.map((url) =>
          cache.add(url).catch(() => null)
        )
      )
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Never intercept API / Supabase calls — always go to network.
  if (url.hostname !== self.location.hostname) return

  // HTML navigations: network-first, fall back to cache.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    )
    return
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (!res || res.status !== 200) return res
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
    )
  )
})
