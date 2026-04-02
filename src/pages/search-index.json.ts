import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const prompts = await getCollection('prompts');

  const searchItems = prompts.map((prompt) => ({
    name: prompt.data.title,
    description: prompt.data.description.slice(0, 150),
    url: `/prompts/${prompt.data.slug}/`,
    type: 'prompt',
    category: prompt.data.category,
    tags: [...prompt.data.tags, prompt.data.tool],
  }));

  return new Response(JSON.stringify(searchItems), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
