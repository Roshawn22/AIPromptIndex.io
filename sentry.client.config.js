import * as Sentry from '@sentry/astro';

// The DSN only exists in deployed environments. When it is unset — local dev, or
// any build before the env var is configured — Vite folds this branch away and
// the SDK never reaches the bundle at all.
const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Preview deploys can set this to keep their noise out of production issues.
    environment: import.meta.env.PUBLIC_SENTRY_ENVIRONMENT || 'production',
    // Errors only. Tracing and replay are stripped from the bundle in
    // astro.config.mjs; this keeps the runtime side consistent with that.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
