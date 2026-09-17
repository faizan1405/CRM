// ScaleFlow Mobile Service Worker for Push Notifications
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "You have a new CRM update.",
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/badge-72x72.png",
      tag: data.tag || "crm-notification",
      data: data.data || {},
      actions: data.actions || [],
      vibrate: data.vibrate || [200, 100, 200],
      requireInteraction: Boolean(data.requireInteraction),
    };

    event.waitUntil(self.registration.showNotification(data.title || "ScaleFlow CRM", options));
  } catch (err) {
    console.error("[ServiceWorker] Error processing push event:", err);
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const action = event.action;

  let targetUrl = notificationData.url || "/";

  if (action === "call" && notificationData.phone) {
    targetUrl = `tel:${notificationData.phone.replace(/[^+\d]/g, "")}`;
  } else if (action === "reschedule" && notificationData.leadId) {
    targetUrl = `/leads/${notificationData.leadId}?action=followup`;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // Focus existing window if open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
