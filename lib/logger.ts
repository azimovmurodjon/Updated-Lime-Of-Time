/**
 * Dev-only logger utility.
 *
 * In production builds (__DEV__ === false), all log calls are no-ops so no
 * sensitive data (tokens, endpoints, payloads) leaks into production logs.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.log("[API] Request:", url);
 *   logger.warn("[Store] Missing field:", key);
 *   logger.error("[Auth] Token expired");
 *
 * For errors that should ALWAYS be reported (even in production), use
 * logger.captureError() which forwards to Sentry when available.
 */

type LogLevel = "log" | "warn" | "error";

function noop(..._args: unknown[]): void {}

function makeLogger(level: LogLevel) {
  if (__DEV__) {
    return (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      (console[level] as (...a: unknown[]) => void)(...args);
    };
  }
  return noop;
}

export const logger = {
  /** Debug-level log — suppressed in production */
  log: makeLogger("log"),
  /** Warning — suppressed in production */
  warn: makeLogger("warn"),
  /**
   * Error — suppressed in production console but forwarded to Sentry if
   * configured. Use this for unexpected failures that need investigation.
   */
  error: (...args: unknown[]) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error(...args);
    }
    // Forward to Sentry in production (imported lazily to avoid circular deps)
    try {
      // Sentry is optional — only active after SENTRY_DSN is configured
      const Sentry = require("@sentry/react-native");
      const message = args
        .map((a) => (a instanceof Error ? a.message : String(a)))
        .join(" ");
      Sentry.captureMessage(message, "error");
    } catch {
      // Sentry not installed or not configured — silently ignore
    }
  },
  /**
   * Explicitly capture an Error object to Sentry (always, even in production).
   * Use for caught exceptions that indicate real bugs.
   */
  captureError: (err: unknown, context?: Record<string, unknown>) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error("[captureError]", err, context);
    }
    try {
      const Sentry = require("@sentry/react-native");
      if (context) {
        Sentry.withScope((scope: any) => {
          Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
          Sentry.captureException(err);
        });
      } else {
        Sentry.captureException(err);
      }
    } catch {
      // Sentry not installed — silently ignore
    }
  },
};
