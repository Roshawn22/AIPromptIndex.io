import { useState, useMemo, useCallback } from 'react';
import { SELECT_CHEVRON_STYLE } from '../../lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Variable {
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
  difficulty: string;
  variables: Variable[];
}

interface ToolData {
  id: string;
  name: string;
  affiliateUrl?: string;
}

interface CategoryData {
  id: string;
  name: string;
}

interface Props {
  prompts: PromptData[];
  tools: ToolData[];
  categories: CategoryData[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function replaceVariables(
  text: string,
  variables: Variable[],
  values: Record<string, string>,
): string {
  let result = text;
  for (const v of variables) {
    const val = values[v.name] || v.example;
    result = result.replaceAll(`[${v.name}]`, val);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PromptBuilder({ prompts, tools, categories }: Props) {
  const [toolFilter, setToolFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  /* ---- Tool lookup ---- */
  const toolMap = useMemo(() => {
    const m: Record<string, ToolData> = {};
    for (const t of tools) m[t.id] = t;
    return m;
  }, [tools]);

  /* ---- Filtered prompt list ---- */
  const filteredPrompts = useMemo(() => {
    let result = prompts;
    if (toolFilter !== 'all') {
      result = result.filter((p) => p.tool === toolFilter);
    }
    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.title.toLowerCase().includes(q));
    }
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }, [prompts, toolFilter, categoryFilter, searchQuery]);

  /* ---- Selected prompt ---- */
  const selected = useMemo(
    () => (selectedSlug ? prompts.find((p) => p.slug === selectedSlug) ?? null : null),
    [prompts, selectedSlug],
  );

  /* ---- Init variable values when prompt changes ---- */
  const selectPrompt = useCallback(
    (slug: string) => {
      const prompt = prompts.find((p) => p.slug === slug);
      if (!prompt) return;
      setSelectedSlug(slug);
      const defaults: Record<string, string> = {};
      for (const v of prompt.variables) {
        defaults[v.name] = v.example;
      }
      setVariableValues(defaults);
    },
    [prompts],
  );

  const resetDefaults = useCallback(() => {
    if (!selected) return;
    const defaults: Record<string, string> = {};
    for (const v of selected.variables) {
      defaults[v.name] = v.example;
    }
    setVariableValues(defaults);
  }, [selected]);

  const handleCopy = useCallback(async () => {
    if (!selected) return;
    const text = replaceVariables(selected.promptText, selected.variables, variableValues);
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
    setTimeout(() => setCopied(false), 2000);
  }, [selected, variableValues]);

  /* ---- Preview with highlights ---- */
  const previewSegments = useMemo(() => {
    if (!selected) return [];
    const segments: { text: string; highlighted: boolean }[] = [];
    let remaining = selected.promptText;

    // Build regex to find all [VAR_NAME] placeholders
    const varNames = selected.variables.map((v) => v.name);
    if (varNames.length === 0) return [{ text: remaining, highlighted: false }];

    const pattern = new RegExp(
      `\\[(${varNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\]`,
      'g',
    );

    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = pattern.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: remaining.slice(lastIndex, match.index), highlighted: false });
      }
      const varName = match[1];
      const val = variableValues[varName] || '';
      const example = selected.variables.find((v) => v.name === varName)?.example || '';
      const isChanged = val !== example;
      segments.push({ text: val, highlighted: isChanged });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < remaining.length) {
      segments.push({ text: remaining.slice(lastIndex), highlighted: false });
    }

    return segments;
  }, [selected, variableValues]);

  const affiliateUrl = selected ? toolMap[selected.tool]?.affiliateUrl : undefined;
  const toolName = selected ? toolMap[selected.tool]?.name || selected.tool : '';

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* Section 1: Template Selection                                 */}
      {/* ============================================================ */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6">
        <div className="mb-4 flex items-center gap-2">
          <StepBadge n={1} />
          <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-text-primary)]">
            Choose a Template
          </h2>
        </div>

        {/* Filters row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select
            value={toolFilter}
            onChange={setToolFilter}
            options={[
              { value: 'all', label: 'All Tools' },
              ...tools.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        {/* Search + prompt selector */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className="h-4 w-4 text-[var(--color-text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-accent)] focus:outline-none font-[var(--font-display)]"
          />
        </div>

        {/* Prompt list */}
        <div className="mt-3 max-h-60 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          {filteredPrompts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              No prompts match your filters
            </p>
          ) : (
            filteredPrompts.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => selectPrompt(p.slug)}
                className={`flex w-full cursor-pointer items-center gap-3 border-b border-[var(--color-border)]/50 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-[var(--color-surface-1)] ${
                  selectedSlug === p.slug
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-primary)]'
                }`}
              >
                <span className="flex-1 font-[var(--font-display)] font-medium">{p.title}</span>
                <span className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                  {toolMap[p.tool]?.name || p.tool}
                </span>
                {p.variables.length > 0 && (
                  <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                    {p.variables.length} var{p.variables.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* ============================================================ */}
      {/* Section 2: Variable Editor                                    */}
      {/* ============================================================ */}
      {selected && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6">
          <div className="mb-1 flex items-center gap-2">
            <StepBadge n={2} />
            <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-text-primary)]">
              Customize Variables
            </h2>
          </div>
          <p className="mb-5 text-sm text-[var(--color-text-secondary)]">
            Editing <span className="font-semibold text-[var(--color-text-primary)]">{selected.title}</span>
          </p>

          {selected.variables.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              This prompt has no variables to customize. You can copy it directly below.
            </p>
          ) : (
            <>
              <div className="space-y-4">
                {selected.variables.map((v) => (
                  <div key={v.name}>
                    <label
                      htmlFor={`var-${v.name}`}
                      className="mb-1 block font-[var(--font-mono)] text-xs font-semibold text-[var(--color-accent)]"
                    >
                      {v.name}
                    </label>
                    <input
                      id={`var-${v.name}`}
                      type="text"
                      value={variableValues[v.name] ?? ''}
                      onChange={(e) =>
                        setVariableValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                      }
                      placeholder={v.example}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-accent)] focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{v.description}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={resetDefaults}
                className="mt-4 cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-muted)] hover:text-[var(--color-text-primary)] font-[var(--font-display)]"
              >
                Reset to defaults
              </button>
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Section 3: Live Preview + Copy                                */}
      {/* ============================================================ */}
      {selected && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <StepBadge n={3} />
            <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-text-primary)]">
              Preview &amp; Copy
            </h2>
          </div>

          {/* Preview */}
          <div className="mb-5 max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] p-4 font-[var(--font-mono)] text-sm leading-relaxed text-[var(--color-text-primary)]">
            {previewSegments.map((seg, i) =>
              seg.highlighted ? (
                <span
                  key={i}
                  className="rounded-sm bg-teal-500/20 px-0.5 text-teal-400"
                >
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border px-5 py-2.5 text-sm font-medium font-[var(--font-display)] transition-all duration-200 ${
                copied
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-transparent bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
              }`}
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy Customized Prompt
                </>
              )}
            </button>

            {affiliateUrl && (
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener sponsored"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)] font-[var(--font-display)]"
              >
                Open in {toolName}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </a>
            )}

            <a
              href={`/prompts/${selected.slug}/`}
              className="text-sm text-[var(--color-text-secondary)] underline decoration-[var(--color-border)] underline-offset-2 transition-colors hover:text-[var(--color-accent)] hover:decoration-[var(--color-accent)]"
            >
              View full prompt page
            </a>
          </div>
        </div>
      )}

      {/* Empty state when no prompt selected */}
      {!selected && (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-16 text-center">
          <svg
            className="mb-3 h-10 w-10 text-[var(--color-text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <p className="text-base font-semibold text-[var(--color-text-primary)] font-[var(--font-display)]">
            Select a prompt above to get started
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Choose a template, customize the variables, and copy your personalized prompt
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white font-[var(--font-display)]">
      {n}
    </span>
  );
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

function Select({ value, onChange, options }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 pr-8 text-xs font-medium text-[var(--color-text-primary)] font-[var(--font-display)] transition-colors hover:border-[var(--color-accent-muted)] focus:border-[var(--color-accent)] focus:outline-none"
      style={SELECT_CHEVRON_STYLE}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
