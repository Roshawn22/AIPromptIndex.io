/**
 * Clerk env helpers for Astro React islands.
 * Live publishable keys only work on the production Clerk domain — skip them on localhost.
 */

export function getClerkPublishableKey(): string | undefined {
  const key = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.PUBLIC_CLERK_PUBLISHABLE_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : undefined;
}

export function isLocalDevHost(hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** True when Clerk can initialize on this origin with the configured key. */
export function isClerkSupportedOnThisOrigin(
  publishableKey: string | undefined = getClerkPublishableKey(),
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
): boolean {
  if (!publishableKey) return false;
  if (isLocalDevHost(hostname) && publishableKey.startsWith('pk_live_')) {
    return false;
  }
  return true;
}
