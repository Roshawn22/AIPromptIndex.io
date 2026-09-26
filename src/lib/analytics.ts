type EventType =
  | 'newsletter_cta_clicked'
  | 'outbound_tool_clicked'
  | 'prompt_copied'
  | 'prompt_saved'
  | 'prompt_unsaved'
  | 'prompt_submission_succeeded'
  | 'prompt_viewed'
  | 'prompt_shared'
  | 'search_opened'
  | 'search_query'
  | 'vote_cast_succeeded';

interface EventPayload {
  [key: string]: string | number | boolean | undefined;
}

export function trackEvent(type: EventType, payload?: EventPayload) {
  try {
    if (typeof window === 'undefined') return;

    const localizedPayload = {
      site_locale: document.documentElement.lang || 'en',
      localization_pilot: window.location.pathname.startsWith('/pt-BR/'),
      ...payload,
    };

    if ('gtag' in window && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', type, localizedPayload);
      return;
    }

    if (Array.isArray((window as any).dataLayer)) {
      (window as any).dataLayer.push(['event', type, localizedPayload]);
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

export function trackPromptSave(promptSlug: string, saved: boolean) {
  trackEvent(saved ? 'prompt_saved' : 'prompt_unsaved', { prompt_slug: promptSlug });
}

export function trackShare(promptSlug: string, platform: string) {
  trackEvent('prompt_shared', { prompt_slug: promptSlug, platform });
}

export function trackNewsletterCtaClick(placement: string) {
  trackEvent('newsletter_cta_clicked', { placement });
}

export function trackPromptSubmissionSucceeded(tool: string, category: string, difficulty: string) {
  trackEvent('prompt_submission_succeeded', { tool, category, difficulty });
}

export function trackVoteCastSucceeded(
  promptSlug: string,
  voteType: 'up' | 'down',
  action: 'created' | 'changed' | 'removed'
) {
  trackEvent('vote_cast_succeeded', {
    prompt_slug: promptSlug,
    vote_type: voteType,
    action,
  });
}

export function trackOutboundToolClick(toolSlug: string, destination: string) {
  trackEvent('outbound_tool_clicked', {
    tool_slug: toolSlug,
    destination,
  });
}

export function trackSearchOpened() {
  trackEvent('search_opened');
}

export function trackSearchResults(resultsCount: number, queryLength: number) {
  trackEvent('search_query', {
    results_count: resultsCount,
    query_length: queryLength,
    has_results: resultsCount > 0,
  });
}
