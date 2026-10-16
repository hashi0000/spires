/* Minimal service worker so the office app can be installed on a phone.
   Network first: never cache Firestore or Auth responses. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.hostname.includes("googleapis.com") || url.hostname.includes("firebaseio.com")) {
    return;
  }
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
