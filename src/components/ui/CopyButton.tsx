import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ConvexReactClient, useMutation, ConvexProvider } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import LottieAccent from '../motion/LottieAccent';
import checkmarkData from '../../assets/lottie/checkmark.json';

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'ghost';
  promptSlug?: string;
  onCopy?: () => void;
}

function CopyButtonInner({
  text,
  label = 'Copy',
  size = 'md',
  variant = 'primary',
  promptSlug,
  onCopy,
  trackEnabled,
}: CopyButtonProps & { trackEnabled: boolean }) {
  const [copied, setCopied] = useState(false);
  const track = trackEnabled ? useMutation(api.events.track) : null;
  const prefersReducedMotion = useReducedMotion();
  const motionDisabled = !!prefersReducedMotion;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopied(true);
    onCopy?.();

    if (track && promptSlug) {
      try {
        track({ type: 'copy', promptSlug });
      } catch {
        // Non-critical
      }
    }

    setTimeout(() => setCopied(false), 2000);
  }, [text, onCopy, track, promptSlug]);

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
      aria-label={copied ? 'Copied!' : `Copy ${label}`}
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
            Copied!
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

export default function CopyButton(props: CopyButtonProps) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);

  useEffect(() => {
    const url = (import.meta as any).env?.PUBLIC_CONVEX_URL as string | undefined;
    if (!url || url === 'https://your-convex-url.convex.cloud') return;
    try {
      setClient(new ConvexReactClient(url));
    } catch {
      // Convex not configured
    }
  }, []);

  if (!client) {
    return <CopyButtonInner {...props} trackEnabled={false} />;
  }

  return (
    <ConvexProvider client={client}>
      <CopyButtonInner {...props} trackEnabled={true} />
    </ConvexProvider>
  );
}
