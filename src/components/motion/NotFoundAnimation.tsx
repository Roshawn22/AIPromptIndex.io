import { motion, useReducedMotion } from 'motion/react';
import LottieAccent from './LottieAccent';
import notFoundData from '../../assets/lottie/not-found.json';

export default function NotFoundAnimation() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col items-center"
    >
      <LottieAccent animationData={notFoundData} size={80} loop />
      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-6 text-7xl font-[var(--font-display)] font-bold text-[var(--color-accent)]"
      >
        404
      </motion.p>
    </motion.div>
  );
}
