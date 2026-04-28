/**
 * SaveButton -- React island for saving/favoriting prompts.
 * Uses Convex for storage and the page-level Clerk singleton for authentication.
 * Gracefully degrades if Convex or Clerk is not configured.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ConvexReactClient, ConvexProviderWithAuth, useQuery, useMutation } from 'convex/react';
import { api } from '../../lib/convexApi';

interface SaveButtonProps {
  promptSlug: string;
}

type ClerkSessionLike = {
  getToken?: (options?: {
    template?: 'convex';
    skipCache?: boolean;
  }) => Promise<string | null>;
};

type ClerkLike = {
  loaded?: boolean;
  user?: { id?: string } | null;
  session?: ClerkSessionLike | null;
  addListener?: (listener: () => void) => (() => void) | void;
  openSignIn?: () => void;
};

declare global {
  interface Window {
    Clerk?: ClerkLike;
  }
}

function getClerk(): ClerkLike | null {
  if (typeof window === 'undefined') return null;
  return window.Clerk ?? null;
}

function getClerkSnapshot() {
  const clerk = getClerk();
  return {
    isLoaded: !!clerk?.loaded,
    isSignedIn: !!clerk?.user,
  };
}

function useClerkSingleton() {
  const [snapshot, setSnapshot] = useState(getClerkSnapshot);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let detach: (() => void) | undefined;
    const syncSnapshot = () => setSnapshot(getClerkSnapshot());

    const attachListener = () => {
      if (detach) return;
      const maybeDetach = getClerk()?.addListener?.(syncSnapshot);
      if (typeof maybeDetach === 'function') {
        detach = maybeDetach;
      }
    };

    syncSnapshot();
    attachListener();

    const intervalId = window.setInterval(() => {
      syncSnapshot();
      attachListener();
      if (getClerk()?.loaded && detach) {
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
      detach?.();
    };
  }, []);

  const { isLoaded, isSignedIn } = snapshot;

  const openSignIn = useCallback(() => {
    getClerk()?.openSignIn?.();
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const getToken = getClerk()?.session?.getToken;
      if (typeof getToken !== 'function') return null;

      try {
        return (
          (await getToken({ template: 'convex', skipCache: forceRefreshToken })) ??
          (await getToken({ skipCache: forceRefreshToken }))
        );
      } catch {
        return null;
      }
    },
    []
  );

  return useMemo(
    () => ({
      isLoaded,
      isSignedIn,
      openSignIn,
      fetchAccessToken,
    }),
    [fetchAccessToken, isLoaded, isSignedIn, openSignIn]
  );
}

function useConvexAuthFromClerkSingleton() {
  const { isLoaded, isSignedIn, fetchAccessToken } = useClerkSingleton();

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn,
      fetchAccessToken,
    }),
    [fetchAccessToken, isLoaded, isSignedIn]
  );
}

/* ------------------------------------------------------------------ */
/*  Inner component (has Convex + Clerk context)                       */
/* ------------------------------------------------------------------ */

function SaveButtonInner({ promptSlug }: SaveButtonProps) {
  const { isLoaded, isSignedIn, openSignIn } = useClerkSingleton();

  const isSaved = useQuery(
    api.collections.isPromptSaved,
    isLoaded && isSignedIn ? { promptSlug } : 'skip'
  );
  const savePrompt = useMutation(api.collections.savePrompt);
  const removePrompt = useMutation(api.collections.removePrompt);

  const [showTooltip, setShowTooltip] = useState(false);

  const [isPending, setIsPending] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!isSignedIn || isPending) return;
    setIsPending(true);
    try {
      if (isSaved) {
        await removePrompt({ promptSlug });
      } else {
        await savePrompt({ promptSlug });
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 2000);
      }
    } catch (err) {
      console.error('Save toggle failed:', err);
    } finally {
      setIsPending(false);
    }
  }, [isSignedIn, isSaved, isPending, promptSlug, savePrompt, removePrompt]);

  if (!isLoaded) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] opacity-50 cursor-not-allowed"
        aria-label="Save prompt"
      >
        <HeartIcon filled={false} />
        Save
      </button>
    );
  }

  // Not signed in -- wrap in SignInButton
  if (!isSignedIn) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="relative inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)] cursor-pointer"
        aria-label="Save prompt"
      >
        <HeartIcon filled={false} />
        Save
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={`relative inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
          isSaved
            ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
            : 'border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-text-muted)] hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)]'
        }`}
        aria-label={isSaved ? 'Unsave prompt' : 'Save prompt'}
      >
        <HeartIcon filled={!!isSaved} />
        {isSaved ? 'Saved' : 'Save'}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-accent)] shadow-lg">
          Saved!
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Outer wrapper (initializes Convex + Clerk)                         */
/* ------------------------------------------------------------------ */

export default function SaveButton({ promptSlug }: SaveButtonProps) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);

  useEffect(() => {
    const url = (import.meta as any).env?.PUBLIC_CONVEX_URL as string | undefined;
    if (!url || url === 'https://your-convex-url.convex.cloud') return;

    try {
      setClient(new ConvexReactClient(url));
    } catch {
      // Not configured -- graceful degradation
    }
  }, []);

  if (!client) {
    // Fallback: static disabled button
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] opacity-50 cursor-not-allowed"
        aria-label="Save prompt"
      >
        <HeartIcon filled={false} />
        Save
      </button>
    );
  }

  return (
    <ConvexProviderWithAuth client={client} useAuth={useConvexAuthFromClerkSingleton}>
      <SaveButtonInner promptSlug={promptSlug} />
    </ConvexProviderWithAuth>
  );
}

/* ------------------------------------------------------------------ */
/*  HeartIcon                                                          */
/* ------------------------------------------------------------------ */

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      />
    </svg>
  );
}
