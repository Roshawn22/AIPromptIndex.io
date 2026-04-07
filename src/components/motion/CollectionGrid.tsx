import { motion, useReducedMotion } from 'motion/react';
import AnimatedCard from './AnimatedCard';

interface Collection {
  title: string;
  description: string;
  href: string;
}

interface Props {
  collections: Collection[];
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

export default function CollectionGrid({ collections }: Props) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <a
            key={c.href}
            href={c.href}
            className="surface-glass-ui glass-card-grid glass-card-grid-roomy group h-full overflow-hidden rounded-[var(--radius-card)] transition-all duration-300"
          >
            <CollectionCardContent collection={c} />
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
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {collections.map((c) => (
        <motion.div key={c.href} variants={itemVariants} className="h-full">
          <AnimatedCard
            href={c.href}
            className="surface-glass-ui glass-card-grid glass-card-grid-roomy group h-full overflow-hidden rounded-[var(--radius-card)] transition-all duration-300"
          >
            <CollectionCardContent collection={c} />
          </AnimatedCard>
        </motion.div>
      ))}
    </motion.div>
  );
}

function CollectionCardContent({ collection }: { collection: Collection }) {
  return (
    <>
      <h3 className="glass-card-title line-clamp-2 font-[var(--font-display)] text-base font-semibold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent)]">
        {collection.title}
      </h3>
      <p className="glass-card-body line-clamp-3 text-sm text-[var(--color-text-secondary)]">
        {collection.description}
      </p>
      <div className="glass-card-footer">
        <span className="glass-pill-compact text-[var(--color-accent)]">
          Browse collection &rarr;
        </span>
      </div>
    </>
  );
}
