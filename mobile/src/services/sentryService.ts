/**
 * Sentry Service
 *
 * Centralized error tracking and performance monitoring via Sentry.
 * Provides initialization, user context management, and error capture helpers.
 *
 * Requirements: F-13 (Error Monitoring)
 */

import * as Sentry from '@sentry/react-native';

const IS_DEV = __DEV__;

/**
 * Initialize Sentry SDK
 * Must be called before app renders (typically in App.tsx).
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (IS_DEV) {
      console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — Sentry disabled');
    }
    return;
  }

  Sentry.init({
    dsn,
    debug: IS_DEV,
    environment: IS_DEV ? 'development' : 'production',
    tracesSampleRate: IS_DEV ? 1.0 : 0.2,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30_000,
    enableNativeCrashHandling: true,
  });
}

/**
 * Set user context after successful login
 */
export function setUserContext(user: { id: string; email: string; displayName?: string }): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.displayName,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Capture an exception with optional context
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (context) {
    Sentry.withScope((scope: Sentry.Scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
  });
}

/**
 * Re-export Sentry.wrap for wrapping the root App component
 */
export const wrapWithSentry = Sentry.wrap;
