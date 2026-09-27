import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeScore, retrieveCandidates, tokenize } from '../_client.mjs';
import { QUALITY_DIMENSIONS, compositeQuality } from '../rubrics.mjs';
import { addQualityOutliers, buildAuditRequest, interpretAudit, labelSkew } from '../audit-catalog.mjs';
import { buildRelatedRequest, pickRelated } from '../build-related.mjs';
import { buildKeywordRequest, interpretKeyword } from '../classify-keywords.mjs';
import { buildLocalizationRequest, interpretLocalization } from '../verify-localization.mjs';
import {
  currentMembership,
  overBroadMemberships,
  proposeTags,
  rewriteTagsArray,
} from '../audience-fit.mjs';

const prompt = {
  slug: 'cold-email-writer',
  title: 'Cold Email Writer',
  promptText: 'Write a cold email to [PROSPECT] about [PRODUCT]. Keep it under 120 words.',
  description: 'Writes short cold outreach emails.',
  metaDescription: 'Generate cold emails fast.',
  tool: 'chatgpt',
  category: 'marketing',
  difficulty: 'beginner',
  tags: ['email', 'sales', 'python'],
  variables: [{ name: 'PROSPECT', description: 'Who you are emailing', example: 'a SaaS founder' }],
  isFeatured: false,
};
const categories = [
  { slug: 'marketing', description: 'Campaigns and ad copy.' },
  { slug: 'coding', description: 'Code generation.' },
];

const scoreAnswer = (value, confidence = 0.8) => ({ type: 'score', score: value, confidence, probabilities: {}, legend: {} });
const choiceAnswer = (value, confidence) => ({ type: 'choice', choice: value, confidence, probabilities: {} });
const noulAnswer = (value) => ({ type: 'noul', noul: value });

test('normalizeScore maps a level index onto 0–1 and rejects malformed answers', () => {
  assert.equal(normalizeScore(scoreAnswer(3), 4), 1);
  assert.equal(normalizeScore(scoreAnswer(1.5), 4), 0.5);
  assert.equal(normalizeScore(undefined, 4), null);
  assert.equal(normalizeScore(scoreAnswer(2), 1), null);
});

test('quality weights sum to 1 and the composite ignores missing dimensions', () => {
  const weightSum = Object.values(QUALITY_DIMENSIONS).reduce((sum, dimension) => sum + dimension.weight, 0);
  assert.ok(Math.abs(weightSum - 1) < 1e-9);
  assert.equal(compositeQuality({ clarity: 1, specificity: 1, reusability: 1, outputGuidance: 1 }), 1);
  assert.equal(compositeQuality({ clarity: 0.5 }), 0.5);
  assert.equal(compositeQuality({}), null);
});

test('retrieveCandidates ranks by weighted overlap, honours exclude, and survives stop-word-only queries', () => {
  const docs = [
    { slug: 'a', title: 'Cold Email Writer', tags: ['sales'], description: '' },
    { slug: 'b', title: 'Blog Outline', tags: [], description: 'mentions email once' },
    { slug: 'c', title: 'Best AI Prompts', tags: [], description: '' },
  ];
  assert.deepEqual(retrieveCandidates('cold email', docs).map((doc) => doc.slug), ['a', 'b']);
  assert.deepEqual(retrieveCandidates('cold email', docs, { exclude: (doc) => doc.slug === 'a' }).map((doc) => doc.slug), ['b']);
  assert.deepEqual(tokenize('best ai prompts'), []);
  assert.deepEqual(retrieveCandidates('best ai prompts', docs).map((doc) => doc.slug), ['c']);
});

test('audit request hides the current labels from the model and asks one question per tag', () => {
  const { state, questions, tags } = buildAuditRequest(prompt, categories);
  assert.equal(state.prompt.category, undefined);
  assert.equal(state.prompt.difficulty, undefined);
  assert.equal(state.prompt.tags, undefined);
  assert.deepEqual(Object.keys(questions.category.criteria), ['marketing', 'coding']);
  assert.equal(tags.length, 3);
  assert.equal(questions.tag_2.type, 'noul');
  assert.ok(questions.metaDescriptionAccurate);
});

