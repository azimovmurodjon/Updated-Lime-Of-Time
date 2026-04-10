import React from "react";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Provider component that initializes the notification system.
 * Wraps children and activates the useNotifications hook which:
 * - Schedules local appointment reminders with business name
 * - Handles notification tap navigation to correct screens
 * - Manages notification permissions
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  useNotifications();
  return <>{children}</>;
}
