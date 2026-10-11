// Dare Battles service worker: offline fallback, asset cache, partner push alerts.
// ponytail: one cache that is never pruned across deploys; bump VERSION if it ever grows too big.
const VERSION = "db-v2"
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/badge-96.png", "/avatars/he.webp", "/avatars/she.webp", "/gifs/cry.webp"]
const DEV = location.hostname === "localhost" || location.hostname === "127.0.0.1"

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const keep = (req, res) => {
  if (res.ok) {
    const copy = res.clone()
    caches.open(VERSION).then((c) => c.put(req, copy))
  }
  return res
}

self.addEventListener("fetch", (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return

  // Pages: always fresh (the game is live); home and join stay usable offline, everything else gets the offline screen.
  if (req.mode === "navigate") {
    const shell = url.pathname === "/" || url.pathname === "/join"
    e.respondWith(
      fetch(req)
        .then((res) => (shell ? keep(url.pathname, res) : res))
        .catch(async () => (shell && (await caches.match(url.pathname))) || caches.match("/offline.html")),
    )
    return
  }

  // Hashed build files and stickers never change in place: cache first.
  if ((!DEV && url.pathname.startsWith("/_next/static/")) || /^\/(gifs|avatars|icons)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(req, res))))
  }
})

self.addEventListener("push", (e) => {
  const n = e.data ? e.data.json() : {}
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const watching = wins.some((w) => w.visibilityState === "visible" && new URL(w.url).pathname === n.url)
      // The open game screen already shows the update. Safari revokes push if a message shows nothing,
      // so there we show it and close it at once; other browsers allow silence while the app is in front.
      const strict = /iPhone|iPad|Macintosh/.test(navigator.userAgent) && !/Chrome|Firefox|Edg/.test(navigator.userAgent)
      if (watching && !strict) return
      await self.registration.showNotification(n.title || "Dare Battles", {
        body: n.body,
        tag: n.tag,
        renotify: true,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        vibrate: [60, 40, 60],
        data: { url: n.url || "/" },
      })
      if (watching) (await self.registration.getNotifications({ tag: n.tag })).forEach((x) => x.close())
    })(),
  )
})

self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || "/"
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const open = wins.find((w) => new URL(w.url).pathname === url)
      return open ? open.focus() : self.clients.openWindow(url)
    })(),
  )
})
