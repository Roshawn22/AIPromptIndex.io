import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { getPromptsForBestOf } from '../../../src/lib/bestof.ts';

// Guards the catalog data the pages are built from. Each check here corresponds to a
// defect that shipped: a collection whose filter matched nothing, prompts whose
// placeholders were never declared as variables, and links to guides that do not exist.

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
const listSlugs = (relativeDir, extension) => fs.readdirSync(path.join(repoRoot, relativeDir))
  .filter((name) => name.endsWith(extension))
  .map((name) => name.slice(0, -extension.length));

const prompts = listSlugs('src/data/prompts', '.json').map((slug) => ({
  file: `${slug}.json`,
  data: readJson(`src/data/prompts/${slug}.json`),
}));
const tools = new Set(readJson('src/data/tools/tools.json').map((tool) => tool.slug));
const categories = new Set(readJson('src/data/categories/categories.json').map((category) => category.slug));
const guideUrls = new Set([
  ...listSlugs('src/data/guides', '.md').map((slug) => `/guides/${slug}/`),
  ...listSlugs('src/data/blog', '.md').map((slug) => `/blog/${slug}/`),
]);

// Placeholders that appear in prompt text as illustration rather than as a slot to fill.
const ILLUSTRATIVE_PLACEHOLDERS = new Set(['BRACKETS']);
const PLACEHOLDER_PATTERN = /\[([A-Z][A-Z0-9_]{2,})\]/g;
const MIN_PROMPTS_PER_COLLECTION = 3;

test('every prompt names a known tool, category and difficulty, and its slug matches its file', () => {
  for (const { file, data } of prompts) {
    assert.equal(`${data.slug}.json`, file, `${file}: slug does not match the file name`);
    assert.ok(tools.has(data.tool), `${file}: unknown tool ${data.tool}`);
    assert.ok(categories.has(data.category), `${file}: unknown category ${data.category}`);
    assert.ok(['beginner', 'intermediate', 'advanced'].includes(data.difficulty), `${file}: bad difficulty`);
  }
});

test('every placeholder in a prompt is declared as a variable, and every variable is used', () => {
  for (const { file, data } of prompts) {
    const declared = new Set((data.variables ?? []).map((variable) => variable.name));
    const used = new Set([...data.promptText.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]));
    for (const name of used) {
      if (ILLUSTRATIVE_PLACEHOLDERS.has(name)) continue;
      assert.ok(declared.has(name), `${file}: [${name}] appears in promptText but is not declared in variables`);
    }
    for (const name of declared) {
      assert.ok(used.has(name), `${file}: variable ${name} is declared but never appears in promptText`);
    }
  }
});

test('related guides point at guides or posts that exist', () => {
  for (const { file, data } of prompts) {
    if (!data.relatedGuide) continue;
    assert.ok(guideUrls.has(data.relatedGuide.url), `${file}: relatedGuide ${data.relatedGuide.url} does not exist`);
  }
});

test('every best-of collection matches enough prompts to be worth a page', () => {
  for (const page of readJson('src/data/seo/bestof-pages.json')) {
    const matched = getPromptsForBestOf(prompts, page.filter ?? {});
    assert.ok(
      matched.length >= MIN_PROMPTS_PER_COLLECTION,
      `/best/${page.slug}/ matches ${matched.length} prompt(s); needs at least ${MIN_PROMPTS_PER_COLLECTION}`,
    );
    for (const slug of page.filter?.promptSlugs ?? []) {
      assert.ok(prompts.some((prompt) => prompt.data.slug === slug), `/best/${page.slug}/ lists unknown prompt ${slug}`);
    }
  }
});

test('every tool-category page matches enough prompts to be worth a page', () => {
  for (const page of readJson('src/data/seo/tool-category-pages.json')) {
    const matched = prompts.filter((prompt) => prompt.data.tool === page.tool && prompt.data.category === page.category);
    assert.ok(
      matched.length >= MIN_PROMPTS_PER_COLLECTION,
      `/prompts/${page.tool}/${page.category}/ matches ${matched.length} prompt(s); needs at least ${MIN_PROMPTS_PER_COLLECTION}`,
    );
  }
});

test('pt-BR pilot pages translate sources that exist', () => {
  const pilot = readJson('src/data/i18n/pt-BR/pilot-pages.json');
  const roundups = new Set(readJson('src/data/seo/bestof-pages.json').map((page) => page.slug));
  for (const [sourcePath, page] of Object.entries(pilot.pages)) {
    if (page.type === 'prompt') {
      assert.ok(prompts.some((prompt) => prompt.data.slug === page.sourceSlug), `${sourcePath}: source prompt missing`);
    } else if (page.type === 'roundup') {
      assert.ok(roundups.has(page.sourceSlug), `${sourcePath}: source collection missing`);
    }
  }
});
