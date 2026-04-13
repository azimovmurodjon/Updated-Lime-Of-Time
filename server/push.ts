/**
 * Expo Push Notification Service
 *
 * Sends push notifications directly to the business owner's device via
 * the Expo Push API. Notifications appear as "Lime Of Time" on the device.
 *
 * Deep-link data payloads allow tapping a notification to navigate to
 * the correct screen in the app.
 */

export type PushNotificationData = {
  /** Notification type for deep-link routing in the app */
  type:
    | "appointment_request"
    | "appointment_cancelled"
    | "appointment_rescheduled"
    | "waitlist"
    | "appointment_reminder"
    | "general";
  /** Appointment local ID for navigating to the specific appointment */
  appointmentId?: string;
  /** Calendar tab filter to open (requests, cancelled, upcoming, completed) */
  filter?: "requests" | "cancelled" | "upcoming" | "completed";
};

export type PushPayload = {
  title: string;
  body: string;
  data?: PushNotificationData;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send a push notification to a specific Expo push token.
 * Returns true if the notification was accepted by Expo, false otherwise.
 */
export async function sendExpoPush(
  expoPushToken: string,
  payload: PushPayload
): Promise<boolean> {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken[")) {
    console.warn("[Push] Invalid or missing Expo push token:", expoPushToken);
    return false;
  }

  const body = {
    to: expoPushToken,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: payload.sound ?? "default",
    badge: payload.badge,
    channelId: payload.channelId ?? "appointments",
    priority: "high",
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[Push] Expo push API error (${response.status}): ${text}`);
      return false;
    }

    const result = await response.json();
    const ticket = result?.data;

    if (ticket?.status === "error") {
      console.warn("[Push] Expo push ticket error:", ticket.message, ticket.details);
      return false;
    }

    console.log("[Push] Notification sent successfully:", ticket?.id ?? "ok");
    return true;
  } catch (err) {
    console.error("[Push] Failed to send Expo push notification:", err);
    return false;
  }
}

/**
 * Send a push notification for a new appointment request.
 * Tapping navigates to the Calendar → Requests tab.
 */
export async function notifyNewBooking(
  expoPushToken: string,
  businessName: string,
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  appointmentId: string
): Promise<boolean> {
  return sendExpoPush(expoPushToken, {
    title: `📅 New Booking Request — ${businessName}`,
    body: `${clientName} requested ${serviceName} on ${date} at ${formatTime12(time)}. Tap to review.`,
    data: {
      type: "appointment_request",
      appointmentId,
      filter: "requests",
    },
    channelId: "appointments",
  });
}

/**
 * Send a push notification for a client-initiated cancellation.
 * Tapping navigates to the Calendar → Cancelled tab.
 */
export async function notifyCancellation(
  expoPushToken: string,
  businessName: string,
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  appointmentId: string
): Promise<boolean> {
  return sendExpoPush(expoPushToken, {
    title: `❌ Appointment Cancelled — ${businessName}`,
    body: `${clientName} cancelled their ${serviceName} on ${date} at ${formatTime12(time)}.`,
    data: {
      type: "appointment_cancelled",
      appointmentId,
      filter: "cancelled",
    },
    channelId: "appointments",
  });
}

/**
 * Send a push notification for a client-initiated reschedule.
 * Tapping navigates to the Calendar → Requests tab (needs re-confirmation).
 */
export async function notifyReschedule(
  expoPushToken: string,
  businessName: string,
  clientName: string,
  serviceName: string,
  newDate: string,
  newTime: string,
  appointmentId: string
): Promise<boolean> {
  return sendExpoPush(expoPushToken, {
    title: `🔄 Appointment Rescheduled — ${businessName}`,
    body: `${clientName} rescheduled their ${serviceName} to ${newDate} at ${formatTime12(newTime)}. Tap to confirm.`,
    data: {
      type: "appointment_rescheduled",
      appointmentId,
      filter: "requests",
    },
    channelId: "appointments",
  });
}

/**
 * Send a push notification for a new waitlist entry.
 * Tapping navigates to the Calendar → Requests tab.
 */
export async function notifyWaitlist(
  expoPushToken: string,
  businessName: string,
  clientName: string,
  serviceName: string,
  preferredDate: string
): Promise<boolean> {
  return sendExpoPush(expoPushToken, {
    title: `⏳ New Waitlist Entry — ${businessName}`,
    body: `${clientName} joined the waitlist for ${serviceName} on ${preferredDate}.`,
    data: {
      type: "waitlist",
      filter: "requests",
    },
    channelId: "appointments",
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}
