import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { audienceOverlap, pickRelatedPrompts } from '../../../src/lib/related.ts';

// The "Related Prompts" slots on /prompts/<slug>/ take judged relatedness first and fill the rest
// from prompts sharing an audience, category or tool. That fill used to run in file order, so an
// overdue-invoice email got ai-slop-detector and ai-slop-remover because both are `writing`.

const prompt = (slug, category, tool) => ({ data: { slug, category, tool } });
const slugs = (prompts) => prompts.map((p) => p.data.slug);

// Audience fits for overdue-invoice-reminders and its neighbours, as judged in PR #46.
const INVOICE_FITS = {
  freelancers: {
    'overdue-invoice-reminders': 0.95,
    'ai-slop-detector': 0.78,
    'ai-slop-remover': 0.76,
    'blog-post-outline-generator': 0.68,
    'book-chapter-outliner': 0.53,
    'client-scope-document': 0.94,
    'freelance-proposal-writer': 0.96,
    'portfolio-case-study': 0.94,
    'project-wrap-up-email': 0.96,
    'rate-increase-letter': 0.94,
    'scope-creep-response': 0.95,
  },
  'small-business': { 'overdue-invoice-reminders': 0.74, 'ai-slop-detector': 0.65, 'ai-slop-remover': 0.71, 'blog-post-outline-generator': 0.64 },
  'content-creators': { 'overdue-invoice-reminders': 0.7, 'ai-slop-detector': 0.87, 'ai-slop-remover': 0.88, 'blog-post-outline-generator': 0.93 },
};
// Alphabetical, like the content collection.
const INVOICE_CATALOG = [
  prompt('ai-slop-detector', 'writing', 'claude'),
  prompt('ai-slop-remover', 'writing', 'chatgpt'),
  prompt('blog-post-outline-generator', 'writing', 'chatgpt'),
  prompt('book-chapter-outliner', 'writing', 'claude'),
  prompt('client-scope-document', 'business', 'claude'),
  prompt('freelance-proposal-writer', 'writing', 'chatgpt'),
  prompt('overdue-invoice-reminders', 'writing', 'gemini'),
  prompt('portfolio-case-study', 'writing', 'claude'),
  prompt('project-wrap-up-email', 'writing', 'chatgpt'),
  prompt('rate-increase-letter', 'writing', 'claude'),
  prompt('scope-creep-response', 'business', 'chatgpt'),
];

test('audience overlap is the best shared page, scored by the weaker of the two fits', () => {
  assert.equal(audienceOverlap(INVOICE_FITS, 'overdue-invoice-reminders', 'project-wrap-up-email'), 0.95);
  // freelancers min(0.95, 0.78) beats content-creators min(0.7, 0.87) and small-business min(0.74, 0.65).
  assert.equal(audienceOverlap(INVOICE_FITS, 'overdue-invoice-reminders', 'ai-slop-detector'), 0.78);
  assert.equal(audienceOverlap(INVOICE_FITS, 'client-scope-document', 'blog-post-outline-generator'), 0.68);
  assert.equal(audienceOverlap(INVOICE_FITS, 'overdue-invoice-reminders', 'not-on-any-page'), 0);
});

test('overdue-invoice-reminders, with nothing judged related, is followed by freelancer prompts', () => {
  const current = INVOICE_CATALOG.find((p) => p.data.slug === 'overdue-invoice-reminders');
  const related = slugs(pickRelatedPrompts(current, INVOICE_CATALOG, [], INVOICE_FITS));

  assert.deepEqual(related, ['freelance-proposal-writer', 'project-wrap-up-email', 'scope-creep-response', 'portfolio-case-study']);
  assert.ok(related.every((slug) => INVOICE_FITS.freelancers[slug] > 0.9), related.join(', '));
  assert.ok(!related.some((slug) => slug.startsWith('ai-slop-')), related.join(', '));
});

test('judged related prompts keep their order and slots, and are never repeated by the fill', () => {
  const current = INVOICE_CATALOG.find((p) => p.data.slug === 'overdue-invoice-reminders');
  const judged = ['client-scope-document', 'missing-prompt', 'overdue-invoice-reminders', 'project-wrap-up-email'];
  const related = slugs(pickRelatedPrompts(current, INVOICE_CATALOG, judged, INVOICE_FITS));

  assert.deepEqual(related, ['client-scope-document', 'project-wrap-up-email', 'freelance-proposal-writer', 'scope-creep-response']);
});

test('prompts sharing an audience outrank ones that only share a category and tool', () => {
  const fits = { teachers: { 'grade-feedback': 0.9, 'lesson-plan': 0.8, 'quiz-builder': 0.6 } };
  const catalog = [
    prompt('essay-outline', 'education', 'chatgpt'), // same category and tool, no shared audience
    prompt('grade-feedback', 'education', 'chatgpt'),
    prompt('lesson-plan', 'education', 'claude'),
    prompt('pixel-art', 'image-generation', 'midjourney'), // shares nothing: never shown
    prompt('quiz-builder', 'writing', 'gemini'), // shares only the audience
  ];
  const related = slugs(pickRelatedPrompts(catalog[1], catalog, [], fits));

  assert.deepEqual(related, ['lesson-plan', 'quiz-builder', 'essay-outline']);
});

test('on equal audience overlap, a category and tool match breaks the tie, then catalog order', () => {
  const fits = { designers: { logo: 0.8, a: 0.8, b: 0.8, c: 0.8, d: 0.8 } };
  const catalog = [
    prompt('a', 'writing', 'claude'), // neither
    prompt('b', 'image-generation', 'dall-e'), // category only
    prompt('c', 'writing', 'midjourney'), // tool only
    prompt('d', 'image-generation', 'midjourney'), // both
    prompt('logo', 'image-generation', 'midjourney'),
  ];
  const related = slugs(pickRelatedPrompts(catalog[4], catalog, [], fits));

  assert.deepEqual(related, ['d', 'b', 'c', 'a']);
});

test('the live catalog fills zero-judged prompts from their own audience', () => {
  const repoRoot = path.resolve(import.meta.dirname, '../../..');
  const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
  const catalog = fs.readdirSync(path.join(repoRoot, 'src/data/prompts'))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ data: readJson(`src/data/prompts/${name}`) }));
  const fits = readJson('src/data/seo/audience-membership.json').pages;
  const judgedMap = readJson('src/data/seo/related-prompts.json');

  const cases = [
    ['open-house-follow-up-email', 'real-estate'],
    ['overdue-invoice-reminders', 'freelancers'], // added by PR #46
  ];
  for (const [slug, audience] of cases) {
    const current = catalog.find((p) => p.data.slug === slug);
    if (!current) continue;
    const related = slugs(pickRelatedPrompts(current, catalog, judgedMap[slug] ?? [], fits));
    assert.equal(related.length, 4, slug);
    assert.ok(related.every((other) => fits[audience][other] !== undefined), `${slug}: ${related.join(', ')}`);
    assert.ok(!related.some((other) => other.startsWith('ai-slop-')), `${slug}: ${related.join(', ')}`);
  }
});