test('audit findings respect confidence and probability thresholds', () => {
  const { tags } = buildAuditRequest(prompt, categories);
  const result = interpretAudit(prompt, {
    clarity: scoreAnswer(3),
    specificity: scoreAnswer(3),
    reusability: scoreAnswer(3),
    outputGuidance: scoreAnswer(3),
    category: choiceAnswer('coding', 0.9),
    difficulty: choiceAnswer('advanced', 0.3), // disagrees, but too unsure to report
    descriptionAccurate: noulAnswer(0.95),
    metaDescriptionAccurate: noulAnswer(0.1),
    tag_0: noulAnswer(0.9),
    tag_1: noulAnswer(0.8),
    tag_2: noulAnswer(0.05),
  }, tags);

  assert.equal(result.quality, 1);
  assert.deepEqual(result.findings.map((finding) => finding.type).sort(), [
    'category-mismatch',
    'metaDescription-inaccurate',
    'weak-tag',
  ]);
  assert.equal(result.findings.find((finding) => finding.type === 'weak-tag').tag, 'python');
});

test('difficulty needs far more confidence to relabel than category', () => {
  // Calibration: the model disagrees with 43% of catalog difficulty labels at a median
  // confidence of 0.50, so a 0.6 cutoff would bury the report in noise.
  const answers = (confidence) => ({
    category: choiceAnswer('coding', confidence),
    difficulty: choiceAnswer('advanced', confidence),
  });
  const atSeven = interpretAudit(prompt, answers(0.7), []).findings.map((f) => f.type);
  assert.deepEqual(atSeven, ['category-mismatch']);

  const atNine = interpretAudit(prompt, answers(0.9), []).findings.map((f) => f.type).sort();
  assert.deepEqual(atNine, ['category-mismatch', 'difficulty-mismatch']);
});

test('a description is only flagged once accuracy drops below the observed floor', () => {
  // Nothing in the catalog scored below 0.66, so the old 0.4 cutoff could never fire.
  const at75 = interpretAudit(prompt, { descriptionAccurate: noulAnswer(0.75) }, []);
  assert.deepEqual(at75.findings, []);
  const at65 = interpretAudit(prompt, { descriptionAccurate: noulAnswer(0.65) }, []);
  assert.deepEqual(at65.findings.map((f) => f.type), ['description-inaccurate']);
});

test('quality outliers are the weakest tenth within a promptType, not against an absolute bar', () => {
  const make = (slug, promptType, quality) => ({
    slug, promptType, quality, findings: [], dimensions: { clarity: quality, specificity: 1 },
  });
  // Every image prompt here outscores every text prompt, yet the weakest image prompt is
  // still flagged: a single global cutoff would only ever rediscover the type gap.
  const results = [
    ...Array.from({ length: 10 }, (_, i) => make(`text-${i}`, 'text', 0.90 + i / 100)),
    ...Array.from({ length: 10 }, (_, i) => make(`image-${i}`, 'image', 0.95 + i / 100)),
  ];
  addQualityOutliers(results);
  const flagged = results.filter((r) => r.findings.some((f) => f.type === 'weakest-of-type')).map((r) => r.slug);
  assert.deepEqual(flagged.sort(), ['image-0', 'text-0']);
  assert.equal(results[0].findings[0].weakestDimension, 'clarity');
});

test('quality outliers are skipped for groups too small for a percentile to mean anything', () => {
  const results = Array.from({ length: 4 }, (_, i) => ({
    slug: `code-${i}`, promptType: 'code', quality: 0.5 + i / 10, findings: [], dimensions: { clarity: 0.5 },
  }));
  addQualityOutliers(results);
  assert.deepEqual(results.flatMap((r) => r.findings), []);
});

test('labelSkew contrasts catalog labels with the model distribution', () => {
  const results = [
    { slug: 'a', answers: { difficulty: choiceAnswer('intermediate', 0.9) } },
    { slug: 'b', answers: { difficulty: choiceAnswer('intermediate', 0.9) } },
  ];
  const prompts = [{ slug: 'a', difficulty: 'advanced' }, { slug: 'b', difficulty: 'intermediate' }];
  assert.deepEqual(labelSkew(results, prompts, 'difficulty'), {
    catalog: { advanced: 1, intermediate: 1 },
    model: { intermediate: 2 },
  });
});

