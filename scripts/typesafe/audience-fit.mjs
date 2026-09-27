import path from 'node:path';

import { parseCliArgs, repoRoot, toIsoDate } from '../seo/_shared.mjs';
import { tagQuestion } from './rubrics.mjs';
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
const PROMPTS_DIR = 'src/data/prompts';

// A prompt appears on an audience page when its category or one of its tags matches that
// page's filters. Category is a coarse instrument: recategorising a prompt silently adds or
// removes it from several audience pages at once. This asks whether each membership is
// actually deserved, so tags can carry the "who is this for" signal that category cannot.
export const AUDIENCE_THRESHOLDS = {
  // Only add a tag when the fit is clear; a marginal fit is not worth widening a page for.
  belongs: 0.7,
  // A tag is a claim about the prompt, judged independently of whether it wins a page.
  tagAccurate: 0.7,
  // Below this, an existing membership is worth a look as over-broad.
  doesNotBelong: 0.3,
};

export function currentMembership(prompt, page) {
  const byCategory = (page.filterCategories || []).includes(prompt.category);
  const byTag = (page.filterTags || []).some((tag) => (prompt.tags || []).includes(tag));
  return { member: byCategory || byTag, byCategory, byTag };
}

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

/**
 * Candidate tags for the memberships the model judged deserved. Only tags that already drive
 * the target page's filter are considered, so nothing here invents site vocabulary — but a tag
 * is also a claim about the prompt, so candidates must pass `tagAccuracyRequest` before use.
 */
export function candidateTags(prompt, pages, fits, thresholds = AUDIENCE_THRESHOLDS) {
  const missing = pages.filter((page, index) => {
    const fit = fits[index];
    return typeof fit === 'number' && fit >= thresholds.belongs && !currentMembership(prompt, page).member;
  });
  const tags = new Set();
  for (const page of missing) for (const tag of page.filterTags || []) {
    if (!(prompt.tags || []).includes(tag)) tags.add(tag);
  }
  return { candidates: [...tags].sort(), wanted: missing.map((page) => page.slug) };
}

export function tagAccuracyRequest(prompt, candidates) {
  return {
    state: {
      prompt: {
        title: prompt.title,
        description: prompt.description,
        promptText: prompt.promptText.slice(0, 1200),
      },
    },
    questions: Object.fromEntries(candidates.map((tag, index) => [`tag_${index}`, tagQuestion(tag)])),
  };
}

/**
 * Picks the fewest ACCURATE tags that restore the deserved memberships. `accurate` maps a
 * candidate tag to the probability it truthfully describes the prompt; anything below
 * `thresholds.tagAccurate` is dropped even when it would restore a page, because writing a
 * false tag to win a collection slot is exactly the trade this system exists to avoid.
 */
