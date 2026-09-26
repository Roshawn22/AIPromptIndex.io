/**
 * SubmitForm — React island for the prompt submission form.
 * Submits to Convex backend with rate limiting via visitor fingerprint.
 * Gracefully degrades to a static message if Convex is not configured.
 */
import { useState, useCallback, useMemo } from 'react';
import { useMutation, ConvexProvider } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../../lib/convexApi';
import { getVisitorId } from '../../lib/visitor';
import { getConvexClient } from '../../lib/convex';
import { trackPromptSubmissionSucceeded } from '../../lib/analytics';

const TOOLS = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'midjourney', label: 'Midjourney' },
  { value: 'dall-e', label: 'DALL-E' },
  { value: 'stable-diffusion', label: 'Stable Diffusion' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'github-copilot', label: 'GitHub Copilot' },
];

const CATEGORIES = [
  { value: 'writing', label: 'Writing' },
  { value: 'coding', label: 'Coding' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'image-generation', label: 'Image Generation' },
  { value: 'business', label: 'Business' },
  { value: 'data-analysis', label: 'Data Analysis' },
  { value: 'education', label: 'Education' },
  { value: 'creative', label: 'Creative' },
];

// Mirrors SUBMISSION_LIMITS in convex/submissions.ts, which enforces the same caps server-side.
const LIMITS = { title: 120, promptText: 8000, description: 1000, tags: 200, authorName: 120 } as const;

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border-control)] bg-[var(--color-surface-0)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none';

const labelClass = 'block text-sm font-medium text-[var(--color-text-primary)] mb-1.5';

function SubmitFormInner() {
  const submit = useMutation(api.submissions.submit);
  const visitorId = useMemo(() => getVisitorId(), []);

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = useCallback(
    async (e: { preventDefault(): void; currentTarget: HTMLFormElement }) => {
      e.preventDefault();
      setStatus('submitting');
      setErrorMessage('');

      const form = e.currentTarget;
      const data = new FormData(form);
      const tool = data.get('tool') as string;
      const category = data.get('category') as string;
      const difficulty = data.get('difficulty') as string;

      // A dropped connection otherwise leaves the button on "Submitting…" for good.
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('submit-timeout')), 10_000);
      });

      try {
        await Promise.race([
          submit({
            title: data.get('title') as string,
            promptText: data.get('promptText') as string,
            tool,
            category,
            difficulty,
            description: (data.get('description') as string) || undefined,
            tags: (data.get('tags') as string) || undefined,
            authorName: (data.get('authorName') as string) || undefined,
            visitorFingerprint: visitorId,
          }),
          timeout,
        ]);

        trackPromptSubmissionSucceeded(tool, category, difficulty);
        setStatus('success');
        form.reset();
      } catch (err) {
        setStatus('error');
        // Only ConvexError carries a message written for visitors; anything else is a
        // transport or server failure whose text is redacted in production anyway.
        setErrorMessage(
          err instanceof ConvexError && typeof err.data === 'string'
            ? err.data
            : err instanceof Error && err.message === 'submit-timeout'
              ? "The server didn't answer in time. Your draft is still here; wait a moment, then try again."
              : "We couldn't save your prompt. Check your connection and try again.",
        );
      }
    },
    [submit, visitorId]
  );

  if (status === 'success') {
    return (
      <div role="status" className="rounded-[var(--radius-lg)] border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
          <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Prompt submitted</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Thanks for contributing. We review every submission within 48 hours and publish the ones that pass.
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm font-medium text-[var(--color-accent)] hover:underline cursor-pointer"
        >
          Submit another prompt
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {status === 'error' && (
        <div role="alert" className="rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      <div>
        <label htmlFor="title" className={labelClass}>
          Prompt Title <span className="text-red-700 dark:text-red-400">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          maxLength={LIMITS.title}
          placeholder="e.g., Professional Email Response Writer"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="promptText" className={labelClass}>
          Prompt Text <span className="text-red-700 dark:text-red-400">*</span>
        </label>
        <textarea
          id="promptText"
          name="promptText"
          required
          maxLength={LIMITS.promptText}
          rows={6}
          placeholder="Enter the full prompt text. Use [VARIABLE_NAME] for customizable parts."
          className={`${inputClass} font-[var(--font-mono)]`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="tool" className={labelClass}>
            AI Tool <span className="text-red-700 dark:text-red-400">*</span>
          </label>
          <select id="tool" name="tool" required className={inputClass}>
            <option value="">Select a tool</option>
            {TOOLS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category" className={labelClass}>
            Category <span className="text-red-700 dark:text-red-400">*</span>
          </label>
          <select id="category" name="category" required className={inputClass}>
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>
          Difficulty <span className="text-red-700 dark:text-red-400">*</span>
        </legend>
        <div className="flex gap-4">
          {['beginner', 'intermediate', 'advanced'].map((d) => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="difficulty"
                value={d}
                required
                className="accent-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--color-text-secondary)] capitalize">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description / How to Use
        </label>
        <textarea
          id="description"
          name="description"
          maxLength={LIMITS.description}
          rows={3}
          placeholder="Describe what this prompt does and any tips for using it"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="tags" className={labelClass}>
          Tags
        </label>
        <input
          type="text"
          id="tags"
          name="tags"
          maxLength={LIMITS.tags}
          placeholder="e.g., email, copywriting, b2b (comma-separated)"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="authorName" className={labelClass}>
          Your Name
        </label>
        <input
          type="text"
          id="authorName"
          name="authorName"
          autoComplete="name"
          maxLength={LIMITS.authorName}
          placeholder="Optional — for attribution"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] bg-[var(--color-accent-fill)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-fill-hover)] px-6 py-3 text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting...
          </>
        ) : (
          'Submit for review'
        )}
      </button>

      <p className="text-center text-xs text-[var(--color-text-muted)]">
        We review every submission within 48 hours and publish the ones that pass.
      </p>
    </form>
  );
}

export default function SubmitForm() {
  const [client] = useState(() => getConvexClient());

  if (!client) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
        <p className="text-[var(--color-text-secondary)]">
          Submissions are paused right now. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <ConvexProvider client={client}>
      <SubmitFormInner />
    </ConvexProvider>
  );
}
