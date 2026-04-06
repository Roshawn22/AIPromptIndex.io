/**
 * AuthButtons — React island that shows Sign In button or User avatar.
 * Uses Clerk for authentication. Gracefully degrades if Clerk is not configured.
 */
import { useMemo } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
} from '@clerk/clerk-react';

function AuthButtonsInner() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)] cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Sign In
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

export default function AuthButtons() {
  const publishableKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return (import.meta as any).env?.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;
  }, []);

  if (!publishableKey) {
    // No Clerk configured — don't render auth buttons
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <AuthButtonsInner />
    </ClerkProvider>
  );
}
