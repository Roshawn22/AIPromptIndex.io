import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useMutation, ConvexProvider } from 'convex/react';
import { api } from '../../lib/convexApi';
import LottieAccent from '../motion/LottieAccent';
import checkmarkData from '../../assets/lottie/checkmark.json';
import { trackPromptCopy } from '../../lib/analytics';
import { copyTextToClipboard } from '../../lib/clipboard';
import { getConvexClient } from '../../lib/convex';

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'ghost';
  promptSlug?: string;
  tool?: string;
  category?: string;
  onCopy?: () => void;
}

type TrackFn = ((args: { type: string; promptSlug?: string }) => Promise<unknown>) | null;

function CopyButtonUI({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  size = 'md',
  variant = 'primary',
  promptSlug,
  tool,
  category,
  onCopy,
  track,
}: CopyButtonProps & { track: TrackFn }) {
  const [copied, setCopied] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const motionDisabled = !!prefersReducedMotion;
  // Use the visible label as the accessible name — do not prefix with "Copy "
  // (call sites already pass "Copy Prompt").
  const resolvedAriaLabel = copied ? copiedLabel : label;

  const handleCopy = useCallback(async () => {
    const didCopy = await copyTextToClipboard(text);
    if (!didCopy) return;

    setCopied(true);
    onCopy?.();

    if (track && promptSlug) {
      try {
        await track({ type: 'copy', promptSlug });
      } catch {
        // Non-critical
      }
    }

    if (promptSlug) {
      trackPromptCopy(promptSlug, tool, category);
    }

    setTimeout(() => setCopied(false), 2000);
  }, [text, onCopy, track, promptSlug, tool, category]);

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-4 py-2 text-sm gap-1.5',
    lg: 'px-5 py-2.5 text-sm gap-2',
  };

  const variantStyles = {
    primary: copied
      ? 'bg-emerald-500 text-white border-emerald-500'
      : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border-transparent',
    ghost: copied
      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] border-[var(--color-border)]',
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center font-[var(--font-display)] font-medium rounded-[var(--radius-md)] border transition-all duration-200 cursor-pointer overflow-hidden ${sizeStyles[size]} ${variantStyles[variant]}`}
      aria-label={resolvedAriaLabel}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={motionDisabled ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1"
          >
            <LottieAccent animationData={checkmarkData} size={14} />
            {copiedLabel}
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={motionDisabled ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function CopyButtonWithTracking(props: CopyButtonProps) {
  const track = useMutation(api.events.track);
  return <CopyButtonUI {...props} track={track} />;
}

export default function CopyButton(props: CopyButtonProps) {
  const [client] = useState(() => getConvexClient());

  if (!client) {
    return <CopyButtonUI {...props} track={null} />;
  }

  return (
    <ConvexProvider client={client}>
      <CopyButtonWithTracking {...props} />
    </ConvexProvider>
  );
}
