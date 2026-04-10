import { useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
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
 * Hook to manage local appointment reminder notifications.
 * Schedules reminders for upcoming confirmed/pending appointments.
 */
export function useNotifications() {
  const { state } = useStore();
  const scheduledRef = useRef<Set<string>>(new Set());

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

      // Schedule 30-minute reminder
      const reminderDate = new Date(apptDate.getTime() - 30 * 60 * 1000);
      if (reminderDate.getTime() > now.getTime()) {
        try {
          const svc = state.services.find((s) => s.id === appt.serviceId);
          const client = state.clients.find((c) => c.id === appt.clientId);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Upcoming Appointment 📅",
              body: `${client?.name || "Client"} - ${svc?.name || "Service"} in 30 minutes`,
              data: { appointmentId: appt.id },
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminderDate,
            },
          });
        } catch (err) {
          console.warn("[Notifications] Failed to schedule reminder:", err);
        }
      }

      // Schedule 1-hour reminder
      const hourReminderDate = new Date(apptDate.getTime() - 60 * 60 * 1000);
      if (hourReminderDate.getTime() > now.getTime()) {
        try {
          const svc = state.services.find((s) => s.id === appt.serviceId);
          const client = state.clients.find((c) => c.id === appt.clientId);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Appointment in 1 Hour ⏰",
              body: `${client?.name || "Client"} - ${svc?.name || "Service"} at ${appt.time}`,
              data: { appointmentId: appt.id },
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
  }, [state.appointments, state.services, state.clients, state.settings.notificationsEnabled]);

  const cancelAllReminders = useCallback(async () => {
    if (Platform.OS === "web") return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    scheduledRef.current.clear();
  }, []);

  return { cancelAllReminders };
}
