/**
 * Sentry initialization for Lime Of Time.
 *
 * Call initSentry() once at app startup (before any other code runs).
 * The DSN is read from the EXPO_PUBLIC_SENTRY_DSN environment variable.
 * If the DSN is not set, Sentry is silently disabled — the app works normally.
 *
 * Setup steps:
 * 1. Create a project at https://sentry.io → name it "lime-of-time"
 * 2. Copy the DSN from Settings → Client Keys
 * 3. Add EXPO_PUBLIC_SENTRY_DSN=<your-dsn> to your .env file
 * 4. Rebuild the app (Publish button)
 *
 * After setup, every crash and unhandled error is automatically captured
 * with full stack traces, device info, and breadcrumbs.
 */

import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(): void {
  if (!dsn) {
    // DSN not configured — Sentry is disabled. This is expected in development
    // until the user sets up their Sentry project.
    return;
  }

  Sentry.init({
    dsn,
    // Release tracking — uses app version from app.config.ts
    release: Constants.expoConfig?.version,
    // Only send events in production to avoid noise during development
    enabled: !__DEV__,
    // Capture 100% of transactions for performance monitoring
    tracesSampleRate: 0.2,
    // Attach stack traces to all captured messages (not just errors)
    attachStacktrace: true,
    // Automatically capture unhandled promise rejections
    integrations: [
      Sentry.reactNativeTracingIntegration(),
    ],
  });
}

/**
 * Wrap the root component with Sentry's error boundary.
 * This catches React render errors and reports them to Sentry.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Wrap the root component with Sentry for performance monitoring.
 * Call this on the default export of app/_layout.tsx.
 */
export function withSentryWrapper<T extends React.ComponentType<any>>(component: T): T {
  if (!dsn) return component;
  return Sentry.wrap(component) as T;
}
