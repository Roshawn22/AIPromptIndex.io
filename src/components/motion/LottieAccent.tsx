import { useRef, useEffect } from 'react';
import type { AnimationItem } from 'lottie-web';
import { useReducedMotion } from 'motion/react';

interface Props {
  animationData: object;
  size?: number;
  loop?: boolean;
  className?: string;
}

export default function LottieAccent({ animationData, size = 24, loop = false, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;

    let anim: AnimationItem | null = null;
    let cancelled = false;

    void import('lottie-web/build/player/lottie_light')
      .then(({ default: lottie }) => {
        if (cancelled || !containerRef.current) return;

        anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop,
          autoplay: true,
          animationData,
        });
      })
      .catch(() => {
        // Decorative accent only; fail silently.
      });

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [animationData, loop, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      className={className}
      aria-hidden="true"
    />
  );
}
