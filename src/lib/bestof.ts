export interface BestOfFilter {
  tool?: string;
  category?: string;
  tag?: string;
  sort?: string;
  promptSlugs?: string[];
}

interface PromptLike {
  data: {
    slug: string;
    tool: string;
    category: string;
    tags?: string[];
  };
}

export function promptMatchesBestOfFilter(prompt: PromptLike, filter: BestOfFilter = {}) {
  const tags = prompt.data.tags ?? [];

  if (filter.promptSlugs?.length && !filter.promptSlugs.includes(prompt.data.slug)) {
    return false;
  }

  if (filter.tool && prompt.data.tool !== filter.tool) return false;
  if (filter.category && prompt.data.category !== filter.category) return false;
  if (filter.tag && !tags.includes(filter.tag)) return false;

  if (filter.sort === 'top-rated') return true;

  return Boolean(
    filter.promptSlugs?.length ||
    filter.tool ||
    filter.category ||
    filter.tag
  );
}

export function getPromptsForBestOf<T extends PromptLike>(prompts: T[], filter: BestOfFilter = {}) {
  return prompts.filter((prompt) => promptMatchesBestOfFilter(prompt, filter));
}

export function isFeaturedBestOfFilter(filter: BestOfFilter = {}) {
  return Boolean(filter.tag || filter.promptSlugs?.length || filter.sort === 'top-rated');
}
