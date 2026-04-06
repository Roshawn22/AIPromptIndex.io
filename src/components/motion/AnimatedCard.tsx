import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  href?: string;
}

export default function AnimatedCard({ children, className, href }: Props) {
  const prefersReducedMotion = useReducedMotion();

  const motionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { y: -3, scale: 1.015 },
        whileTap: { scale: 0.98 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
      };

  if (href) {
    return (
      <motion.a href={href} className={className} {...motionProps}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.div className={className} {...motionProps}>
      {children}
    </motion.div>
  );
}
