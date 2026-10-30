/**
 * Rules for browser Sentry events, kept out of sentry.client.config.js so they
 * can be tested without the SDK.
 */
import type { ErrorEvent } from '@sentry/astro';

// Clerk appends this to the message, and to a `_timeout` variant of it.
const CLERK_LOAD_FAILURE_CODE = 'failed_to_load_clerk_js';

/**
 * A blocked clerk.browser.js reaches Sentry as an unhandled rejection, because
 * Clerk rethrows it from a promise nothing awaits. One visitor's extension or
 * network is not ours to act on, so it stays visible as a warning: Sentry rates
 * that medium priority, which does not email, and bumps it if the volume
 * escalates, which is how a real Clerk outage still gets through.
 *
 * The fixed fingerprint holds these in one issue. Default grouping uses minified
 * names that change between builds, so each deploy could open and email a new one.
 */
export function classifyClerkLoadFailure(event: ErrorEvent): ErrorEvent {
  const isClerkLoadFailure = event.exception?.values?.some((exception) =>
    exception.value?.includes(CLERK_LOAD_FAILURE_CODE),
  );

  if (isClerkLoadFailure) {
    event.level = 'warning';
    event.fingerprint = ['clerk-js-load-failed'];
  }

  return event;
}
