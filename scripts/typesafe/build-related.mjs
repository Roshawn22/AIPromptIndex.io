import path from 'node:path';

import { parseCliArgs, repoRoot } from '../seo/_shared.mjs';
import {
  cachedSystemOne,
  loadJson,
  loadPrompts,
  mapLimit,
  normalizeScore,
  openCache,
  requireApiKey,
  retrieveCandidates,
  score,
  summarizeUsage,
  writeJsonFile,
} from './_client.mjs';

const RELATED_PATH = 'src/data/seo/related-prompts.json';
const CANDIDATE_LIMIT = 12;
const RELATED_LIMIT = 4;
const MIN_RELATEDNESS = 0.5;

const RELATEDNESS_LEVELS = [
  'Unrelated: someone using the source prompt would have no reason to want this candidate.',
  'Same broad subject area, but it serves a different job and would not help with the same piece of work.',
  'A useful companion: it helps with an adjacent step of the same kind of work.',
  'A natural next step: someone who just used the source prompt would very likely want this candidate for the same piece of work.',
];

const describe = (prompt) => ({ title: prompt.title, description: prompt.description, tool: prompt.tool });

export function buildRelatedRequest(prompt, candidates) {
  return {
    state: {
      sourcePrompt: { ...describe(prompt), promptText: prompt.promptText.slice(0, 1500) },
      candidates: candidates.map(describe),
    },
    questions: Object.fromEntries(candidates.map((_, index) => [
      `candidate_${index}`,
      score(
        `How useful would \`candidates[${index}]\` be to someone who just used \`sourcePrompt\`?`,
        RELATEDNESS_LEVELS,
      ),
    ])),
  };
}

export function pickRelated(candidates, answers, { limit = RELATED_LIMIT, minimum = MIN_RELATEDNESS } = {}) {
  return candidates
    .map((candidate, index) => ({
      slug: candidate.slug,
      relatedness: normalizeScore(answers[`candidate_${index}`], RELATEDNESS_LEVELS.length),
    }))
    .filter((entry) => typeof entry.relatedness === 'number' && entry.relatedness >= minimum)
    .sort((a, b) => b.relatedness - a.relatedness || a.slug.localeCompare(b.slug))
    .slice(0, limit);
}

async function main() {
  const args = parseCliArgs();
  const allPrompts = loadPrompts();
  let prompts = allPrompts;
  if (args.slug) prompts = prompts.filter((prompt) => prompt.slug === args.slug);
  if (args.limit) prompts = prompts.slice(0, Number(args.limit));

  const candidatesFor = (prompt) => retrieveCandidates(
    `${prompt.title} ${(prompt.tags || []).join(' ')} ${prompt.category} ${prompt.description}`,
    allPrompts,
    { limit: CANDIDATE_LIMIT, exclude: (doc) => doc.slug === prompt.slug },
  );

  if (args['dry-run']) {
    console.log(JSON.stringify(buildRelatedRequest(prompts[0], candidatesFor(prompts[0])), null, 2));
    return;
  }

  requireApiKey();
  const cache = openCache('related-prompts');
  const responses = [];
  // Start from the committed map so a partial run (--slug/--limit) never drops other entries.
  const related = loadJson(RELATED_PATH, {}) || {};
  let failed = 0;

  await mapLimit(prompts, Number(args.concurrency || 4), async (prompt) => {
    const candidates = candidatesFor(prompt);
    if (candidates.length === 0) return;
    try {
      const response = await cachedSystemOne(cache, buildRelatedRequest(prompt, candidates));
      responses.push(response);
      related[prompt.slug] = pickRelated(candidates, response.answers).map((entry) => entry.slug);
    } catch (error) {
      failed += 1;
      console.warn(`Skipped ${prompt.slug}: ${error.message}`);
    }
  });
  cache.save();

  // Drop slugs that no longer exist so the page never links to a removed prompt.
  const liveSlugs = new Set(allPrompts.map((prompt) => prompt.slug));
  const cleaned = Object.fromEntries(
    Object.entries(related)
      .filter(([slug]) => liveSlugs.has(slug))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slug, slugs]) => [slug, slugs.filter((entry) => liveSlugs.has(entry))]),
  );
  const filePath = writeJsonFile(path.join(repoRoot, RELATED_PATH), cleaned);
  console.log(JSON.stringify({
    ok: failed === 0,
    prompts: prompts.length,
    failed,
    usage: summarizeUsage(responses),
    filePath,
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
