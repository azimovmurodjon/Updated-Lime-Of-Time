import { useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";

// Configure foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Notification data payload types for deep navigation.
 * Each notification carries a `type` and relevant IDs so tapping
 * navigates to the correct screen.
 */
export type NotificationData = {
  /** Type of notification for routing */
  type: "appointment_reminder" | "appointment_request" | "appointment_cancelled" | "appointment_rescheduled" | "waitlist" | "general";
  /** Appointment ID to navigate to */
  appointmentId?: string;
  /** URL to navigate to (Expo Router path) */
  url?: string;
};

/**
 * Hook to manage local appointment reminder notifications
 * and handle notification tap navigation.
 */
export function useNotifications() {
  const { state } = useStore();
  const router = useRouter();
  const scheduledRef = useRef<Set<string>>(new Set());
  const listenerSetupRef = useRef(false);

  // Get business name for notification titles
  const businessName = state.settings.businessName || "Lime Of Time";

  /**
   * Navigate based on notification data payload.
   * Routes to the correct screen depending on notification type.
   */
  const handleNotificationNavigation = useCallback(
    (data: NotificationData | Record<string, unknown>) => {
      if (!data) return;

      const notifType = data.type as string;
      const appointmentId = data.appointmentId as string | undefined;

      switch (notifType) {
        case "appointment_reminder":
        case "appointment_request":
        case "appointment_cancelled":
        case "appointment_rescheduled":
          if (appointmentId) {
            // Navigate to appointment detail with the specific appointment
            router.push({ pathname: "/appointment-detail", params: { id: appointmentId } });
          } else {
            // Fallback: go to calendar requests tab
            router.push({ pathname: "/(tabs)/calendar", params: { filter: "requests" } });
          }
          break;

        case "waitlist":
          // Navigate to calendar requests view
          router.push({ pathname: "/(tabs)/calendar", params: { filter: "requests" } });
          break;

        default:
          // If there's a URL in the data, navigate to it
          if (data.url && typeof data.url === "string") {
            router.push(data.url as any);
          } else if (appointmentId) {
            // Fallback: if we have an appointmentId, go to appointment detail
            router.push({ pathname: "/appointment-detail", params: { id: appointmentId } });
          }
          break;
      }
    },
    [router]
  );

  // Request permissions on mount
  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("appointments", {
          name: "Appointment Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#6BBF59",
        });
      }
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    })();
  }, []);

  // Set up notification response listener for tap handling (once)
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (listenerSetupRef.current) return;
    listenerSetupRef.current = true;

    // Handle notification taps when app is running (foreground/background)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationData;
        if (data) {
          // Small delay to ensure navigation is ready
          setTimeout(() => handleNotificationNavigation(data), 300);
        }
      }
    );

    // Handle cold-start: check if app was opened from a notification
    const checkInitialNotification = async () => {
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const data = lastResponse.notification.request.content.data as NotificationData;
          if (data) {
            // Longer delay for cold start to ensure app is fully loaded
            setTimeout(() => handleNotificationNavigation(data), 1000);
          }
        }
      } catch (err) {
        console.warn("[Notifications] Failed to get last notification response:", err);
      }
    };
    checkInitialNotification();

    return () => {
      responseSubscription.remove();
      listenerSetupRef.current = false;
    };
  }, [handleNotificationNavigation]);

  // Schedule reminders for upcoming appointments
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!state.settings.notificationsEnabled) return;

    const now = new Date();
    const upcomingAppts = state.appointments.filter((a) => {
      if (a.status !== "confirmed" && a.status !== "pending") return false;
      const [h, m] = a.time.split(":").map(Number);
      const apptDate = new Date(a.date + "T00:00:00");
      apptDate.setHours(h, m, 0, 0);
      // Only schedule for appointments in the future (within 7 days)
      const diffMs = apptDate.getTime() - now.getTime();
      return diffMs > 30 * 60 * 1000 && diffMs < 7 * 24 * 60 * 60 * 1000;
    });

    upcomingAppts.forEach(async (appt) => {
      const key = `reminder-${appt.id}`;
      if (scheduledRef.current.has(key)) return;
      scheduledRef.current.add(key);

      const [h, m] = appt.time.split(":").map(Number);
      const apptDate = new Date(appt.date + "T00:00:00");
      apptDate.setHours(h, m, 0, 0);

      const svc = state.services.find((s) => s.id === appt.serviceId);
      const client = state.clients.find((c) => c.id === appt.clientId);

      // Schedule 30-minute reminder
      const reminderDate = new Date(apptDate.getTime() - 30 * 60 * 1000);
      if (reminderDate.getTime() > now.getTime()) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${businessName} — Appointment in 30 min`,
              body: `${client?.name || "Client"} — ${svc?.name || "Service"} at ${appt.time}`,
              data: {
                type: "appointment_reminder",
                appointmentId: appt.id,
              } as NotificationData,
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminderDate,
            },
          });
        } catch (err) {
          console.warn("[Notifications] Failed to schedule 30-min reminder:", err);
        }
      }

      // Schedule 1-hour reminder
      const hourReminderDate = new Date(apptDate.getTime() - 60 * 60 * 1000);
      if (hourReminderDate.getTime() > now.getTime()) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${businessName} — Appointment in 1 Hour`,
              body: `${client?.name || "Client"} — ${svc?.name || "Service"} at ${appt.time}`,
              data: {
                type: "appointment_reminder",
                appointmentId: appt.id,
              } as NotificationData,
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: hourReminderDate,
            },
          });
        } catch (err) {
          console.warn("[Notifications] Failed to schedule 1-hour reminder:", err);
        }
      }
    });
  }, [state.appointments, state.services, state.clients, state.settings.notificationsEnabled, businessName]);

  const cancelAllReminders = useCallback(async () => {
    if (Platform.OS === "web") return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    scheduledRef.current.clear();
  }, []);

  return { cancelAllReminders };
}
