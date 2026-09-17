"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMobileVapidPublicKey,
  registerMobileSubscription,
  unregisterMobileSubscription,
  triggerTestMobileAlert,
} from "@/app/actions/mobile-notifications";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useMobilePush() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check support and active subscription status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = setTimeout(() => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);

        navigator.serviceWorker.ready
          .then(async (reg) => {
            try {
              const sub = await reg.pushManager.getSubscription();
              setIsSubscribed(Boolean(sub));
            } catch {
              setIsSubscribed(false);
            }
          })
          .catch(() => {});
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!isSupported) {
      setStatusMessage("Push notifications are not supported by this browser.");
      return false;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setStatusMessage("Notification permission was not granted.");
        setIsLoading(false);
        return false;
      }

      // 2. Register Service Worker
      const registration = await navigator.serviceWorker.register("/mobile-sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      // 3. Get VAPID Public Key from server
      const vapidRes = await getMobileVapidPublicKey();
      if (!vapidRes.success) {
        throw new Error(vapidRes.error || "Failed to retrieve VAPID key");
      }
      if (!vapidRes.data) {
        throw new Error("Failed to retrieve VAPID key: Empty key returned");
      }

      // 4. Subscribe with PushManager
      const convertedKey = urlBase64ToUint8Array(vapidRes.data);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as BufferSource,
      });

      const jsonSub = subscription.toJSON();
      const p256dh = jsonSub.keys?.p256dh;
      const auth = jsonSub.keys?.auth;

      if (!subscription.endpoint || !p256dh || !auth) {
        throw new Error("Push subscription is missing cryptographic keys.");
      }

      // Determine platform
      const ua = navigator.userAgent;
      const platform = /iPhone|iPad|iPod/.test(ua)
        ? "ios"
        : /Android/.test(ua)
        ? "android"
        : "web";

      // 5. Persist subscription in PostgreSQL DB via Server Action
      const registerRes = await registerMobileSubscription({
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
        platform,
        userAgent: ua,
      });

      if (!registerRes.success) {
        throw new Error(registerRes.error || "Couldn’t enable notifications. Please try again.");
      }

      setIsSubscribed(true);
      setStatusMessage("Push notifications successfully enabled!");
      return true;
    } catch (err: unknown) {
      console.error("[useMobilePush] Subscription error:", err);
      let message = err instanceof Error ? err.message : "Couldn’t enable notifications. Please try again.";
      if (
        message.includes("prisma") ||
        message.includes("Prisma") ||
        message.includes("constraint") ||
        message.includes("invocation") ||
        message.includes("fkey")
      ) {
        message = "Couldn’t enable notifications. Please try again.";
      }
      setStatusMessage(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribeFromPush = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await unregisterMobileSubscription(sub.endpoint);
      }
      setIsSubscribed(false);
      setStatusMessage("Notifications disabled.");
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to disable notifications.";
      setStatusMessage(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTestNotification = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await triggerTestMobileAlert("FOLLOWUP_REMINDER");
      if (res.success) {
        setStatusMessage(
          `Test alert dispatched! Sent to ${res.data.pushSent} active device(s).`
        );
        return true;
      } else {
        setStatusMessage(res.error || "Failed to trigger test alert.");
        return false;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to trigger test alert.";
      setStatusMessage(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    statusMessage,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
  };
}
