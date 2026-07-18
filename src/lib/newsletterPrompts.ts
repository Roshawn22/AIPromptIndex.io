import { getCollection } from 'astro:content';

/**
 * Return prompt records shaped for the Indexed newsletter pipeline.
 * The underlying prompt catalog lives in Astro content files, so this
 * helper provides a stable machine-readable surface without moving the
 * catalog into Convex.
 */
export async function getNewsletterPrompts() {
  const prompts = await getCollection('prompts');

  return prompts
    .map((prompt) => ({
      slug: prompt.data.slug,
      title: prompt.data.title,
      description: prompt.data.description,
      promptText: prompt.data.promptText,
      tool: prompt.data.tool,
      category: prompt.data.category,
      tags: prompt.data.tags ?? [],
      difficulty: prompt.data.difficulty,
      promptType: prompt.data.promptType,
      variables: prompt.data.variables ?? [],
      tips: prompt.data.tips ?? [],
      exampleOutput: prompt.data.exampleOutput ?? null,
      isFeatured: prompt.data.isFeatured ?? false,
      dateAdded: prompt.data.dateAdded,
      lastUpdated: prompt.data.lastUpdated ?? null,
      metaTitle: prompt.data.metaTitle ?? null,
      metaDescription: prompt.data.metaDescription ?? null,
      url: `https://aipromptindex.io/prompts/${prompt.data.slug}/`,
    }))
    .sort((a, b) => {
      const featuredDelta = Number(b.isFeatured) - Number(a.isFeatured);
      if (featuredDelta !== 0) return featuredDelta;

      const dateA = new Date(a.lastUpdated || a.dateAdded).getTime();
      const dateB = new Date(b.lastUpdated || b.dateAdded).getTime();
      return dateB - dateA;
    });
}
