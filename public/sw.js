// Companion Service Worker — PWA & Web Push
// v3 — corrected notificationclick with focus-first, URL validation,
//       and full push-data forwarding into notification.data
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

// ── URL Safety Helper ─────────────────────────────────────────────────────────
/**
 * Validates that a destination URL is within the Companion origin and scope.
 * Returns a safe, same-origin path string, or the fallback if invalid.
 */
function safeDestinationUrl(rawUrl, fallback) {
  fallback = fallback || "/dashboard";
  if (!rawUrl) return fallback;
  try {
    // Relative paths are safe — resolve against origin
    const origin = self.location.origin;
    const resolved = new URL(rawUrl, origin);
    // Reject cross-origin destinations
    if (resolved.origin !== origin) return fallback;
    // Reject paths outside the PWA scope (scope is "/")
    if (!resolved.pathname.startsWith("/")) return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}

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

  // Merge ALL push payload fields (including reminderId, uniqueKey, breakSessionId, etc.)
  // into notification.data so notificationclick can read them reliably.
  const notificationData = {
    // Explicit top-level convenience fields
    url: data.url || "/dashboard",
    dateOfArrival: Date.now(),
    // Forward the full nested data object from the push payload (contains reminderId, etc.)
    ...(data.data || {}),
    // Also carry any top-level fields that services set directly
    reminderId: data.reminderId || (data.data && data.data.reminderId) || undefined,
    uniqueKey: data.uniqueKey || (data.data && data.data.uniqueKey) || undefined,
    breakSessionId: data.breakSessionId || (data.data && data.data.breakSessionId) || undefined,
    scheduleId: data.scheduleId || (data.data && data.data.scheduleId) || undefined,
    itemIndex: data.itemIndex !== undefined ? data.itemIndex : (data.data && data.data.itemIndex),
    nudgeId: data.nudgeId || (data.data && data.data.nudgeId) || undefined,
  };

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "companion-notification",
    data: notificationData,
    vibrate: [100, 50, 100],
    actions: data.actions || [
      { action: "open", title: "Open Companion" },
      { action: "dismiss", title: "Later" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title || "Nikki", options));
});

// ── Open or Focus a Companion Window ─────────────────────────────────────────
/**
 * Finds an existing Companion PWA window and focuses it, navigating to the
 * destination URL.  If no window exists, opens a new one with clients.openWindow().
 *
 * Focus-first guarantees the window is foregrounded before navigate() is called,
 * which is required by the spec (navigate only works on focused WindowClients).
 *
 * clients.openWindow() opens the URL inside the installed PWA when the browser
 * and OS support it (Chrome/Android, Chrome/desktop).  On iOS Safari and Firefox,
 * it opens a browser tab — this is a platform limitation outside SW control.
 */
function openOrFocusCompanion(urlPath) {
  var destination = safeDestinationUrl(urlPath, "/dashboard");

  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then(function (windowClients) {
      // Prefer a client already on the destination path so we avoid navigating
      // away from an already-correct page.
      var exactMatch = null;
      var anyCompanionWindow = null;

      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        try {
          var clientUrl = new URL(client.url);
          if (clientUrl.origin !== self.location.origin) continue;
          if (!anyCompanionWindow) anyCompanionWindow = client;
          if (
            clientUrl.pathname === new URL(destination, self.location.origin).pathname &&
            !exactMatch
          ) {
            exactMatch = client;
          }
        } catch (_) {
          // Ignore unparseable client URLs
        }
      }

      var target = exactMatch || anyCompanionWindow;

      if (target) {
        // focus() first — required before navigate() on most implementations.
        return target.focus().then(function (focusedClient) {
          var fc = focusedClient || target;
          // Only navigate if we are not already on the destination.
          try {
            var currentPath = new URL(fc.url).pathname + new URL(fc.url).search;
            var destUrl = new URL(destination, self.location.origin);
            var destPath = destUrl.pathname + destUrl.search;
            if (currentPath !== destPath) {
              return fc.navigate(destination);
            }
          } catch (_) {
            return fc.navigate(destination);
          }
        });
      }

      // No existing window — open a new one.
      // On supported browsers (Chrome on Android/desktop), this will open
      // inside the installed standalone PWA instead of a browser tab.
      return self.clients.openWindow(destination);
    });
}

// ── Notification Click ───────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  var notifData      = event.notification.data || {};
  var reminderId     = notifData.reminderId;
  var uniqueKey      = notifData.uniqueKey;
  var breakSessionId = notifData.breakSessionId;
  var nudgeId        = notifData.nudgeId;
  var action         = event.action || "";

  // ── Break notification actions ─────────────────────────────────────────────
  if (breakSessionId) {
    if (action === "break-extend") {
      // User tapped "5 more minutes" — call extend API, do NOT navigate
      event.waitUntil(
        fetch("/api/schedule/break/extend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(function () {})
      );
      return;
    }

    // "break-back" or plain click → record action then open timetable
    if (action === "break-back") {
      // Fire-and-forget action report
      fetch("/api/schedule/break/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakSessionId: breakSessionId, action: "back" }),
      }).catch(function () {});
    }

    var breakUrl = safeDestinationUrl(notifData.url, "/plan?tab=schedule");
    event.waitUntil(openOrFocusCompanion(breakUrl));
    return;
  }

  // ── Timetable / reminder actions ───────────────────────────────────────────
  if (reminderId || uniqueKey) {
    var actionName = action || "click";

    // Always report the action, then navigate (unless dismissed)
    var reportPromise = fetch("/api/schedule/reminders/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderId: reminderId,
        uniqueKey: uniqueKey,
        action: actionName,
      }),
    }).catch(function () {});

    if (action === "dismiss") {
      event.waitUntil(reportPromise);
      return;
    }

    // "start", "later", "skip", or plain click → navigate to timetable
    var reminderUrl = nudgeId
      ? safeDestinationUrl("/?openNikki=" + nudgeId, "/plan?tab=schedule")
      : safeDestinationUrl(notifData.url, "/plan?tab=schedule");

    event.waitUntil(
      Promise.resolve(reportPromise).then(function () {
        return openOrFocusCompanion(reminderUrl);
      })
    );
    return;
  }

  // ── Generic notification click (dismiss or plain click) ───────────────────
  if (action === "dismiss") {
    return;
  }

  var genericUrl = nudgeId
    ? safeDestinationUrl("/?openNikki=" + nudgeId, "/dashboard")
    : safeDestinationUrl(notifData.url, "/dashboard");

  event.waitUntil(openOrFocusCompanion(genericUrl));
});

// ── Notification Close ────────────────────────────────────────────────────────
self.addEventListener("notificationclose", (event) => {
  // Track dismiss via close button (optional — fire-and-forget)
  var notifData  = event.notification.data || {};
  var reminderId = notifData.reminderId;
  var uniqueKey  = notifData.uniqueKey;

  if (reminderId || uniqueKey) {
    fetch("/api/schedule/reminders/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderId: reminderId,
        uniqueKey: uniqueKey,
        action: "dismiss",
      }),
    }).catch(function () {});
  }
});
