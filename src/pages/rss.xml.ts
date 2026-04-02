import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const prompts = await getCollection('prompts');

  const sorted = prompts.sort((a, b) =>
    new Date(b.data.dateAdded).getTime() - new Date(a.data.dateAdded).getTime()
  );

  const items = sorted
    .map((prompt) => {
      const link = `https://aipromptindex.io/prompts/${prompt.data.slug}/`;
      const pubDate = new Date(prompt.data.dateAdded).toUTCString();
      const description = prompt.data.description
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      const title = prompt.data.title
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      return `    <item>
      <title>${title}</title>
      <description>${description}</description>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${prompt.data.category}</category>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AIPromptIndex — AI Prompt Library</title>
    <link>https://aipromptindex.io</link>
    <description>Curated AI prompts for ChatGPT, Claude, Midjourney, and more. Discover, copy, and use prompts for writing, coding, marketing, image generation, and beyond.</description>
    <language>en-us</language>
    <atom:link href="https://aipromptindex.io/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
