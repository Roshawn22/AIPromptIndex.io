export type BadgeColor =
  | 'green'
  | 'teal'
  | 'orange'
  | 'yellow'
  | 'red'
  | 'purple'
  | 'blue'
  | 'neutral';

export const BADGE_COLORS: Record<BadgeColor, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  teal: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/15 text-red-400 border-red-500/20',
  purple: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  blue: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  neutral: 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
};

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  beginner: BADGE_COLORS.green,
  intermediate: BADGE_COLORS.yellow,
  advanced: BADGE_COLORS.red,
};

export const DIFFICULTY_TO_BADGE: Record<DifficultyLevel, BadgeColor> = {
  beginner: 'green',
  intermediate: 'yellow',
  advanced: 'red',
};
