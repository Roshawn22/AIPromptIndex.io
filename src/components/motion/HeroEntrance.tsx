import { motion } from 'motion/react';
import LottieAccent from './LottieAccent';
import pulseData from '../../assets/lottie/pulse.json';

interface Props {
  promptCount: number;
}

export default function HeroEntrance({ promptCount }: Props) {
  const fadeUp = (delay: number) => ({
    initial: false as const,
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.6 },
    transition: {
      duration: 0.5,
      delay,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  });

  return (
    <div className="relative mx-auto max-w-7xl px-[var(--space-page)] py-20 text-center sm:py-28">
      <div className="surface-glass-prominent relative overflow-hidden rounded-[calc(var(--radius-2xl)+4px)] px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle at 22% 18%, rgba(0,191,166,0.18), transparent 28%), radial-gradient(circle at 78% 16%, rgba(244,176,92,0.16), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.08), transparent 38%)',
          }}
        />

        {/* Badge */}
        <motion.div {...fadeUp(0)} className="surface-glass-ui relative mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <LottieAccent animationData={pulseData} size={20} loop />
          </span>
          <span className="text-xs font-[var(--font-display)] font-medium text-[var(--color-text-secondary)]">
            {promptCount}+ Curated Prompts &middot; 8 Categories &middot; 8 AI Tools
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 {...fadeUp(0.1)} className="relative mx-auto max-w-4xl">
          <span className="text-[var(--color-text-primary)]">The AI Prompt Library</span>
          <br />
          <span className="text-gradient">for Entrepreneurs</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p {...fadeUp(0.2)} className="relative mx-auto mt-6 max-w-2xl text-lg text-[var(--color-text-secondary)]">
          Discover, copy, and use curated prompts for ChatGPT, Claude, Midjourney, and more. Free and community-driven.
        </motion.p>

        {/* CTAs */}
        <motion.div {...fadeUp(0.35)} className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="/prompts/"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-7 py-3.5 text-base font-[var(--font-display)] font-medium text-white shadow-[0_0_24px_var(--color-accent-glow)] transition-all duration-200 hover:bg-[var(--color-accent-hover)]"
          >
            Browse Prompts
          </a>
          <a
            href="/submit/"
            className="surface-glass-ui inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-7 py-3.5 text-base font-[var(--font-display)] font-medium text-[var(--color-text-primary)] transition-all duration-200 hover:text-[var(--color-accent)]"
          >
            Submit a Prompt
          </a>
        </motion.div>
      </div>
    </div>
  );
}
