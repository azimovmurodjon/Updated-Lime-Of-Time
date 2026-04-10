import React from "react";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Provider component that initializes the notification system.
 * Wraps children and activates the useNotifications hook.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  useNotifications();
  return <>{children}</>;
}
