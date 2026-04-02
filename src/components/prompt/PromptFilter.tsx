import { useState, useMemo, useEffect, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PromptData {
  title: string;
  slug: string;
  description: string;
  tool: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  isFeatured: boolean;
  dateAdded: string;
}

interface ToolData {
  id: string;
  name: string;
  slug: string;
}

interface CategoryData {
  id: string;
  name: string;
  slug: string;
}

type SortOption = 'featured' | 'newest' | 'az';
type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

interface Props {
  prompts: PromptData[];
  tools: ToolData[];
  categories: CategoryData[];
}

/* ------------------------------------------------------------------ */
/*  Display-name maps                                                  */
/* ------------------------------------------------------------------ */

const toolDisplayNames: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  midjourney: 'Midjourney',
  'dall-e': 'DALL-E',
  'stable-diffusion': 'Stable Diffusion',
  cursor: 'Cursor',
  'github-copilot': 'GitHub Copilot',
};

const categoryDisplayNames: Record<string, string> = {
  writing: 'Writing',
  coding: 'Coding',
  marketing: 'Marketing',
  'image-generation': 'Image Generation',
  business: 'Business',
  'data-analysis': 'Data Analysis',
  education: 'Education',
  creative: 'Creative',
};

const difficultyColors: Record<string, string> = {
  beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  intermediate: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  advanced: 'bg-red-500/15 text-red-400 border-red-500/20',
};

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
    if (v && v !== 'all' && v !== 'featured') {
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

export default function PromptFilter({ prompts, tools, categories }: Props) {
  const [tool, setTool] = useState(() => getInitialParam('tool', 'all'));
  const [category, setCategory] = useState(() => getInitialParam('category', 'all'));
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(
    () => (getInitialParam('difficulty', 'all') as DifficultyFilter),
  );
  const [sort, setSort] = useState<SortOption>(
    () => (getInitialParam('sort', 'featured') as SortOption),
  );

  /* keep URL in sync */
  useEffect(() => {
    syncParams({ tool, category, difficulty, sort });
  }, [tool, category, difficulty, sort]);

  const hasActiveFilter = tool !== 'all' || category !== 'all' || difficulty !== 'all';

  const clearFilters = useCallback(() => {
    setTool('all');
    setCategory('all');
    setDifficulty('all');
  }, []);

  /* ---- filtering + sorting ---- */
  const filtered = useMemo(() => {
    let result = prompts;

    if (tool !== 'all') {
      result = result.filter((p) => p.tool === tool);
    }
    if (category !== 'all') {
      result = result.filter((p) => p.category === category);
    }
    if (difficulty !== 'all') {
      result = result.filter((p) => p.difficulty === difficulty);
    }

    switch (sort) {
      case 'featured':
        result = [...result].sort((a, b) => {
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        });
        break;
      case 'newest':
        result = [...result].sort(
          (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
        );
        break;
      case 'az':
        result = [...result].sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [prompts, tool, category, difficulty, sort]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div>
      {/* ---- Filter bar ---- */}
      <div
        className="mb-8 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4"
      >
        {/* Tool dropdown */}
        <Select
          value={tool}
          onChange={setTool}
          options={[
            { value: 'all', label: 'All Tools' },
            ...tools.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />

        {/* Category dropdown */}
        <Select
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: 'All Categories' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />

        {/* Difficulty pills */}
        <div className="flex items-center gap-1.5">
          {(['all', 'beginner', 'intermediate', 'advanced'] as DifficultyFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors duration-200 font-[var(--font-display)] ${
                difficulty === d
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {d === 'all' ? 'All Levels' : d}
            </button>
          ))}
        </div>

        {/* Sort */}
        <Select
          value={sort}
          onChange={(v) => setSort(v as SortOption)}
          options={[
            { value: 'featured', label: 'Featured First' },
            { value: 'newest', label: 'Newest' },
            { value: 'az', label: 'A-Z' },
          ]}
        />

        {/* Clear filters */}
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="ml-auto cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ---- Results count ---- */}
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Showing{' '}
        <span className="font-semibold text-[var(--color-text-primary)]">{filtered.length}</span>
        {' '}of{' '}
        <span className="font-semibold text-[var(--color-text-primary)]">{prompts.length}</span>
        {' '}prompts
      </p>

      {/* ---- Grid ---- */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] py-20 text-center">
          <p className="text-lg font-semibold text-[var(--color-text-primary)]">
            No prompts match your filters
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Try broadening your search or{' '}
            <button onClick={clearFilters} className="cursor-pointer text-[var(--color-accent)] underline">
              clear all filters
            </button>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((prompt) => (
            <PromptCard key={prompt.slug} prompt={prompt} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/* ---- Select ---- */

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
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.5rem center',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/* ---- PromptCard ---- */

function PromptCard({ prompt }: { prompt: PromptData }) {
  const truncatedDescription =
    prompt.description.length > 150
      ? prompt.description.slice(0, 150).trimEnd() + '...'
      : prompt.description;

  return (
    <a
      href={`/prompts/${prompt.slug}/`}
      className={`group block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--color-accent-muted)] ${
        prompt.isFeatured ? 'ring-1 ring-[var(--color-accent)]/20' : ''
      }`}
    >
      {/* Top badges */}
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="teal">{toolDisplayNames[prompt.tool] || prompt.tool}</Badge>
        <Badge variant={prompt.difficulty === 'beginner' ? 'green' : prompt.difficulty === 'intermediate' ? 'yellow' : 'red'}>
          {prompt.difficulty}
        </Badge>
        {prompt.isFeatured && <Badge variant="purple">Featured</Badge>}
      </div>

      {/* Title */}
      <h3 className="mb-2 line-clamp-2 text-base font-semibold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent)] font-[var(--font-display)]">
        {prompt.title}
      </h3>

      {/* Description */}
      <p className="mb-4 line-clamp-3 text-sm text-[var(--color-text-secondary)]">
        {truncatedDescription}
      </p>

      {/* Tags */}
      {prompt.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {prompt.tags.slice(0, 3).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}
    </a>
  );
}

/* ---- Badge ---- */

type BadgeVariant = 'green' | 'teal' | 'yellow' | 'red' | 'purple';

const badgeColors: Record<BadgeVariant, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  teal: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/15 text-red-400 border-red-500/20',
  purple: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
};

function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium font-[var(--font-display)] transition-colors duration-200 ${badgeColors[variant]}`}
    >
      {children}
    </span>
  );
}

/* ---- Tag ---- */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] font-[var(--font-display)]">
      {children}
    </span>
  );
}
