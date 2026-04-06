import { motion, useReducedMotion } from 'motion/react';
import AnimatedCard from './AnimatedCard';

interface Category {
  name: string;
  slug: string;
  description: string;
}

interface Props {
  categories: Category[];
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export default function CategoryGrid({ categories }: Props) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((cat) => (
          <a
            key={cat.slug}
            href={`/categories/${cat.slug}/`}
            className="surface-glass-ui group block rounded-[var(--radius-lg)] p-5 transition-all duration-300"
          >
            <CategoryCardContent cat={cat} />
          </a>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial={false}
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {categories.map((cat) => (
        <motion.div key={cat.slug} variants={itemVariants}>
          <AnimatedCard
            href={`/categories/${cat.slug}/`}
            className="surface-glass-ui group block rounded-[var(--radius-lg)] p-5 transition-all duration-300"
          >
            <CategoryCardContent cat={cat} />
          </AnimatedCard>
        </motion.div>
      ))}
    </motion.div>
  );
}

const categoryIcons: Record<string, React.ReactNode> = {
  writing: (
    <>
      <path d="M17 3l4 4-11 11H6v-4L17 3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 21h12" strokeLinecap="round" />
    </>
  ),
  coding: (
    <>
      <polyline points="8 18 2 12 8 6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 6 22 12 16 18" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="14" y1="4" x2="10" y2="20" strokeLinecap="round" />
    </>
  ),
  marketing: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12l1.5-1M21 8h2M21 16l1.5 1" strokeLinecap="round" />
    </>
  ),
  'image-generation': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  business: (
    <>
      <rect x="3" y="14" width="4" height="7" rx="0.5" strokeLinejoin="round" />
      <rect x="10" y="10" width="4" height="11" rx="0.5" strokeLinejoin="round" />
      <rect x="17" y="5" width="4" height="16" rx="0.5" strokeLinejoin="round" />
      <path d="M4 5l7-1.5L20 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  'data-analysis': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 9 9h-9V3z" fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeLinejoin="round" />
      <line x1="12" y1="12" x2="12" y2="3" />
      <line x1="12" y1="12" x2="21" y2="12" />
    </>
  ),
  education: (
    <>
      <path d="M2 6l10-3 10 3-10 3L2 6z" strokeLinejoin="round" />
      <path d="M6 8v5c0 2 2.7 4 6 4s6-2 6-4V8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="22" y1="6" x2="22" y2="15" strokeLinecap="round" />
    </>
  ),
  creative: (
    <>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

const fallbackIcon = (
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
);

function CategoryCardContent({ cat }: { cat: Category }) {
  return (
    <>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--glass-highlight)]">
        <svg className="h-5 w-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          {categoryIcons[cat.slug] || fallbackIcon}
        </svg>
      </div>
      <h3 className="font-[var(--font-display)] text-base font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
        {cat.name}
      </h3>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {cat.description}
      </p>
    </>
  );
}