test('related prompts keep only candidates above the relatedness floor, best first', () => {
  const candidates = [{ slug: 'x', title: 'X', description: '', tool: 't' }, { slug: 'y', title: 'Y', description: '', tool: 't' }, { slug: 'z', title: 'Z', description: '', tool: 't' }];
  const request = buildRelatedRequest(prompt, candidates);
  assert.equal(Object.keys(request.questions).length, 3);
  assert.match(request.questions.candidate_1.instructions, /candidates\[1\]/);

  const picked = pickRelated(candidates, {
    candidate_0: scoreAnswer(1), // 0.33 — below floor
    candidate_1: scoreAnswer(3),
    candidate_2: scoreAnswer(2),
  });
  assert.deepEqual(picked.map((entry) => entry.slug), ['y', 'z']);
});

test('keyword policy: ignore irrelevant, reuse covered pages, otherwise create', () => {
  const pages = [{ slug: '/best/chatgpt-prompts', title: 'Best ChatGPT Prompts', surface: 'best-of roundup' }];
  const request = buildKeywordRequest('chatgpt prompts', pages);
  assert.equal(request.state.existingPages[0].path, '/best/chatgpt-prompts');
  const entry = { keyword: 'chatgpt prompts', demand: 100, sources: ['seed'] };
  const base = { intent: choiceAnswer('get-prompts', 0.9), surface: choiceAnswer('best-of roundup', 0.8) };

  assert.equal(interpretKeyword(entry, pages, { ...base, relevant: noulAnswer(0.1), covered_0: noulAnswer(0.9) }).action, 'ignore');
  const covered = interpretKeyword(entry, pages, { ...base, relevant: noulAnswer(0.9), covered_0: noulAnswer(0.9) });
  assert.equal(covered.action, 'optimize-existing');
  assert.equal(covered.bestExistingPage.path, '/best/chatgpt-prompts');
  assert.equal(interpretKeyword(entry, pages, { ...base, relevant: noulAnswer(0.9), covered_0: noulAnswer(0.5) }).action, 'expand-existing');
  const gap = interpretKeyword(entry, pages, { ...base, relevant: noulAnswer(0.9), covered_0: noulAnswer(0.1) });
  assert.equal(gap.action, 'create');
  assert.equal(gap.bestExistingPage, null);
  assert.equal(interpretKeyword(entry, [], { ...base, relevant: noulAnswer(0.9) }).action, 'create');
});

test('localization asks contradiction and omission only where an English source exists', () => {
  const page = { type: 'prompt', reviewStatus: 'needs-human-review', title: 'Escritor', intro: 'Texto sem fonte', promptText: 'Escreva para [PROSPECT]' };
  const { questions, fields } = buildLocalizationRequest(page, { title: 'Writer', promptText: 'Write to [PROSPECT]' });
  assert.deepEqual(fields.map((field) => field.name), ['title', 'intro', 'promptText']);
  assert.ok(questions.contradicts_0 && questions.omits_0);
  // `intro` has no English source, so it can only be judged on how it reads.
  assert.equal(questions.contradicts_1, undefined);
  assert.equal(questions.omits_1, undefined);
  assert.ok(questions.naturalness_1);

  const clean = interpretLocalization('/p/', page, fields, {
    contradicts_0: noulAnswer(0.02), omits_0: scoreAnswer(0), naturalness_0: scoreAnswer(3),
    naturalness_1: scoreAnswer(3),
    contradicts_2: noulAnswer(0.05), omits_2: scoreAnswer(0), naturalness_2: scoreAnswer(3),
  });
  assert.equal(clean.verdict, 'no-issues-found');
});

test('a deliberate condensation is a choice to confirm, not a defect to fix', () => {
  // The pilot's descriptions drop one prompt from 796 to 224 characters on purpose, so heavy
  // omission without contradiction must not read as a failure.
  const page = { type: 'prompt', reviewStatus: 'needs-human-review', description: 'Resumo curto' };
  const { fields } = buildLocalizationRequest(page, { description: 'A much longer English description.' });
  const result = interpretLocalization('/p/', page, fields, {
    contradicts_0: noulAnswer(0.05),
    omits_0: scoreAnswer(3),
    naturalness_0: scoreAnswer(3),
  });
  assert.equal(result.verdict, 'confirm-intent');
  assert.deepEqual(result.issues.map((issue) => [issue.type, issue.severity]), [['condensed', 'confirm']]);
});

