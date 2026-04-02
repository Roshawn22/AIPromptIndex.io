/**
 * Clerk auth provider for React islands in a static Astro site.
 * If PUBLISHABLE_KEY is not set, renders children without auth (graceful degradation).
 */
import { ClerkProvider as BaseClerkProvider, SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react';
import { type ReactNode, useMemo } from 'react';

interface Props {
  children: ReactNode;
}

export default function ClerkProvider({ children }: Props) {
  const publishableKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return (import.meta as any).env?.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;
  }, []);

  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <BaseClerkProvider publishableKey={publishableKey}>
      {children}
    </BaseClerkProvider>
  );
}

export { SignedIn, SignedOut, UserButton, SignInButton };
