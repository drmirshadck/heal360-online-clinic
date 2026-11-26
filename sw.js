/* Service worker: lets the site install as an app and shows the doctor's booking notifications.
   Always loads the latest website from the internet; keeps a copy of the main pages for offline opening. */
const CACHE = "doc-v6";
const CORE = ["./", "index.html", "doctor.html", "consult.html", "style.css", "app.js", "config.js", "qrcode.js", "doctor.jpg", "icons/icon-192.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;   // booking, payments, video, helper: always live
  e.respondWith((r.mode === "navigate" ? fetch(r) : fetch(r.url, { cache: "no-cache" })).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); return res; })
    .catch(() => caches.match(r).then(m => m || (r.mode === "navigate" ? caches.match("index.html") : undefined))));
});

/* ---------- doctor notifications (Standard) ---------- */
const TEXT = {
  request:     ["New booking request", "A patient has booked and paid. Tap to confirm."],
  created:     ["New booking", "A patient has booked a consultation."],
  cancelled:   ["Booking cancelled", "A patient cancelled a booking."],
  rescheduled: ["Booking rescheduled", "A patient changed their booking time."],
  waiting:     ["Patient is waiting", "Your patient is in the consultation room. Tap to join."]
};
async function helperUrl() {
  try {
    const r = await fetch("config.js", { cache: "no-store" });
    const m = (await r.text()).match(/helper:\s*\{[^}]*url:\s*"([^"]*)"/);
    return m ? m[1] : "";
  } catch (e) { return ""; }
}
self.addEventListener("push", e => {
  e.waitUntil((async () => {
    let kind = "request", who = "";
    try {
      const h = await helperUrl();
      if (h) { const r = await fetch(h.replace(/\/$/, "") + "/last-event", { cache: "no-store" }); const d = await r.json(); if (TEXT[d.type]) kind = d.type; who = d.doctor || ""; }
    } catch (err) {}
    const [t0, body] = TEXT[kind];
    const title = who ? t0 + " · " + who : t0;
    await self.registration.showNotification(title, { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "booking", renotify: true, data: { url: "doctor.html" } });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "doctor.html", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(url)) { c.focus(); return c.navigate(url); }
    return clients.openWindow(url);
  }));
});
