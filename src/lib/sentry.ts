/**
 * Sentry init — Ultra Advisor observability
 *
 * Why: surface client-side errors + perf traces in production. Hooked into
 * console.error automatically by @sentry/react (so we kept console.error
 * alive in vite.config.ts by dropping only 'debugger', not 'console').
 *
 * Env contract:
 *   - VITE_SENTRY_DSN missing → no-op (warn once, then silent)
 *   - Test files do NOT import this module
 */

import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  if (!dsn) {
    // One-time warn so the dev sees it but logs stay clean
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[sentry] VITE_SENTRY_DSN not set — Sentry disabled (no-op)');
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_FORCE === '1',
      // captureConsoleIntegration 必須顯式加，否則 console.error 不會自動上報
      // (預設 integrations 只 capture unhandled exception + promise rejection)
      integrations: [
        Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
      ],
    });
  } catch (err) {
    // Init must never crash the app
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[sentry] init failed:', err);
    }
  }
}

/**
 * Manual capture — wrap try/catch sites where we want extra context
 * but don't want to rely on console.error.
 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* swallow */
  }
}