export function proposeTags(prompt, pages, fits, accurate = null, thresholds = AUDIENCE_THRESHOLDS) {
  const missing = pages.filter((page, index) => {
    const fit = fits[index];
    return typeof fit === 'number' && fit >= thresholds.belongs && !currentMembership(prompt, page).member;
  });
  if (missing.length === 0) return { tags: [], restores: [], unreachable: [] };

  const allowed = (tag) => !accurate || (accurate[tag] ?? 0) >= thresholds.tagAccurate;
  const remaining = new Set(missing.map((page) => page.slug));
  const chosen = [];
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  // Greedy set cover over accurate tags only.
  while (remaining.size > 0) {
    const counts = new Map();
    for (const slug of remaining) {
      for (const tag of bySlug.get(slug).filterTags || []) {
        if (!allowed(tag) || (prompt.tags || []).includes(tag)) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    if (counts.size === 0) break;
    const [bestTag] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    chosen.push(bestTag);
    for (const slug of [...remaining]) {
      if ((bySlug.get(slug).filterTags || []).includes(bestTag)) remaining.delete(slug);
    }
  }
  const restored = missing.map((page) => page.slug).filter((slug) => !remaining.has(slug));
  // Pages left over deserve the prompt but no truthful tag reaches them — a gap for a human.
  return { tags: chosen, restores: restored, unreachable: [...remaining] };
}

export function overBroadMemberships(prompt, pages, fits, thresholds = AUDIENCE_THRESHOLDS) {
  return pages
    .map((page, index) => ({ page, fit: fits[index] }))
    .filter(({ page, fit }) => typeof fit === 'number'
      && fit < thresholds.doesNotBelong
      && currentMembership(prompt, page).byCategory)
    .map(({ page, fit }) => ({ slug: page.slug, fit }));
}

/**
 * Appends tags to a file's `tags` array while preserving that file's own formatting. The
 * catalog mixes single-line and multi-line arrays, so imposing one style would turn a
 * one-tag addition into a whole-array diff.
 */
export function rewriteTagsArray(raw, additions) {
  const match = raw.match(/"tags"\s*:\s*\[([\s\S]*?)\]/);
  if (!match || additions.length === 0) return null;
  const body = match[1];
  const isMultiline = body.includes('\n');
  let insertion;
  if (isMultiline) {
    // Match the indentation of the existing entries.
    const indent = (body.match(/\n(\s*)"/) || [, '    '])[1];
    const trailing = (body.match(/\n(\s*)$/) || [, ''])[1];
    const entries = additions.map((tag) => `${indent}${JSON.stringify(tag)}`).join(',\n');
    insertion = `${body.replace(/\s*$/, '')},\n${entries}\n${trailing}`;
  } else {
    const separator = body.includes(', ') ? ', ' : ',';
    insertion = `${body.replace(/\s*$/, '')}${separator}${additions.map((tag) => JSON.stringify(tag)).join(separator)}`;
  }
  return raw.slice(0, match.index) + `"tags": [${insertion}]` + raw.slice(match.index + match[0].length);
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
      const fits = pages.map((_, index) => response.answers[`audience_${index}`]?.noul ?? null);
      // Second request: the candidates depend on the first answers, so this cannot be batched.
      const { candidates } = candidateTags(prompt, pages, fits);
      let accurate = {};
      if (candidates.length > 0) {
        const tagResponse = await cachedSystemOne(cache, tagAccuracyRequest(prompt, candidates));
        responses.push(tagResponse);
        accurate = Object.fromEntries(candidates.map((tag, index) => [tag, tagResponse.answers[`tag_${index}`]?.noul ?? 0]));
      }
      const { tags, restores, unreachable } = proposeTags(prompt, pages, fits, accurate);
      return {
        slug: prompt.slug,
        category: prompt.category,
        tags: prompt.tags,
        fits: Object.fromEntries(pages.map((page, index) => [page.slug, fits[index]])),
        tagAccuracy: accurate,
        proposedTags: tags,
        restores,
        unreachable,
        overBroad: overBroadMemberships(prompt, pages, fits),
      };
    } catch (error) {
      return { slug: prompt.slug, error: error.message };
    }
  });
  cache.save();

  const withProposals = results.filter((result) => result.proposedTags?.length);
  const lines = [
    `# Audience fit — ${toIsoDate()}`,
    '',
    'Judged per prompt: would someone in this audience reach for it as part of their own work?',
    'Tags are proposed only where the fit is clear and the prompt is not already a member, and',
    'only from tags that already drive that page\'s filter.',
    '',
    '## Proposed tag additions',
    '',
  ];
  if (withProposals.length === 0) lines.push('None.', '');
  for (const result of withProposals) {
    const acc = (tag) => Math.round((result.tagAccuracy?.[tag] ?? 0) * 100);
    lines.push(`- \`${result.slug}\` + ${result.proposedTags.map((tag) => `\`${tag}\` (${acc(tag)}%)`).join(', ')} → restores ${result.restores.join(', ')}`);
  }
  const unreachable = results.filter((result) => result.unreachable?.length);
  if (unreachable.length > 0) {
    lines.push('', '## Deserved but unreachable', '',
      'The prompt fits these audiences, but no truthful tag would put it there. Widening the', 'page\'s own filters is a human call.', '');
    for (const result of unreachable) lines.push(`- \`${result.slug}\` → ${result.unreachable.join(', ')}`);
  }
  const overBroad = results.filter((result) => result.overBroad?.length);
  lines.push('', '## Memberships that look over-broad', '',
    'Present only because the category filter swept them in; the model does not think they fit.', '');
  if (overBroad.length === 0) lines.push('None.', '');
  for (const result of overBroad) {
    lines.push(`- \`${result.slug}\` on ${result.overBroad.map((entry) => `${entry.slug} (${Math.round(entry.fit * 100)}%)`).join(', ')}`);
  }

  const outputDir = path.join(typesafeOutputRoot, toIsoDate());
  const jsonPath = writeJsonFile(path.join(outputDir, 'audience-fit.json'), {
    generatedAt: new Date().toISOString(),
    thresholds: AUDIENCE_THRESHOLDS,
    usage: summarizeUsage(responses),
    results,
  });
  const reportPath = writeTextFile(path.join(outputDir, 'audience-fit.md'), lines.join('\n'));

  if (args.apply) {
    const fs = await import('node:fs');
    let changed = 0;
    for (const result of withProposals) {
      const filePath = path.join(repoRoot, PROMPTS_DIR, `${result.slug}.json`);
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const additions = result.proposedTags.filter((tag) => !parsed.tags.includes(tag));
      if (additions.length === 0) continue;
      const nextTags = [...parsed.tags, ...additions];
      const next = rewriteTagsArray(raw, additions);
      if (!next) continue;
      // Guard: only the tags array may differ, and it must parse to exactly what we intended.
      const check = JSON.parse(next);
      if (JSON.stringify(check.tags) !== JSON.stringify(nextTags)) continue;
      delete check.tags; delete parsed.tags;
      if (JSON.stringify(check) !== JSON.stringify(parsed)) continue;
      fs.writeFileSync(filePath, next);
      changed += 1;
    }
    console.log(JSON.stringify({ ok: true, applied: changed, usage: summarizeUsage(responses), jsonPath, reportPath }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    prompts: results.length,
    withProposals: withProposals.length,
    overBroad: overBroad.length,
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
