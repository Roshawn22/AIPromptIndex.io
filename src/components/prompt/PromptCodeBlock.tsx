import { useState, useCallback } from 'react';

interface PromptCodeBlockProps {
  promptText: string;
  promptSlug?: string;
}

export default function PromptCodeBlock({ promptText, promptSlug }: PromptCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = promptText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Track copy event
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'prompt_copied', { prompt_slug: promptSlug });
    }
  }, [promptText, promptSlug]);

  // Highlight [VARIABLE] placeholders
  const renderHighlightedText = () => {
    const parts = promptText.split(/(\[[A-Z_\s]+\])/g);
    return parts.map((part, i) => {
      if (/^\[[A-Z_\s]+\]$/.test(part)) {
        return (
          <span key={i} className="text-[#5eead4] font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="relative group">
      <div className="prompt-block">
        {renderHighlightedText()}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-[var(--font-display)] font-medium rounded-[var(--radius-md)] border transition-all duration-200 cursor-pointer ${
          copied
            ? 'bg-emerald-500 text-white border-emerald-500'
            : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100'
        }`}
        aria-label={copied ? 'Copied!' : 'Copy prompt'}
      >
        {copied ? (
          <>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  );
}
