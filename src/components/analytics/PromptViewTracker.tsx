import { useEffect } from 'react';
import { trackPromptView } from '../../lib/analytics';

interface PromptViewTrackerProps {
  promptSlug: string;
  tool?: string;
  category?: string;
}

export default function PromptViewTracker({ promptSlug, tool, category }: PromptViewTrackerProps) {
  useEffect(() => {
    if (typeof window === 'undefined' || !promptSlug) return;

    const storageKey = `prompt_viewed:${window.location.pathname}:${promptSlug}`;
    if (window.sessionStorage.getItem(storageKey) === '1') return;

    trackPromptView(promptSlug, tool || 'unknown', category || 'unknown');
    window.sessionStorage.setItem(storageKey, '1');
  }, [promptSlug, tool, category]);

  return null;
}
