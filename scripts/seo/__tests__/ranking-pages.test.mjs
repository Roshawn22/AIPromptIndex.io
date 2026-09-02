import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const repoUrl = new URL('../../../', import.meta.url);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(relativePath, repoUrl), 'utf8'));
}

test('near-page-one ranking pages have unique editorial sections and related links', () => {
  const bestof = readJson('src/data/seo/bestof-pages.json');
  const audiences = readJson('src/data/seo/audience-pages.json');
  const toolCategories = readJson('src/data/seo/tool-category-pages.json');

  const gemini = bestof.find((page) => page.slug === 'gemini-prompts');
  const stableDiffusion = bestof.find((page) => page.slug === 'stable-diffusion-prompts');
  const cursorBest = bestof.find((page) => page.slug === 'cursor-ai-prompts');
  const cursorCoding = toolCategories.find((page) => page.tool === 'cursor' && page.category === 'coding');
  const smallBusiness = audiences.find((page) => page.slug === 'small-business');

  const pages = [gemini, stableDiffusion, cursorBest, cursorCoding, smallBusiness];
  assert.equal(pages.every(Boolean), true);

  const sectionHeadings = [];
  for (const page of pages) {
    assert.ok(page.lastReviewed);
    assert.ok(Array.isArray(page.sections) && page.sections.length >= 3);
    assert.ok(Array.isArray(page.relatedLinks) && page.relatedLinks.length >= 3);
    assert.ok(Array.isArray(page.exampleSlugs) && page.exampleSlugs.length >= 3);
    for (const section of page.sections) {
      assert.ok(section.heading);
      assert.ok(section.body.length > 120);
      sectionHeadings.push(section.heading);
    }
  }

  assert.equal(new Set(sectionHeadings).size, sectionHeadings.length);

  const geminiHrefs = gemini.relatedLinks.map((link) => link.href);
  assert.ok(geminiHrefs.includes('/best/chatgpt-prompts/'));
  assert.ok(geminiHrefs.includes('/best/claude-prompts/'));

  const sdHrefs = stableDiffusion.relatedLinks.map((link) => link.href);
  assert.ok(sdHrefs.includes('/best/midjourney-prompts/'));

  assert.ok(cursorBest.relatedLinks.some((link) => link.href === '/prompts/cursor/coding/'));
  assert.ok(cursorCoding.relatedLinks.some((link) => link.href === '/best/cursor-ai-prompts/'));
  assert.ok(smallBusiness.relatedLinks.some((link) => link.href === '/best/business-prompts/'));
  assert.ok(smallBusiness.relatedLinks.some((link) => link.href === '/guides/chatgpt-for-business/'));
});
