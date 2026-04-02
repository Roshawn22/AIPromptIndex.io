/**
 * VoteButtons — React island for upvote/downvote on prompt pages.
 * Uses Convex for real-time vote counts and visitor fingerprint for dedup.
 * Gracefully degrades if Convex is not configured.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ConvexReactClient, useQuery, useMutation, ConvexProvider } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getVisitorId } from '../../lib/visitor';

interface VoteButtonsProps {
  promptSlug: string;
}

function VoteButtonsInner({ promptSlug }: VoteButtonsProps) {
  const visitorId = useMemo(() => getVisitorId(), []);

  const voteCounts = useQuery(api.votes.getVoteCounts, { promptSlug });
  const userVote = useQuery(api.votes.getUserVote, { promptSlug, visitorId });
  const castVote = useMutation(api.votes.castVote);

  const handleVote = useCallback(
    async (voteType: 'up' | 'down') => {
      try {
        await castVote({ promptSlug, visitorId, voteType });
      } catch (err) {
        console.error('Vote failed:', err);
      }
    },
    [castVote, promptSlug, visitorId]
  );

  const total = voteCounts?.total ?? 0;

  return (
    <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-1">
      <button
        type="button"
        onClick={() => handleVote('up')}
        className={`inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
          userVote === 'up'
            ? 'text-[var(--color-accent)] bg-[var(--color-accent-glow)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)]'
        }`}
        aria-label="Upvote"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <span className="min-w-[2ch] text-center text-sm font-[var(--font-display)] font-semibold text-[var(--color-text-primary)]">
        {total}
      </span>

      <button
        type="button"
        onClick={() => handleVote('down')}
        className={`inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
          userVote === 'down'
            ? 'text-red-500 bg-red-500/10'
            : 'text-[var(--color-text-muted)] hover:text-red-500 hover:bg-[var(--color-surface-2)]'
        }`}
        aria-label="Downvote"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

export default function VoteButtons({ promptSlug }: VoteButtonsProps) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);

  useEffect(() => {
    const url = (import.meta as any).env?.PUBLIC_CONVEX_URL as string | undefined;
    if (!url || url === 'https://your-convex-url.convex.cloud') return;
    try {
      setClient(new ConvexReactClient(url));
    } catch {
      // Convex not configured — graceful degradation
    }
  }, []);

  if (!client) {
    // Fallback: static vote display (no Convex)
    return (
      <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-1 opacity-50">
        <span className="inline-flex items-center justify-center p-2 text-[var(--color-text-muted)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M5 15l7-7 7 7" />
          </svg>
        </span>
        <span className="min-w-[2ch] text-center text-sm font-[var(--font-display)] font-semibold text-[var(--color-text-muted)]">0</span>
        <span className="inline-flex items-center justify-center p-2 text-[var(--color-text-muted)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
    );
  }

  return (
    <ConvexProvider client={client}>
      <VoteButtonsInner promptSlug={promptSlug} />
    </ConvexProvider>
  );
}
