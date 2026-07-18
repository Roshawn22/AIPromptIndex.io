type EventType = 'prompt_copied' | 'prompt_viewed' | 'prompt_shared' | 'search_opened' | 'search_query';

interface EventPayload {
  [key: string]: string | number | boolean | undefined;
}

export function trackEvent(type: EventType, payload?: EventPayload) {
  try {
    if (typeof window === 'undefined') return;

    if ('gtag' in window && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', type, payload);
      return;
    }

    if (Array.isArray((window as any).dataLayer)) {
      (window as any).dataLayer.push(['event', type, payload]);
    }
  } catch {
    // Silently fail — analytics should never break the app
  }
}

export function trackPromptCopy(promptSlug: string, tool?: string, category?: string) {
  trackEvent('prompt_copied', { prompt_slug: promptSlug, tool, category });
}

export function trackPromptView(promptSlug: string, tool?: string, category?: string) {
  trackEvent('prompt_viewed', { prompt_slug: promptSlug, tool, category });
}

export function trackShare(promptSlug: string, platform: string) {
  trackEvent('prompt_shared', { prompt_slug: promptSlug, platform });
}
