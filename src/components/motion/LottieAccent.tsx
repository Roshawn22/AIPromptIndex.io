import { useRef, useEffect } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';
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

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop,
      autoplay: true,
      animationData,
    });

    return () => anim.destroy();
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
