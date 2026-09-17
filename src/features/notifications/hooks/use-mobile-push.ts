"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMobileVapidPublicKey,
  registerMobileSubscription,
  unregisterMobileSubscription,
  syncDeviceSubscription,
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

function detectPlatform(): { platform: "ios" | "android" | "web"; isIOS: boolean; isStandalone: boolean } {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { platform: "web", isIOS: false, isStandalone: false };
  }
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as unknown as { standalone?: boolean }).standalone);

  const platform: "ios" | "android" | "web" = isIOS
    ? "ios"
    : /Android/.test(ua)
    ? "android"
    : "web";

  return { platform, isIOS, isStandalone };
}

export function useMobilePush() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [requiresPwaInstall, setRequiresPwaInstall] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check support and active subscription status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const { platform, isIOS: ios, isStandalone: standalone } = detectPlatform();
    setIsIOS(ios);
    setIsStandalone(standalone);

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    // On iOS Safari tabs (not added to Home Screen), Web Push requires PWA install
    if (ios && !standalone && !supported) {
      setRequiresPwaInstall(true);
      return;
    }

    if (supported) {
      setPermission(Notification.permission);

      // Check existing service worker registration without hanging
      navigator.serviceWorker.getRegistration().then(async (reg) => {
        if (!reg) {
          setIsSubscribed(false);
          return;
        }

        try {
          const sub = await reg.pushManager.getSubscription();
          if (!sub) {
            setIsSubscribed(false);
            return;
          }

          // Device has a browser subscription: sync and ensure active in DB for this user
          const jsonSub = sub.toJSON();
          const p256dh = jsonSub.keys?.p256dh;
          const auth = jsonSub.keys?.auth;

          if (p256dh && auth) {
            const syncRes = await syncDeviceSubscription({
              endpoint: sub.endpoint,
              keys: { p256dh, auth },
              platform,
              userAgent: navigator.userAgent,
            });
            setIsSubscribed(syncRes.success ? true : Boolean(sub));
          } else {
            setIsSubscribed(true);
          }
        } catch {
          setIsSubscribed(false);
        }
      }).catch(() => {});
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!isSupported) {
      if (isIOS && !isStandalone) {
        setStatusMessage("On iPhone/iOS, please add this app to your Home Screen first.");
      } else {
        setStatusMessage("Push notifications are not supported by this browser.");
      }
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

      // 3. Clean up any stale or invalid subscription for THIS phone before subscribing
      let oldEndpoint: string | null = null;
      try {
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          oldEndpoint = existingSub.endpoint;
          await existingSub.unsubscribe();
        }
      } catch {
        // Safe fallback if unsubscribe fails
      }

      // If there was an old endpoint on this phone, deactivate it in DB so only the new endpoint is used
      if (oldEndpoint) {
        try {
          await unregisterMobileSubscription(oldEndpoint);
        } catch {
          // safe ignore
        }
      }

      // 4. Get VAPID Public Key from server
      const vapidRes = await getMobileVapidPublicKey();
      if (!vapidRes.success) {
        throw new Error(vapidRes.error || "Failed to retrieve VAPID key");
      }
      if (!vapidRes.data) {
        throw new Error("Failed to retrieve VAPID key: Empty key returned");
      }

      // 5. Subscribe with PushManager
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
      const { platform } = detectPlatform();
      const ua = navigator.userAgent;

      // 6. Persist subscription in PostgreSQL DB via Server Action
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
  }, [isSupported, isIOS, isStandalone]);

  const unsubscribeFromPush = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await unregisterMobileSubscription(sub.endpoint);
        }
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
        // If the subscription is expired or missing in DB, update local state
        const err = res.error || "";
        if (
          err.toLowerCase().includes("expired") ||
          err.toLowerCase().includes("no active device") ||
          err.toLowerCase().includes("re-enable") ||
          err.toLowerCase().includes("again") ||
          err.toLowerCase().includes("revoked")
        ) {
          setIsSubscribed(false);
        }
        setStatusMessage(err || "Failed to trigger test alert.");
        return false;
      }
    } catch (err: unknown) {
      console.error("[useMobilePush] Test push error:", err);
      let message = "Push notification delivery failed. Please re-enable notifications and try again.";
      if (err instanceof Error && err.message) {
        const msg = err.message;
        if (
          !msg.includes("unexpected response") &&
          !msg.includes("prisma") &&
          !msg.includes("Prisma") &&
          !msg.includes("invocation") &&
          !msg.includes("fetch")
        ) {
          message = msg;
        }
      }
      setIsSubscribed(false);
      setStatusMessage(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isIOS,
    isStandalone,
    requiresPwaInstall,
    permission,
    isSubscribed,
    isLoading,
    statusMessage,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
  };
}
