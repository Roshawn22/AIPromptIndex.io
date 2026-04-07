import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { TOOL_DISPLAY_NAMES as toolDisplayNames } from '../../lib/constants';
import { BADGE_COLORS, DIFFICULTY_TO_BADGE, type BadgeColor } from '../../lib/badge-colors';
import { SELECT_CHEVRON_STYLE } from '../../lib/utils';
import LottieAccent from '../motion/LottieAccent';
import emptySearchData from '../../assets/lottie/empty-search.json';

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

export default function PromptFilter({ prompts, tools, categories }: Props) {
  const [tool, setTool] = useState(() => getInitialParam('tool', 'all'));
  const [category, setCategory] = useState(() => getInitialParam('category', 'all'));
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(
    () => (getInitialParam('difficulty', 'all') as DifficultyFilter),
  );
  const [sort, setSort] = useState<SortOption>(
    () => (getInitialParam('sort', 'featured') as SortOption),
  );
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    syncParams({ tool, category, difficulty, sort });
  }, [tool, category, difficulty, sort]);

  const hasActiveFilter = tool !== 'all' || category !== 'all' || difficulty !== 'all';

  const clearFilters = useCallback(() => {
    setTool('all');
    setCategory('all');
    setDifficulty('all');
  }, []);

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

  const motionDisabled = !!prefersReducedMotion;

  return (
    <div>
      {/* Filter bar */}
      <div
        className="mb-8 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4"
      >
        <Select
          value={tool}
          onChange={setTool}
          options={[
            { value: 'all', label: 'All Tools' },
            ...tools.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />

        <Select
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: 'All Categories' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />

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

        <Select
          value={sort}
          onChange={(v) => setSort(v as SortOption)}
          options={[
            { value: 'featured', label: 'Featured First' },
            { value: 'newest', label: 'Newest' },
            { value: 'az', label: 'A-Z' },
          ]}
        />

        <AnimatePresence>
          {hasActiveFilter && (
            <motion.button
              initial={motionDisabled ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              onClick={clearFilters}
              className="ml-auto cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              Clear filters
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Results count */}
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Showing{' '}
        <span className="font-semibold text-[var(--color-text-primary)]">{filtered.length}</span>
        {' '}of{' '}
        <span className="font-semibold text-[var(--color-text-primary)]">{prompts.length}</span>
        {' '}prompts
      </p>

      {/* Grid */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={motionDisabled ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] py-20 text-center"
          >
            <LottieAccent animationData={emptySearchData} size={64} />
            <p className="mt-4 text-lg font-semibold text-[var(--color-text-primary)]">
              No prompts match your filters
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Try broadening your search or{' '}
              <button onClick={clearFilters} className="cursor-pointer text-[var(--color-accent)] underline">
                clear all filters
              </button>
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={motionDisabled ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((prompt, index) => (
              <motion.div
                key={prompt.slug}
                initial={motionDisabled ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: motionDisabled ? 0 : Math.min(index * 0.03, 0.3) }}
                className="h-full"
              >
                <PromptCard prompt={prompt} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Sub-components */

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

function PromptCard({ prompt }: { prompt: PromptData }) {
  const truncatedDescription =
    prompt.description.length > 150
      ? prompt.description.slice(0, 150).trimEnd() + '...'
      : prompt.description;

  return (
    <a
      href={`/prompts/${prompt.slug}/`}
      className={`surface-glass-ui glass-card-grid group h-full overflow-hidden rounded-[var(--radius-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--glass-border-strong)] hover:shadow-[var(--shadow-card-hover)] ${
        prompt.isFeatured ? 'ring-1 ring-[var(--color-accent)]/20' : ''
      }`}
    >
      <div className="glass-card-meta">
        <Badge variant="teal">{toolDisplayNames[prompt.tool] || prompt.tool}</Badge>
        <Badge variant={DIFFICULTY_TO_BADGE[prompt.difficulty]}>
          {prompt.difficulty}
        </Badge>
        {prompt.isFeatured && <Badge variant="purple">Featured</Badge>}
      </div>

      <h3 className="glass-card-title line-clamp-2 text-base font-semibold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent)] font-[var(--font-display)]">
        {prompt.title}
      </h3>

      <p className="glass-card-body line-clamp-3 text-sm text-[var(--color-text-secondary)]">
        {truncatedDescription}
      </p>

      <div className="glass-card-footer">
        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {prompt.tags.slice(0, 3).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

function Badge({ variant, children }: { variant: BadgeColor; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-[var(--size-badge-height)] items-center whitespace-nowrap rounded-full border px-2.5 py-0 text-[11px] leading-none font-medium font-[var(--font-display)] transition-colors duration-200 ${BADGE_COLORS[variant]}`}
    >
      {children}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-[var(--size-pill-height)] items-center whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2.5 py-0 text-xs leading-none font-medium text-[var(--color-text-secondary)] font-[var(--font-display)]">
      {children}
    </span>
  );
}
