/**
 * AuthButtons — React island that shows Sign In button or User avatar.
 * Uses Clerk for authentication. Gracefully degrades if Clerk is not configured
 * or live keys are used on localhost (Clerk rejects pk_live outside production domain).
 */
import { useMemo } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
} from '@clerk/clerk-react';
import {
  getClerkPublishableKey,
  isClerkSupportedOnThisOrigin,
} from '../../lib/clerkEnv';

interface AuthButtonsProps {
  signInLabel?: string;
}

function AuthButtonsInner({ signInLabel = 'Sign In' }: AuthButtonsProps) {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="surface-glass-ui inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)] cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {signInLabel}
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
            },
          }}
        />
      </SignedIn>
    </>
  );
}

export default function AuthButtons({ signInLabel = 'Sign In' }: AuthButtonsProps) {
  const publishableKey = useMemo(() => getClerkPublishableKey(), []);
  const clerkSupported = useMemo(
    () => isClerkSupportedOnThisOrigin(publishableKey),
    [publishableKey],
  );

  if (!publishableKey || !clerkSupported) {
    // No Clerk configured, or live keys on localhost — skip to avoid console errors
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <AuthButtonsInner signInLabel={signInLabel} />
    </ClerkProvider>
  );
}
