declare module 'lottie-web/build/player/lottie_light' {
  import type { AnimationItem, AnimationConfigWithData } from 'lottie-web';
  const lottie: {
    loadAnimation(params: AnimationConfigWithData<'svg'>): AnimationItem;
    destroy(): void;
  };
  export default lottie;
}
