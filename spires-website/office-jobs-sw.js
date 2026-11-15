self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let payload = { title: "Spires Driver Hub", body: "Open Spires Driver Hub.", tag: "family-job", url: "/office-jobs" };
  try {
    if (event.data) payload = Object.assign(payload, event.data.json());
  } catch (error) {
    payload.body = "Open Spires Driver Hub.";
  }
  event.waitUntil(self.registration.showNotification(payload.title || "Spires Driver Hub", {
    body: payload.body || "Open Spires Driver Hub.",
    icon: "/images/office-jobs-192.png",
    badge: "/images/office-jobs-192.png",
    tag: payload.tag || "family-job",
    renotify: true,
    data: { url: payload.url || "/office-jobs" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/office-jobs";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].url.indexOf("/office-jobs") !== -1 && "focus" in list[i]) return list[i].focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
    return undefined;
  }));
});
