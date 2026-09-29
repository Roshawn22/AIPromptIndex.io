import path from 'node:path';

import { parseCliArgs, repoRoot, toIsoDate } from '../seo/_shared.mjs';
import {
  cachedSystemOne,
  loadJson,
  loadPrompts,
  mapLimit,
  noul,
  openCache,
  requireApiKey,
  summarizeUsage,
  typesafeOutputRoot,
  writeJsonFile,
  writeTextFile,
} from './_client.mjs';

const AUDIENCE_PATH = 'src/data/seo/audience-pages.json';
export const MEMBERSHIP_PATH = 'src/data/seo/audience-membership.json';

// Audience pages (/prompts/for/<slug>/) list the prompts judged to serve that audience. They
// used to include every prompt whose category or tags matched the page's filters, and a
// category is a coarse instrument: `business` alone swept prompts onto seven audience pages,
// so 98 of 622 placements were prompts the audience would not reach for.
//
// Membership now comes from one question per prompt and page, and a prompt is a member when
// the answer is more likely yes than no. The Noul is calibrated, so 0.5 is the natural
// boundary; 0.7 would also drop 221 relevant prompts, not just the filler.
export const AUDIENCE_THRESHOLD = 0.5;

export function buildAudienceRequest(prompt, pages) {
  return {
    state: {
      prompt: {
        title: prompt.title,
        description: prompt.description,
        promptText: prompt.promptText.slice(0, 1200),
      },
      audiences: pages.map((page) => ({ name: page.audience, slug: page.slug })),
    },
    questions: Object.fromEntries(pages.map((_, index) => [
      `audience_${index}`,
      noul(
        `Would someone in \`audiences[${index}]\` reach for \`prompt\` as part of their own work?`,
        {
          true: 'This is a tool for their job. They would expect to find it on a page of prompts collected for them.',
          false: 'It belongs to someone else\'s work, or only touches theirs incidentally. Seeing it on their page would feel like filler.',
        },
      ),
    ])),
  };
}

const round = (value) => Math.round(value * 1000) / 1000;

/**
 * Folds fresh judgments into the committed membership. Prompts judged in this run are
 * re-placed from scratch; prompts not in this run keep their current placement, so a
 * partial run (--slugs) never drops anything it did not look at. Members are ordered by fit
 * so each page can lead with the prompts its audience is most likely to want.
 */
export function mergeMembership(existing, results, pages, threshold = AUDIENCE_THRESHOLD) {
  const judgedNow = new Set(results.filter((result) => !result.error).map((result) => result.slug));
  const pagesOut = {};
  for (const page of pages) {
    const kept = Object.entries(existing?.pages?.[page.slug] ?? {}).filter(([slug]) => !judgedNow.has(slug));
    const fresh = results
      .filter((result) => judgedNow.has(result.slug))
      .map((result) => [result.slug, result.fits?.[page.slug]])
      .filter(([, fit]) => typeof fit === 'number' && fit > threshold)
      .map(([slug, fit]) => [slug, round(fit)]);
    pagesOut[page.slug] = Object.fromEntries(
      [...kept, ...fresh].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    );
  }
  return {
    threshold,
    generatedBy: 'npm run typesafe:audience -- --write-membership',
    judged: [...new Set([...(existing?.judged ?? []), ...judgedNow])].sort(),
    pages: pagesOut,
  };
}

export function membershipChanges(before, after) {
  return Object.keys(after.pages).map((slug) => {
    const was = new Set(Object.keys(before?.pages?.[slug] ?? {}));
    const now = new Set(Object.keys(after.pages[slug]));
    return {
      slug,
      size: now.size,
      added: [...now].filter((member) => !was.has(member)),
      removed: [...was].filter((member) => !now.has(member)),
    };
  });
}

async function main() {
  const args = parseCliArgs();
  const pages = loadJson(AUDIENCE_PATH, []);
  let prompts = loadPrompts();
  if (args.slugs) {
    const wanted = new Set(args.slugs.split(','));
    prompts = prompts.filter((prompt) => wanted.has(prompt.slug));
  }
  if (args.limit) prompts = prompts.slice(0, Number(args.limit));

  if (args['dry-run']) {
    console.log(JSON.stringify(buildAudienceRequest(prompts[0], pages), null, 2));
    return;
  }

  requireApiKey();
  const cache = openCache('audience-fit');
  const responses = [];
  const results = await mapLimit(prompts, Number(args.concurrency || 4), async (prompt) => {
    try {
      const response = await cachedSystemOne(cache, buildAudienceRequest(prompt, pages));
      responses.push(response);
      return {
        slug: prompt.slug,
        fits: Object.fromEntries(pages.map((page, index) => [page.slug, response.answers[`audience_${index}`]?.noul ?? null])),
      };
    } catch (error) {
      return { slug: prompt.slug, error: error.message };
    }
  });
  cache.save();

  const existing = loadJson(MEMBERSHIP_PATH, { pages: {}, judged: [] });
  const membership = mergeMembership(existing, results, pages);
  const changes = membershipChanges(existing, membership);

  const lines = [
    `# Audience membership — ${toIsoDate()}`,
    '',
    `A prompt is on an audience page when the judged fit is above ${AUDIENCE_THRESHOLD}.`,
    '',
    '| Page | Prompts | Added | Removed |',
    '| --- | --- | --- | --- |',
    ...changes.map((change) => `| ${change.slug} | ${change.size} | ${change.added.length} | ${change.removed.length} |`),
  ];
  const thin = changes.filter((change) => change.size < 3);
  if (thin.length > 0) {
    lines.push('', `**Below the 3-prompt build minimum (these pages would stop building):** ${thin.map((change) => change.slug).join(', ')}`);
  }

  const outputDir = path.join(typesafeOutputRoot, toIsoDate());
  const jsonPath = writeJsonFile(path.join(outputDir, 'audience-fit.json'), {
    generatedAt: new Date().toISOString(),
    threshold: AUDIENCE_THRESHOLD,
    usage: summarizeUsage(responses),
    results,
  });
  const reportPath = writeTextFile(path.join(outputDir, 'audience-fit.md'), lines.join('\n'));
  if (args['write-membership']) writeJsonFile(path.join(repoRoot, MEMBERSHIP_PATH), membership);

  console.log(JSON.stringify({
    ok: thin.length === 0 && results.every((result) => !result.error),
    prompts: results.length,
    failed: results.filter((result) => result.error).length,
    wroteMembership: Boolean(args['write-membership']),
    placements: changes.reduce((sum, change) => sum + change.size, 0),
    thinPages: thin.map((change) => change.slug),
    usage: summarizeUsage(responses),
    jsonPath,
    reportPath,
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
