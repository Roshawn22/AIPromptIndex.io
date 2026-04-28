/**
 * SubmitForm — React island for the prompt submission form.
 * Submits to Convex backend with rate limiting via visitor fingerprint.
 * Gracefully degrades to a static message if Convex is not configured.
 */
import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react';
import { ConvexReactClient, useMutation, ConvexProvider } from 'convex/react';
import { api } from '../../lib/convexApi';
import { getVisitorId } from '../../lib/visitor';

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

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none';

const labelClass = 'block text-sm font-medium text-[var(--color-text-primary)] mb-1.5';

function SubmitFormInner() {
  const submit = useMutation(api.submissions.submit);
  const visitorId = useMemo(() => getVisitorId(), []);

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setStatus('submitting');
      setErrorMessage('');

      const form = e.currentTarget;
      const data = new FormData(form);

      try {
        await submit({
          title: data.get('title') as string,
          promptText: data.get('promptText') as string,
          tool: data.get('tool') as string,
          category: data.get('category') as string,
          difficulty: data.get('difficulty') as string,
          description: (data.get('description') as string) || undefined,
          tags: (data.get('tags') as string) || undefined,
          authorName: (data.get('authorName') as string) || undefined,
          visitorFingerprint: visitorId,
        });

        setStatus('success');
        form.reset();
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err?.message || 'Something went wrong. Please try again.');
      }
    },
    [submit, visitorId]
  );

  if (status === 'success') {
    return (
      <div className="rounded-[var(--radius-lg)] border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
          <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Prompt Submitted!</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Thanks for contributing! We review every submission and aim to publish within 48 hours.
        </p>
        <button
          type="button"
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
        <div className="rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {errorMessage}
        </div>
      )}

      <div>
        <label htmlFor="title" className={labelClass}>
          Prompt Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          placeholder="e.g., Professional Email Response Writer"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="promptText" className={labelClass}>
          Prompt Text <span className="text-red-500">*</span>
        </label>
        <textarea
          id="promptText"
          name="promptText"
          required
          rows={6}
          placeholder="Enter the full prompt text. Use [VARIABLE_NAME] for customizable parts."
          className={`${inputClass} font-[var(--font-mono)]`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="tool" className={labelClass}>
            AI Tool <span className="text-red-500">*</span>
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
            Category <span className="text-red-500">*</span>
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

      <div>
        <label className={labelClass}>
          Difficulty <span className="text-red-500">*</span>
        </label>
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
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description / How to Use
        </label>
        <textarea
          id="description"
          name="description"
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
          placeholder="Optional — for attribution"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] px-6 py-3 text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
          'Submit Prompt for Review'
        )}
      </button>

      <p className="text-center text-xs text-[var(--color-text-muted)]">
        All submissions are reviewed before publishing. We aim to review within 48 hours.
      </p>
    </form>
  );
}

export default function SubmitForm() {
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
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
        <p className="text-[var(--color-text-secondary)]">
          Submission form is being set up. Check back soon!
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
