/**
 * The "Related Prompts" slots on each prompt page.
 *
 * Judged relatedness (src/data/seo/related-prompts.json, from scripts/typesafe/build-related.mjs)
 * fills the slots first, but it keeps only candidates judged at least 0.5 related, so many prompts
 * get fewer than four and some get none. The remaining slots go to prompts that share an audience
 * page, a category or a tool, ranked by how strongly they share an audience. Filling them in file
 * order instead put ai-slop-detector under an overdue-invoice email because both are `writing`.
 *
 * Kept free of JSON imports so scripts/seo/__tests__/related-prompts.test.mjs can load it in Node.
 */

/** Audience page slug -> prompt slug -> judged fit, as in audience-membership.json. */
export type AudienceFits = Record<string, Record<string, number>>;

interface PromptLike {
  data: {
    slug: string;
    category: string;
    tool: string;
  };
}

/**
 * How strongly two prompts share an audience: over the audience pages both belong to, the best
 * fit the weaker of the two has there. 0 when they share no page.
 */
export function audienceOverlap(fits: AudienceFits, a: string, b: string): number {
  let best = 0;
  for (const members of Object.values(fits)) {
    const fitA = members[a];
    const fitB = members[b];
    if (fitA !== undefined && fitB !== undefined) best = Math.max(best, Math.min(fitA, fitB));
  }
  return best;
}

/**
 * Judged related prompts in their judged order, then prompts ranked by audience overlap, with a
 * category and tool match breaking ties and the slug after that, so every build picks the same
 * prompts whatever order the collection loads in. Prompts that share no audience come after every
 * prompt that does, and prompts that share nothing are left out.
 */
export function pickRelatedPrompts<T extends PromptLike>(
  current: PromptLike,
  catalog: T[],
  judgedSlugs: string[],
  fits: AudienceFits,
  limit = 4,
): T[] {
  const bySlug = new Map(catalog.map((prompt) => [prompt.data.slug, prompt]));
  const judged = judgedSlugs
    .filter((slug) => slug !== current.data.slug)
    .map((slug) => bySlug.get(slug))
    .filter((prompt): prompt is T => prompt !== undefined);

  const taken = new Set([current.data.slug, ...judgedSlugs]);
  const fill = catalog
    .filter((prompt) => !taken.has(prompt.data.slug))
    .map((prompt) => ({
      prompt,
      overlap: audienceOverlap(fits, current.data.slug, prompt.data.slug),
      match: Number(prompt.data.category === current.data.category) + Number(prompt.data.tool === current.data.tool),
    }))
    .filter(({ overlap, match }) => overlap > 0 || match > 0)
    .sort((a, b) => b.overlap - a.overlap || b.match - a.match || compareSlugs(a.prompt.data.slug, b.prompt.data.slug));

  return [...judged, ...fill.map(({ prompt }) => prompt)].slice(0, limit);
}

// Code-point order rather than localeCompare, which depends on the ICU data Node was built with.
function compareSlugs(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
