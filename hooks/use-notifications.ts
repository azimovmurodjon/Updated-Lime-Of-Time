import { useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";

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
  type:
    | "appointment_reminder"
    | "appointment_request"
    | "appointment_cancelled"
    | "appointment_rescheduled"
    | "waitlist"
    | "general";
  /** Appointment ID to navigate to */
  appointmentId?: string;
  /** Calendar tab filter to open */
  filter?: "requests" | "cancelled" | "upcoming" | "completed";
  /** URL to navigate to (Expo Router path) */
  url?: string;
};

/**
 * Register for Expo push notifications and return the Expo push token.
 * Returns null if not on a physical device or permissions denied.
 */
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  // Must be a physical device — simulators don't support push
  if (!Device.isDevice) {
    console.log("[Notifications] Push notifications require a physical device");
    return null;
  }

  // Set up Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("appointments", {
      name: "Appointment Notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4a8c3f",
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Push notification permission denied");
    return null;
  }

  // Get the Expo push token
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn("[Notifications] No EAS project ID found in app config");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[Notifications] Expo push token:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.warn("[Notifications] Failed to get Expo push token:", err);
    return null;
  }
}

/**
 * Hook to manage push notification registration, local appointment reminders,
 * and notification tap deep-link navigation.
 */
export function useNotifications() {
  const { state } = useStore();
  const router = useRouter();
  const scheduledRef = useRef<Set<string>>(new Set());
  const listenerSetupRef = useRef(false);
  const tokenRegisteredRef = useRef(false);

  // Get business name for notification titles
  const businessName = state.settings.businessName || "Lime Of Time";

  // tRPC mutation to save push token to server
  const updateBusiness = trpc.business.update.useMutation();

  /**
   * Navigate based on notification data payload.
   * Routes to the correct screen depending on notification type.
   */
  const handleNotificationNavigation = useCallback(
    (data: NotificationData | Record<string, unknown>) => {
      if (!data) return;

      const notifType = data.type as string;
      const appointmentId = data.appointmentId as string | undefined;
      const filter = data.filter as string | undefined;

      switch (notifType) {
        case "appointment_request":
        case "appointment_rescheduled":
          // New booking or reschedule → go to Requests tab
          router.push({
            pathname: "/(tabs)/calendar",
            params: { filter: "requests" },
          });
          break;

        case "appointment_cancelled":
          // Client cancelled → go to Cancelled tab
          router.push({
            pathname: "/(tabs)/calendar",
            params: { filter: "cancelled" },
          });
          break;

        case "waitlist":
          // Waitlist entry → go to Requests tab
          router.push({
            pathname: "/(tabs)/calendar",
            params: { filter: "requests" },
          });
          break;

        case "appointment_reminder":
          // Appointment reminder → go to appointment detail if we have ID
          if (appointmentId) {
            router.push({
              pathname: "/appointment-detail",
              params: { id: appointmentId },
            });
          } else {
            router.push({
              pathname: "/(tabs)/calendar",
              params: { filter: "upcoming" },
            });
          }
          break;

        default:
          // Generic: use filter param if present, otherwise appointment detail or home
          if (filter) {
            router.push({
              pathname: "/(tabs)/calendar",
              params: { filter },
            });
          } else if (appointmentId) {
            router.push({
              pathname: "/appointment-detail",
              params: { id: appointmentId },
            });
          } else if (data.url && typeof data.url === "string") {
            router.push(data.url as any);
          }
          break;
      }
    },
    [router]
  );

  // Register for push notifications and save token to server
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (tokenRegisteredRef.current) return;
    if (!state.businessOwnerId) return;
    if (!state.settings.notificationsEnabled) return;

    tokenRegisteredRef.current = true;

    registerForPushNotificationsAsync().then((token) => {
      if (token && state.businessOwnerId) {
        // Save the push token to the server so it can send notifications
        updateBusiness.mutate(
          {
            id: state.businessOwnerId,
            expoPushToken: token,
          },
          {
            onSuccess: () => {
              console.log("[Notifications] Push token saved to server");
            },
            onError: (err) => {
              console.warn("[Notifications] Failed to save push token:", err);
            },
          }
        );
      }
    });
  }, [state.businessOwnerId, state.settings.notificationsEnabled]);

  // Set up notification response listener for tap handling (once)
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (listenerSetupRef.current) return;
    listenerSetupRef.current = true;

    // Handle notification taps when app is running (foreground/background)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content
          .data as NotificationData;
        if (data) {
          // Small delay to ensure navigation is ready
          setTimeout(() => handleNotificationNavigation(data), 300);
        }
      });

    // Handle cold-start: check if app was opened from a notification
    const checkInitialNotification = async () => {
      try {
        const lastResponse =
          await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const data = lastResponse.notification.request.content
            .data as NotificationData;
          if (data) {
            // Longer delay for cold start to ensure app is fully loaded
            setTimeout(() => handleNotificationNavigation(data), 1000);
          }
        }
      } catch (err) {
        console.warn(
          "[Notifications] Failed to get last notification response:",
          err
        );
      }
    };
    checkInitialNotification();

    return () => {
      responseSubscription.remove();
      listenerSetupRef.current = false;
    };
  }, [handleNotificationNavigation]);

  // Schedule local reminders for upcoming appointments
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
              title: `⏰ Appointment in 30 min — ${businessName}`,
              body: `${client?.name || "Client"} | ${svc?.name || "Service"} at ${appt.time} (${appt.duration} min) on ${appt.date}`,
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
          console.warn(
            "[Notifications] Failed to schedule 30-min reminder:",
            err
          );
        }
      }

      // Schedule 1-hour reminder
      const hourReminderDate = new Date(apptDate.getTime() - 60 * 60 * 1000);
      if (hourReminderDate.getTime() > now.getTime()) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⏰ Appointment in 1 Hour — ${businessName}`,
              body: `${client?.name || "Client"} | ${svc?.name || "Service"} at ${appt.time} (${appt.duration} min) on ${appt.date}`,
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
          console.warn(
            "[Notifications] Failed to schedule 1-hour reminder:",
            err
          );
        }
      }
    });
  }, [
    state.appointments,
    state.services,
    state.clients,
    state.settings.notificationsEnabled,
    businessName,
  ]);

  const cancelAllReminders = useCallback(async () => {
    if (Platform.OS === "web") return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    scheduledRef.current.clear();
  }, []);

  return { cancelAllReminders };
}
