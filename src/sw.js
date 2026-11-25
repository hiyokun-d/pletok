/* Pletok offline worker — built by vite.config.ts (the asset list + version are filled in at build).
 * Worst case at the booth: the venue wifi drowns in phones. Whoever has opened the site once
 * keeps the whole menu: app, pictures and fonts come from this cache, pages fall back to it after
 * a short wait. Only the live bits (Google Sheet, analytics) need the network. */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const CACHE = `pletok-${VERSION}`
/** how long a page load waits for the network before showing the saved copy */
const NAV_TIMEOUT_MS = 3500

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['/', ...PRECACHE]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pletok-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // the Sheet, analytics, anything not ours: straight to the network, never cached
  if (url.origin !== self.location.origin || url.pathname.startsWith('/_vercel')) return
  // the /gallery videos stream in pieces (range requests) — the browser handles those, not this cache
  if (req.headers.has('range') || url.pathname.endsWith('.mp4')) return

  // pages: fresh if the network answers quickly, else the saved app (it routes itself)
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        const net = fetch(req).then((r) => {
          if (r.ok) void cache.put('/', r.clone())
          return r
        })
        const late = new Promise((res) => setTimeout(() => res(null), NAV_TIMEOUT_MS))
        try {
          const r = await Promise.race([net, late])
          if (r) return r
        } catch {
          /* offline — fall through */
        }
        return (await cache.match('/')) || net
      })(),
    )
    return
  }

  // hashed assets, images, fonts, icons: cache first, fill the cache as we go
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok && r.type === 'basic') {
            const copy = r.clone()
            void caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return r
        }),
    ),
  )
})
