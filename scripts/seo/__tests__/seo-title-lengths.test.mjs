import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { SEO_TITLE_BUDGET, SEO_TITLE_MAX, renderedSeoTitle } from '../../localization/seo-limits.mjs';

const repoUrl = new URL('../../../', import.meta.url);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(relativePath, repoUrl), 'utf8'));
}

// BaseLayout appends " | AIPromptIndex" to every <title>, so a metaTitle only has
// SEO_TITLE_BUDGET characters. The page templates fall back to a shorter title only when
// the bare metaTitle passes 60, so a metaTitle of 45-60 characters renders long silently.
const PAGE_SETS = [
  { file: 'src/data/seo/tool-category-pages.json', path: (page) => `/prompts/${page.tool}/${page.category}/` },
  { file: 'src/data/seo/bestof-pages.json', path: (page) => `/best/${page.slug}/` },
  { file: 'src/data/seo/audience-pages.json', path: (page) => `/prompts/for/${page.slug}/` },
];

const pages = PAGE_SETS.flatMap(({ file, path }) => readJson(file).map((page) => {
  const seoTitle = page.metaTitle || page.title;
  return { path: path(page), seoTitle, rendered: renderedSeoTitle(seoTitle) };
}));

test('every SEO landing page title renders within the length limit', () => {
  const overLimit = pages
    .filter((page) => page.rendered.length > SEO_TITLE_MAX)
    .map((page) => `${page.path} renders ${page.rendered.length} characters (metaTitle budget ${SEO_TITLE_BUDGET}): ${page.rendered}`);
  assert.deepEqual(overLimit, []);
});

test('no two SEO landing pages share a title', () => {
  const pathsByTitle = new Map();
  for (const page of pages) {
    pathsByTitle.set(page.rendered, [...(pathsByTitle.get(page.rendered) || []), page.path]);
  }
  const duplicates = [...pathsByTitle]
    .filter(([, paths]) => paths.length > 1)
    .map(([title, paths]) => `${title}: ${paths.join(', ')}`);
  assert.deepEqual(duplicates, []);
});
