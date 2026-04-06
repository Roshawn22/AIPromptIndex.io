import { useState, useEffect, useCallback } from 'react';
import { TOOL_DISPLAY_NAMES as toolDisplayNames, CATEGORY_DISPLAY_NAMES as categoryDisplayNames } from '../../lib/constants';
import { BADGE_COLORS, DIFFICULTY_COLORS } from '../../lib/badge-colors';
import { SELECT_CHEVRON_STYLE } from '../../lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VariableData {
  name: string;
  description: string;
  example: string;
}

interface PromptData {
  title: string;
  slug: string;
  promptText: string;
  tool: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  variables: VariableData[];
}

interface Props {
  prompts: PromptData[];
}

/* ------------------------------------------------------------------ */
/*  Display-name maps                                                  */
/* ------------------------------------------------------------------ */

/* toolDisplayNames, categoryDisplayNames imported from lib/constants */

/* ------------------------------------------------------------------ */
/*  URL search-param helpers                                           */
/* ------------------------------------------------------------------ */

function getInitialParam(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return new URLSearchParams(window.location.search).get(key) || fallback;
}

function syncParams(params: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v) {
      url.searchParams.set(k, v);
    } else {
      url.searchParams.delete(k);
    }
  }
  window.history.replaceState({}, '', url.toString());
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PromptCompare({ prompts }: Props) {
  const sorted = [...prompts].sort((a, b) => a.title.localeCompare(b.title));

  const [leftSlug, setLeftSlug] = useState(() => getInitialParam('left', ''));
  const [rightSlug, setRightSlug] = useState(() => getInitialParam('right', ''));
  const [copiedSide, setCopiedSide] = useState<'left' | 'right' | null>(null);

  const leftPrompt = sorted.find((p) => p.slug === leftSlug) ?? null;
  const rightPrompt = sorted.find((p) => p.slug === rightSlug) ?? null;

  useEffect(() => {
    syncParams({ left: leftSlug, right: rightSlug });
  }, [leftSlug, rightSlug]);

  const handleCopy = useCallback(async (text: string, side: 'left' | 'right') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSide(side);
      setTimeout(() => setCopiedSide(null), 2000);
    } catch {
      // clipboard not available
    }
  }, []);

  /* Helper: check if a field differs between left and right */
  const isDifferent = (field: 'tool' | 'category' | 'difficulty'): boolean => {
    if (!leftPrompt || !rightPrompt) return false;
    return leftPrompt[field] !== rightPrompt[field];
  };

  return (
    <div>
      {/* ---- Selector bar ---- */}
      <div className="mb-8 flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] font-[var(--font-display)]">
            Left Prompt
          </label>
          <select
            value={leftSlug}
            onChange={(e) => setLeftSlug(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] font-[var(--font-display)] transition-colors hover:border-[var(--color-accent-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            style={{ ...SELECT_CHEVRON_STYLE, paddingRight: '2rem' }}
          >
            <option value="">-- Select a prompt --</option>
            {sorted.map((p) => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
        </div>

        <div className="hidden sm:flex sm:items-center sm:pt-5">
          <span className="text-[var(--color-text-muted)] text-lg font-bold">vs</span>
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] font-[var(--font-display)]">
            Right Prompt
          </label>
          <select
            value={rightSlug}
            onChange={(e) => setRightSlug(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] font-[var(--font-display)] transition-colors hover:border-[var(--color-accent-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            style={{ ...SELECT_CHEVRON_STYLE, paddingRight: '2rem' }}
          >
            <option value="">-- Select a prompt --</option>
            {sorted.map((p) => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Empty state ---- */}
      {(!leftPrompt && !rightPrompt) && (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] py-20 text-center">
          <svg className="mb-4 h-12 w-12 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M9 12h6M9 16h6M13 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V11l-8-8z" />
          </svg>
          <p className="text-lg font-semibold text-[var(--color-text-primary)]">
            Select two prompts to compare
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Use the dropdowns above to pick prompts for a side-by-side comparison.
          </p>
        </div>
      )}

      {/* ---- Side-by-side grid ---- */}
      {(leftPrompt || rightPrompt) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left */}
          <PromptPanel
            prompt={leftPrompt}
            side="left"
            copiedSide={copiedSide}
            onCopy={handleCopy}
            otherPrompt={rightPrompt}
            isDifferent={isDifferent}
          />

          {/* Right */}
          <PromptPanel
            prompt={rightPrompt}
            side="right"
            copiedSide={copiedSide}
            onCopy={handleCopy}
            otherPrompt={leftPrompt}
            isDifferent={isDifferent}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PromptPanel                                                        */
/* ------------------------------------------------------------------ */

interface PromptPanelProps {
  prompt: PromptData | null;
  side: 'left' | 'right';
  copiedSide: 'left' | 'right' | null;
  onCopy: (text: string, side: 'left' | 'right') => void;
  otherPrompt: PromptData | null;
  isDifferent: (field: 'tool' | 'category' | 'difficulty') => boolean;
}

function PromptPanel({ prompt, side, copiedSide, onCopy, otherPrompt, isDifferent }: PromptPanelProps) {
  if (!prompt) {
    return (
      <div className="flex items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Select a prompt from the dropdown above
        </p>
      </div>
    );
  }

  const diffHighlight = 'ring-2 ring-amber-400/40';

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
      {/* Title */}
      <h3 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)] font-[var(--font-display)]">
        {prompt.title}
      </h3>

      {/* Badges */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium font-[var(--font-display)] ${BADGE_COLORS.teal} ${isDifferent('tool') ? diffHighlight : ''}`}>
          {toolDisplayNames[prompt.tool] || prompt.tool}
        </span>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium font-[var(--font-display)] ${BADGE_COLORS.purple} ${isDifferent('category') ? diffHighlight : ''}`}>
          {categoryDisplayNames[prompt.category] || prompt.category}
        </span>
        <DifficultyBadge difficulty={prompt.difficulty} highlight={isDifferent('difficulty')} />
      </div>

      {/* Prompt text */}
      <div className="mb-4">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] p-4 text-sm leading-relaxed text-[var(--color-text-secondary)]" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
          {prompt.promptText}
        </pre>
      </div>

      {/* Actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onCopy(prompt.promptText, side)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)] cursor-pointer"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {copiedSide === side ? 'Copied!' : 'Copy'}
        </button>

        <a
          href={`/prompts/${prompt.slug}/`}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)]"
        >
          View full prompt
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Variables */}
      {prompt.variables.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-[var(--font-display)]">
            Variables
          </h4>
          <div className="space-y-1.5">
            {prompt.variables.map((v) => (
              <div key={v.name} className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3 py-2">
                <code className="text-xs text-[var(--color-accent)]" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  [{v.name}]
                </code>
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">{v.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {prompt.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {prompt.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] font-[var(--font-display)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DifficultyBadge                                                    */
/* ------------------------------------------------------------------ */

function DifficultyBadge({ difficulty, highlight }: { difficulty: string; highlight: boolean }) {
  const colorClass = DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS] || '';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize font-[var(--font-display)] ${colorClass} ${highlight ? 'ring-2 ring-amber-400/40' : ''}`}
    >
      {difficulty}
    </span>
  );
}
