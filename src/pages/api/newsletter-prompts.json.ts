import type { APIRoute } from 'astro';

import { getNewsletterPrompts } from '../../lib/newsletterPrompts';

export const GET: APIRoute = async () => {
  const prompts = await getNewsletterPrompts();

  return new Response(JSON.stringify(prompts), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
};
