import assert from 'node:assert/strict';
import test from 'node:test';

// Convex's policy module is plain erasable TypeScript, so Node can load it directly
// (npm test passes --experimental-strip-types for Node 22 releases that still need it).
import { compositeQuality, decideModeration, shortlistSimilar } from '../../../convex/lib/moderationPolicy.ts';

const submitted = { tool: 'chatgpt', category: 'writing', difficulty: 'beginner' };
const goodQuality = { clarity: 1, specificity: 1, reusability: 1, outputGuidance: 1 };
const judgments = (overrides = {}) => ({
  spamProbability: 0.02,
  usableProbability: 0.95,
  quality: goodQuality,
  tool: { choice: 'chatgpt', confidence: 0.4 },
  category: { choice: 'writing', confidence: 0.9 },
  difficulty: { choice: 'beginner', confidence: 0.7 },
  similar: [],
  ...overrides,
});

test('a clean, high-quality submission stays pending at top priority with no relabels', () => {
  const decision = decideModeration(submitted, judgments());
  assert.equal(decision.status, 'pending');
  assert.equal(decision.priority, 98);
  assert.equal(decision.needsCarefulReview, false);
  assert.equal(decision.suggestedTool, undefined);
  assert.equal(decision.suggestedCategory, undefined);
});

test('only near-certain spam is auto-marked; likely spam goes to a human', () => {
  const certain = decideModeration(submitted, judgments({ spamProbability: 0.97 }));
  assert.equal(certain.status, 'spam');

  const likely = decideModeration(submitted, judgments({ spamProbability: 0.7 }));
  assert.equal(likely.status, 'pending');
  assert.equal(likely.needsCarefulReview, true);
  assert.ok(likely.priority < 40);
});

test('relabels need confidence; an unsure category asks for careful review but an unsure tool does not', () => {
  const confident = decideModeration(submitted, judgments({ category: { choice: 'marketing', confidence: 0.85 } }));
  assert.equal(confident.suggestedCategory, 'marketing');
  assert.match(confident.notes.join(' '), /Suggested category: "marketing" instead of "writing"/);

  const unsureCategory = decideModeration(submitted, judgments({ category: { choice: 'marketing', confidence: 0.3 } }));
  assert.equal(unsureCategory.suggestedCategory, undefined);
  assert.equal(unsureCategory.needsCarefulReview, true);

  const unsureTool = decideModeration(submitted, judgments({ tool: { choice: 'claude', confidence: 0.3 } }));
  assert.equal(unsureTool.suggestedTool, undefined);
  assert.equal(unsureTool.needsCarefulReview, false);
});

test('a near-duplicate of a catalog prompt is noted and pushed down the queue', () => {
  const decision = decideModeration(submitted, judgments({
    similar: [
      { url: '/prompts/a/', title: 'A', probability: 0.2 },
      { url: '/prompts/b/', title: 'B', probability: 0.88 },
    ],
  }));
  assert.equal(decision.similarTo.url, '/prompts/b/');
  assert.equal(decision.priority, 59);
});

test('missing judgments never throw and never auto-act', () => {
  const decision = decideModeration(submitted, {
    spamProbability: null, usableProbability: null, quality: {}, tool: null, category: null, difficulty: null, similar: [],
  });
  assert.equal(decision.status, 'pending');
  assert.equal(decision.qualityScore, null);
  assert.equal(compositeQuality({}), null);
});

test('shortlistSimilar only considers prompts and requires a meaningful overlap', () => {
  const catalog = [
    { name: 'Cold Email Writer', description: 'Outreach emails', url: '/prompts/cold-email-writer/', type: 'prompt' },
    { name: 'Email Marketing Guide', description: 'cold email tips', url: '/guides/email/', type: 'guide' },
    { name: 'SQL Query Builder', description: 'Writes SQL, can email results', url: '/prompts/sql/', type: 'prompt' },
  ];
  assert.deepEqual(
    shortlistSimilar('Cold email generator for founders', catalog).map((item) => item.url),
    ['/prompts/cold-email-writer/'],
  );
  assert.deepEqual(shortlistSimilar('ai prompts', catalog), []);
});
