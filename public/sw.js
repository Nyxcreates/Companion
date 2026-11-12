// Companion Service Worker — PWA & Web Push
const CACHE_NAME = "companion-static-v2";
const PRECACHE_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Pre-caching should not block installation if an icon or asset fails
        console.warn("[Companion SW] Pre-caching issue:", err);
        return self.skipWaiting();
      })
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("companion-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // SECURITY RULE: Never cache private user data, authentication responses, or API requests
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("identitytoolkit") ||
    url.hostname.includes("securetoken") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("google.com")
  ) {
    // Network-only — never intercept or store in cache
    return;
  }

  // 1. Navigation requests (HTML pages) → Network-first with offline.html fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("/offline.html").then((fallback) => {
          return fallback || new Response("Offline", { status: 503, statusText: "Offline" });
        });
      })
    );
    return;
  }

  // 2. Static assets (_next/static, icons, fonts, local images) → Stale-while-revalidate
  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/fonts/") ||
      url.pathname.startsWith("/worlds/") ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/manifest.json");

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});

// ── Web Push Notification Handling ───────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {
    title: "Nikki",
    body: "Checking in on you!",
    url: "/dashboard",
    icon: "/icons/icon-192.png",
    tag: "companion-checkin",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "companion-notification",
    data: {
      url: data.url || "/dashboard",
      dateOfArrival: Date.now(),
    },
    vibrate: [100, 50, 100],
    actions: data.actions || [
      { action: "open", title: "Open Companion" },
      { action: "dismiss", title: "Later" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title || "Nikki", options));
});

// ── Notification Click ───────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const reminderId      = event.notification.data?.reminderId;
  const uniqueKey       = event.notification.data?.uniqueKey;
  const breakSessionId  = event.notification.data?.breakSessionId;

  // ── Break notification actions ────────────────────────────────────────────
  if (breakSessionId) {
    if (event.action === "break-extend") {
      // User tapped "5 more minutes" on the break-end push
      event.waitUntil(
        fetch("/api/schedule/break/extend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => {})
      );
      return; // Don't navigate
    }
    // "break-back" or plain click → open timetable
    const url = event.notification.data?.url || "/plan?tab=schedule";
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((windowClients) => {
          for (const client of windowClients) {
            if (client.url.includes(self.location.origin) && "focus" in client) {
              client.navigate(url);
              return client.focus();
            }
          }
          if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
    return;
  }

  // ── Timetable reminder actions ────────────────────────────────────────────
  if (reminderId || uniqueKey) {
    const actionName = event.action || "click";
    event.waitUntil(
      fetch("/api/schedule/reminders/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId, uniqueKey, action: actionName }),
      }).catch(() => {})
    );
  }

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/plan?tab=schedule";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
