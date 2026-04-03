import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import toolCategoryPages from '../data/seo/tool-category-pages.json';
import audiencePages from '../data/seo/audience-pages.json';
import bestofPages from '../data/seo/bestof-pages.json';

export const GET: APIRoute = async () => {
  const [prompts, blogPosts, guides] = await Promise.all([
    getCollection('prompts'),
    getCollection('blog'),
    getCollection('guides'),
  ]);

  const promptItems = prompts.map((prompt) => ({
    name: prompt.data.title,
    description: prompt.data.description.slice(0, 150),
    url: `/prompts/${prompt.data.slug}/`,
    type: 'prompt' as const,
    category: prompt.data.category,
    tags: [...prompt.data.tags, prompt.data.tool],
  }));

  const blogItems = blogPosts
    .filter((post) => post.data.draft !== true)
    .map((post) => ({
      name: post.data.title,
      description: post.data.description.slice(0, 150),
      url: `/blog/${post.id}/`,
      type: 'blog' as const,
      tags: post.data.tags,
    }));

  const guideItems = guides
    .filter((guide) => guide.data.draft !== true)
    .map((guide) => ({
      name: guide.data.title,
      description: guide.data.description.slice(0, 150),
      url: `/guides/${guide.id}/`,
      type: 'guide' as const,
      tags: guide.data.tags,
    }));

  // Tier 1: Tool + Category pages
  const tier1Items = toolCategoryPages.map((page: any) => ({
    name: page.title,
    description: (page.metaDescription || '').slice(0, 150),
    url: `/prompts/${page.tool}/${page.category}/`,
    type: 'collection' as const,
  }));

  // Tier 2: Audience pages
  const tier2Items = audiencePages.map((page: any) => ({
    name: page.title,
    description: (page.metaDescription || '').slice(0, 150),
    url: `/prompts/for/${page.slug}/`,
    type: 'collection' as const,
  }));

  // Tier 3: Best-of pages
  const tier3Items = bestofPages.map((page: any) => ({
    name: page.title,
    description: (page.metaDescription || page.description || '').slice(0, 150),
    url: `/best/${page.slug}/`,
    type: 'collection' as const,
  }));

  const searchItems = [...promptItems, ...blogItems, ...guideItems, ...tier1Items, ...tier2Items, ...tier3Items];

  return new Response(JSON.stringify(searchItems), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
