/**
 * Convex client singleton for use across React islands.
 * In a static Astro site, we initialize the client on the browser side only.
 */
import { ConvexReactClient } from 'convex/react';

let client: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient | null {
  if (typeof window === 'undefined') return null;

  const url = (import.meta as any).env?.PUBLIC_CONVEX_URL as string | undefined;
  if (!url) return null;

  if (!client) {
    client = new ConvexReactClient(url);
  }
  return client;
}
