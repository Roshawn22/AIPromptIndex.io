import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// Audience pages list the prompts in src/data/seo/audience-membership.json, which is written by
// `npm run typesafe:audience -- --write-membership`. These checks keep that file consistent
// with the catalog, because every way it drifts fails silently on the live site.

const root = process.cwd();
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const membership = read('src/data/seo/audience-membership.json');
const audiencePages = read('src/data/seo/audience-pages.json');
const catalog = new Set(fs.readdirSync(path.join(root, 'src/data/prompts'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -5)));
const FIX = 'run `npm run typesafe:audience -- --write-membership`';

test('every audience page keeps at least 3 members, or the route stops building it', () => {
  // src/pages/prompts/for/[slug].astro skips pages under 3 prompts: a live URL would 404.
  for (const page of audiencePages) {
    const members = Object.keys(membership.pages[page.slug] ?? {}).filter((slug) => catalog.has(slug));
    assert.ok(members.length >= 3, `${page.slug} has ${members.length} members`);
  }
});

test('membership only names real audience pages and real prompts', () => {
  const pageSlugs = new Set(audiencePages.map((page) => page.slug));
  for (const [pageSlug, members] of Object.entries(membership.pages)) {
    assert.ok(pageSlugs.has(pageSlug), `unknown audience page ${pageSlug}`);
    for (const slug of Object.keys(members)) assert.ok(catalog.has(slug), `${pageSlug} lists missing prompt ${slug}; ${FIX}`);
  }
});

test('every prompt in the catalog has been judged for audience fit', () => {
  // Without a judgment a new prompt appears on no audience page, with no error anywhere.
  const judged = new Set(membership.judged);
  const missing = [...catalog].filter((slug) => !judged.has(slug));
  assert.deepEqual(missing, [], `unjudged prompts; ${FIX}`);
});