test('inventing a claim the source does not make is a defect', () => {
  const page = { type: 'prompt', reviewStatus: 'needs-human-review', description: 'Funciona com ChatGPT e Claude' };
  const { fields } = buildLocalizationRequest(page, { description: 'Works with any AI tool.' });
  const result = interpretLocalization('/p/', page, fields, {
    contradicts_0: noulAnswer(0.85),
    omits_0: scoreAnswer(0),
    naturalness_0: scoreAnswer(3),
  });
  assert.equal(result.verdict, 'needs-attention');
  assert.equal(result.issues[0].type, 'contradiction');
  assert.equal(result.issues[0].severity, 'defect');
});

/* ---- audience fit ---- */

const audiencePages = [
  { slug: 'marketers', audience: 'Marketers', filterCategories: ['marketing'], filterTags: ['marketing', 'social-media'] },
  { slug: 'developers', audience: 'Developers', filterCategories: ['coding'], filterTags: ['architecture', 'api'] },
  { slug: 'teachers', audience: 'Teachers', filterCategories: ['education'], filterTags: ['curriculum'] },
];
const writingPrompt = {
  slug: 'testimonial-writer', title: 'Testimonial Writer', description: 'Writes customer testimonials.',
  promptText: 'Write a testimonial for [CUSTOMER].', category: 'writing', tags: ['testimonials'],
};

test('membership is by category OR tag, and the source is reported', () => {
  assert.deepEqual(currentMembership({ ...writingPrompt, category: 'marketing' }, audiencePages[0]),
    { member: true, byCategory: true, byTag: false });
  assert.deepEqual(currentMembership({ ...writingPrompt, tags: ['social-media'] }, audiencePages[0]),
    { member: true, byCategory: false, byTag: true });
  assert.deepEqual(currentMembership(writingPrompt, audiencePages[0]),
    { member: false, byCategory: false, byTag: false });
});

test('an inaccurate tag is refused even when it would restore a deserved page', () => {
  // The whole point: the prompt genuinely serves developers, but calling a testimonial
  // writer "architecture" would be a lie, so the page is left unreachable instead.
  const fits = [0.95, 0.9, 0.0];
  const accurate = { marketing: 0.96, architecture: 0.04, api: 0.03 };
  const result = proposeTags(writingPrompt, audiencePages, fits, accurate);
  assert.deepEqual(result.tags, ['marketing']);
  assert.deepEqual(result.restores, ['marketers']);
  assert.deepEqual(result.unreachable, ['developers']);
});

test('a marginal audience fit proposes nothing at all', () => {
  const result = proposeTags(writingPrompt, audiencePages, [0.5, 0.1, 0.1], { marketing: 0.99 });
  assert.deepEqual(result, { tags: [], restores: [], unreachable: [] });
});

test('over-broad memberships are only those held by category, not by tag', () => {
  const byCategory = { ...writingPrompt, category: 'marketing' };
  assert.deepEqual(overBroadMemberships(byCategory, audiencePages, [0.05, 0, 0]).map((e) => e.slug), ['marketers']);
  // Held by an explicit tag instead: that is a deliberate choice, not filter spillover.
  const byTag = { ...writingPrompt, tags: ['social-media'] };
  assert.deepEqual(overBroadMemberships(byTag, audiencePages, [0.05, 0, 0]), []);
});

test('tag rewriting preserves each file\'s own array formatting', () => {
  const multi = '{\n  "tags": [\n    "a",\n    "b"\n  ],\n  "x": 1\n}\n';
  assert.equal(rewriteTagsArray(multi, ['c']), '{\n  "tags": [\n    "a",\n    "b",\n    "c"\n  ],\n  "x": 1\n}\n');
  const spaced = '{"tags": ["a", "b"], "x": 1}';
  assert.equal(rewriteTagsArray(spaced, ['c']), '{"tags": ["a", "b", "c"], "x": 1}');
  const tight = '{"tags": ["a","b"], "x": 1}';
  assert.equal(rewriteTagsArray(tight, ['c']), '{"tags": ["a","b","c"], "x": 1}');
  assert.equal(rewriteTagsArray(multi, []), null);
});
