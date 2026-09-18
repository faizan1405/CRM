// ScaleFlow Mobile Service Worker for Push Notifications
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

async function onPush(event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (_e) {
    try {
      data = { body: event.data.text() };
    } catch (_err) {
      data = { body: "ScaleFlow Follow-up Due" };
    }
  }

  const title = data.title || "ScaleFlow CRM";
  const body = data.body || "You have a new CRM update.";
  const tag = data.tag || `crm-${Date.now()}`;
  const customData = data.data || {};

  // Clean baseline options supported universally across all browsers (including iOS Safari PWA)
  const baseOptions = {
    body,
    tag,
    data: customData,
    icon: data.icon || "/icons/icon-192x192.png",
  };

  // Detect iOS WebKit
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent || "");

  // On iOS, WebKit rejects showNotification if unsupported options like actions or vibrate are passed.
  // We strictly avoid passing actions, vibrate, or badge on iOS.
  const richOptions = { ...baseOptions };

  if (!isIOS) {
    if (data.badge) richOptions.badge = data.badge;
    if (data.vibrate && Array.isArray(data.vibrate)) richOptions.vibrate = data.vibrate;
    if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
      richOptions.actions = data.actions;
    }
    if (data.requireInteraction) {
      richOptions.requireInteraction = true;
    }
  }

  // Multi-tier resilient presentation:
  // 1. Try with rich options (or clean baseOptions on iOS)
  // 2. If that rejects, try strictly baseOptions
  // 3. If that still rejects, try bare minimum { body }
  try {
    await self.registration.showNotification(title, richOptions);
  } catch (err1) {
    console.warn("[SW] Rich notification failed, retrying with base options:", err1);
    try {
      await self.registration.showNotification(title, baseOptions);
    } catch (err2) {
      console.error("[SW] Base notification failed, retrying with minimal options:", err2);
      try {
        await self.registration.showNotification(title, { body });
      } catch (err3) {
        console.error("[SW] Fatal: could not show notification:", err3);
      }
    }
  }
}

self.addEventListener("push", function (event) {
  event.waitUntil(onPush(event));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const action = event.action;

  let targetUrl = notificationData.url || "/";

  if (action === "call" && notificationData.phone) {
    const cleanPhone = notificationData.phone.replace(/[^+\d]/g, "");
    if (self.clients && self.clients.openWindow) {
      event.waitUntil(self.clients.openWindow(`tel:${cleanPhone}`));
    }
    return;
  }

  if (action === "reschedule" && notificationData.leadId) {
    targetUrl = `/leads/${notificationData.leadId}?action=followup`;
  } else if (action === "view" && notificationData.leadId) {
    targetUrl = `/leads/${notificationData.leadId}`;
  } else if (notificationData.leadId) {
    targetUrl = `/leads/${notificationData.leadId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ("focus" in client && "navigate" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients && self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
