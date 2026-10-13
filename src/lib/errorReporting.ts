import * as Sentry from "@sentry/react";

/**
 * Report a handled error to Sentry while keeping the console breadcrumb.
 *
 * Use this where a failure is already surfaced to the user (toast/inline
 * message) but would otherwise leave no trace for debugging. Sentry is a no-op
 * when `VITE_SENTRY_DSN` is unset, so this is always safe to call.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error(error);
  Sentry.captureException(error, context ? { extra: context } : undefined);
}