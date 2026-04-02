/**
 * Shared display name maps and constants.
 * Single source of truth — import from here instead of duplicating.
 */

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  midjourney: 'Midjourney',
  'dall-e': 'DALL-E',
  'stable-diffusion': 'Stable Diffusion',
  cursor: 'Cursor',
  'github-copilot': 'GitHub Copilot',
};

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  writing: 'Writing',
  coding: 'Coding',
  marketing: 'Marketing',
  'image-generation': 'Image Generation',
  business: 'Business',
  'data-analysis': 'Data Analysis',
  education: 'Education',
  creative: 'Creative',
};

export const DIFFICULTY_COLORS = {
  beginner: 'green' as const,
  intermediate: 'yellow' as const,
  advanced: 'red' as const,
};
