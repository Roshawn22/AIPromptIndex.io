/**
 * Client-side error reporting.
 *
 * Sentry is initialised once per page by `sentry.client.config.js`, which only
 * runs when `PUBLIC_SENTRY_DSN` is set. This module is the one place the rest of
 * the app reaches for it, so components never have to know whether Sentry is
 * configured.
 *
 * The import is dynamic and guarded by the same env var, so a build without a
 * DSN drops the branch and keeps the SDK out of every island chunk.
 */

interface ErrorContext {
  [key: string]: unknown;
}

export function reportError(error: unknown, context?: ErrorContext) {
  if (typeof window === 'undefined') return;

  if (!import.meta.env.PUBLIC_SENTRY_DSN) return;

  // Resolves from the module cache: the page entry already loaded this chunk.
  void import('@sentry/astro')
    .then(({ captureException }) => {
      captureException(error, context ? { extra: context } : undefined);
    })
    .catch(() => {
      // Reporting must never break the page it is reporting about.
    });
}
