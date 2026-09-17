export type MobileAlertCategory =
  | "FOLLOWUP_REMINDER"
  | "OVERDUE_FOLLOWUP"
  | "URGENT_LEAD";

export type MobileAlertPriority = "CRITICAL" | "HIGH" | "NORMAL";

export type MobilePlatform = "ios" | "android" | "web";

export interface MobileNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface MobilePushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag: string;
  data: {
    leadId?: string;
    leadName?: string;
    phone?: string;
    category: MobileAlertCategory;
    url: string;
    actionType?: "call" | "view" | "reschedule";
    [key: string]: unknown;
  };
  actions?: MobileNotificationAction[];
  vibrate?: number[];
  requireInteraction?: boolean;
}

export interface MobileDeviceSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh?: string | null;
  auth?: string | null;
  platform: MobilePlatform;
  userAgent?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MobileAlertItem {
  id: string;
  category: MobileAlertCategory;
  priority: MobileAlertPriority;
  title: string;
  body: string;
  leadId: string;
  leadName: string;
  phone?: string | null;
  scheduledAt?: string | null;
  payload: MobilePushPayload;
  dedupeKey: string;
  createdAt: string;
}

export interface MobileSubscriptionInput {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  platform?: MobilePlatform;
  userAgent?: string;
}
