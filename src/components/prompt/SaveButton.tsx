/**
 * SaveButton -- React island for saving/favoriting prompts.
 * Uses Convex for storage and the page-level Clerk singleton for authentication.
 * Gracefully degrades if Convex or Clerk is not configured.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ConvexProviderWithAuth, useQuery, useMutation } from 'convex/react';
import { api } from '../../lib/convexApi';
import { isClerkSupportedOnThisOrigin } from '../../lib/clerkEnv';
import { getConvexClient } from '../../lib/convex';
import { trackPromptSave } from '../../lib/analytics';

interface SaveButtonProps {
  promptSlug: string;
  locale?: 'en' | 'pt-BR';
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
  const clerkSupported = useMemo(() => isClerkSupportedOnThisOrigin(), []);
  const [snapshot, setSnapshot] = useState(() =>
    clerkSupported ? getClerkSnapshot() : { isLoaded: true, isSignedIn: false },
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Live Clerk keys fail on localhost — stop polling and treat as signed-out.
    if (!clerkSupported) {
      setSnapshot({ isLoaded: true, isSignedIn: false });
      return;
    }

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
  }, [clerkSupported]);

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
      clerkSupported,
      openSignIn,
      fetchAccessToken,
    }),
    [clerkSupported, fetchAccessToken, isLoaded, isSignedIn, openSignIn]
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

function SaveButtonInner({ promptSlug, locale = 'en' }: SaveButtonProps) {
  const { isLoaded, isSignedIn, clerkSupported, openSignIn } = useClerkSingleton();
  const labels = locale === 'pt-BR'
    ? { save: 'Salvar', saved: 'Salvo', unsaveAria: 'Remover prompt dos salvos', unavailable: 'Salvar prompt indisponível no ambiente local' }
    : { save: 'Save', saved: 'Saved', unsaveAria: 'Unsave prompt', unavailable: 'Save prompt unavailable in local development' };

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
        trackPromptSave(promptSlug, false);
      } else {
        await savePrompt({ promptSlug });
        trackPromptSave(promptSlug, true);
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
        aria-label={labels.save}
      >
        <HeartIcon filled={false} />
        {labels.save}
      </button>
    );
  }

  // Clerk live keys are unusable on localhost — keep Save visible but inert.
  if (!clerkSupported) {
    return (
      <button
        type="button"
        disabled
        title="Sign in requires a Clerk test key for local development"
        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] opacity-50 cursor-not-allowed"
        aria-label={labels.unavailable}
      >
        <HeartIcon filled={false} />
        {labels.save}
      </button>
    );
  }

  // Not signed in -- open Clerk sign-in
  if (!isSignedIn) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="relative inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)] cursor-pointer"
        aria-label={labels.save}
      >
        <HeartIcon filled={false} />
        {labels.save}
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
        aria-label={isSaved ? labels.unsaveAria : labels.save}
      >
        <HeartIcon filled={!!isSaved} />
        {isSaved ? labels.saved : labels.save}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-accent)] shadow-lg">
          {labels.saved}!
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Outer wrapper (initializes Convex + Clerk)                         */
/* ------------------------------------------------------------------ */

export default function SaveButton({ promptSlug, locale = 'en' }: SaveButtonProps) {
  const [client] = useState(() => getConvexClient());
  const saveLabel = locale === 'pt-BR' ? 'Salvar' : 'Save';

  if (!client) {
    // Fallback: static disabled button
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] opacity-50 cursor-not-allowed"
        aria-label={saveLabel}
      >
        <HeartIcon filled={false} />
        {saveLabel}
      </button>
    );
  }

  return (
    <ConvexProviderWithAuth client={client} useAuth={useConvexAuthFromClerkSingleton}>
      <SaveButtonInner promptSlug={promptSlug} locale={locale} />
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
