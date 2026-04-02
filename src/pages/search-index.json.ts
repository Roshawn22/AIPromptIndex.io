import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

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

  const searchItems = [...promptItems, ...blogItems, ...guideItems];

  return new Response(JSON.stringify(searchItems), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
