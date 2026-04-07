/**
 * Anonymous ConvexProvider wrapper for React islands.
 * Wraps children with ConvexReactClient context for unauthenticated features only.
 * Authenticated Clerk-backed Convex calls should use ConvexProviderWithClerk instead.
 * If PUBLIC_CONVEX_URL is not set, renders children without Convex (graceful degradation).
 */
import { ConvexProvider as BaseConvexProvider } from 'convex/react';
import { type ReactNode, useMemo } from 'react';
import { ConvexReactClient } from 'convex/react';

interface Props {
  children: ReactNode;
}

export default function ConvexProvider({ children }: Props) {
  const client = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const url = (import.meta as any).env?.PUBLIC_CONVEX_URL as string | undefined;
    if (!url || url === 'https://your-convex-url.convex.cloud') return null;
    try {
      return new ConvexReactClient(url);
    } catch {
      return null;
    }
  }, []);

  if (!client) {
    return <>{children}</>;
  }

  return <BaseConvexProvider client={client}>{children}</BaseConvexProvider>;
}
