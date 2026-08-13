/**
 * Clerk auth provider for Astro React islands.
 * Skips mounting when the key is missing or unusable on this origin
 * (e.g. pk_live_ on localhost).
 */
import { ClerkProvider as BaseClerkProvider, SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react';
import { type ReactNode, useMemo } from 'react';
import {
  getClerkPublishableKey,
  isClerkSupportedOnThisOrigin,
} from '../../lib/clerkEnv';

interface Props {
  children: ReactNode;
}

export default function ClerkProvider({ children }: Props) {
  const publishableKey = useMemo(() => getClerkPublishableKey(), []);
  const clerkSupported = useMemo(
    () => isClerkSupportedOnThisOrigin(publishableKey),
    [publishableKey],
  );

  if (!publishableKey || !clerkSupported) {
    return <>{children}</>;
  }

  return (
    <BaseClerkProvider publishableKey={publishableKey}>
      {children}
    </BaseClerkProvider>
  );
}

export { SignedIn, SignedOut, UserButton, SignInButton };
