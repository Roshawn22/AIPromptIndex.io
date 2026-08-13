/**
 * Shared Convex client for Astro React islands.
 * Builds eagerly from PUBLIC_CONVEX_URL so the first paint (SSR + hydrate)
 * can render the real UI instead of a temporary empty state.
 */
import { ConvexReactClient } from 'convex/react';

const PLACEHOLDER_URL = 'https://your-convex-url.convex.cloud';

let client: ConvexReactClient | null = null;

export function getConvexUrl(): string | null {
  const url = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env?.PUBLIC_CONVEX_URL;
  if (!url || url === PLACEHOLDER_URL) return null;
  return url;
}

export function getConvexClient(): ConvexReactClient | null {
  const url = getConvexUrl();
  if (!url) return null;

  if (!client) {
    client = new ConvexReactClient(url);
  }
  return client;
}
