import fs from 'node:fs';
import path from 'node:path';

import {
  listSeoOutputDates,
  loadSeedKeywords,
  loadSiteInventory,
  normalizeText,
  parseCliArgs,
  seoOutputRoot,
  toIsoDate,
} from '../seo/_shared.mjs';
import {
  cachedSystemOne,
  choice,
  mapLimit,
  noul,
  openCache,
  requireApiKey,
  retrieveCandidates,
  summarizeUsage,
  typesafeOutputRoot,
  writeJsonFile,
  writeTextFile,
} from './_client.mjs';

export const KEYWORD_THRESHOLDS = {
  relevant: 0.4,
  covered: 0.7,
  partiallyCovered: 0.4,
};

const CANDIDATE_LIMIT = 6;

const INTENTS = {
  'get-prompts': 'Wants ready-made prompts or templates to copy and use right now.',
  'learn-technique': 'Wants to learn how to write prompts or understand a prompting concept.',
  'compare-tools': 'Wants to compare or choose between AI tools or models.',
  'find-tool': 'Wants a specific product, generator or app rather than prompt content.',
  other: 'None of the above; the search is about something else.',
};

// Keys match the surface names used across scripts/seo so the two pipelines stay comparable.
const SURFACES = {
  'prompt page': 'One specific copy-paste prompt for one narrow task.',
  'best-of roundup': 'A ranked or curated list of the best prompts for a tool or broad theme.',
  'audience page': 'A collection of prompts for a profession or kind of person, such as teachers or marketers.',
  'tool-category page': 'A collection of prompts for one AI tool within one category, such as ChatGPT marketing prompts.',
  'category hub': 'A browsable hub of every prompt in one category, such as coding or writing.',
  guide: 'A how-to tutorial that teaches a prompting technique step by step.',
  blog: 'An article offering commentary, news, comparisons or examples with explanation.',
};

function latestArtifact(fileName) {
  for (const date of listSeoOutputDates().reverse()) {
    if (date > toIsoDate()) continue; // skip fixture dirs such as 2099-01-01
    const filePath = path.join(seoOutputRoot, date, fileName);
    if (fs.existsSync(filePath)) return { date, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  }
  return null;
}

export function collectKeywords() {
  const keywords = new Map();
  const add = (keyword, source, demand = 0) => {
    const key = normalizeText(keyword);
    if (!key) return;
    const existing = keywords.get(key) || { keyword: key, sources: [], demand: 0 };
    if (!existing.sources.includes(source)) existing.sources.push(source);
    existing.demand = Math.max(existing.demand, Number(demand) || 0);
    keywords.set(key, existing);
  };

  loadSeedKeywords().forEach((keyword) => add(keyword, 'seed'));
  const gsc = latestArtifact('gsc-queries.json');
  (gsc?.data?.ranges?.last28?.rows || []).forEach((row) => add(row.key, `gsc:${gsc.date}`, row.impressions));
  const rankTracker = latestArtifact('ahrefs-rank-tracker.json');
  (rankTracker?.data?.keywordPositions || []).forEach((row) => add(row.keyword, `rank-tracker:${rankTracker.date}`, row.volume));
  const ahrefs = latestArtifact('ahrefs-keywords.json');
  (ahrefs?.data?.rows || []).forEach((row) => add(row.keyword, `ahrefs:${ahrefs.date}`, row.volume));
  const gaps = latestArtifact('keyword-gap-analysis.json');
  (gaps?.data?.gaps || gaps?.data?.opportunities || []).forEach((row) => add(row.keyword, `gap:${gaps.date}`, row.volume));

  return [...keywords.values()].sort((a, b) => b.demand - a.demand || a.keyword.localeCompare(b.keyword));
}

export function buildKeywordRequest(keyword, candidates) {
  return {
    state: {
      site: 'AIPromptIndex is a free library of copy-paste prompts and templates for AI tools such as ChatGPT, Claude, Gemini, Midjourney and Cursor.',
      searchQuery: keyword,
      existingPages: candidates.map((page) => ({ type: page.surface, title: page.title, path: page.slug })),
    },
    questions: {
      relevant: noul(
        'Could a page on `site` be a genuinely good result for someone typing `searchQuery` into a search engine?',
        {
          true: 'The searcher wants prompts, prompt templates, or help writing prompts for AI tools.',
          false: 'The searcher wants something a prompt library cannot provide, such as a login page, software download, or an unrelated topic.',
        },
      ),
      intent: choice('What does the person searching `searchQuery` want?', INTENTS),
      surface: choice('Which kind of page would best satisfy the person searching `searchQuery`?', SURFACES),
      ...Object.fromEntries(candidates.map((_, index) => [
        `covered_${index}`,
        noul(
          `Would \`existingPages[${index}]\` fully satisfy the person searching \`searchQuery\`?`,
          {
            true: 'The page is squarely about what the searcher wants; they would not need another result.',
            false: 'The page is about something else, or only touches the topic in passing.',
          },
        ),
      ])),
    },
  };
}

export function interpretKeyword(entry, candidates, answers, thresholds = KEYWORD_THRESHOLDS) {
  const coverage = candidates
    .map((page, index) => ({ path: page.slug, title: page.title, probability: answers[`covered_${index}`]?.noul ?? 0 }))
    .sort((a, b) => b.probability - a.probability);
  const best = coverage[0];
  const relevance = answers.relevant?.noul ?? 0;

  let action = 'create';
  if (relevance < thresholds.relevant) action = 'ignore';
  else if (best && best.probability >= thresholds.covered) action = 'optimize-existing';
  else if (best && best.probability >= thresholds.partiallyCovered) action = 'expand-existing';

  return {
    ...entry,
    relevance,
    intent: answers.intent?.choice ?? null,
    intentConfidence: answers.intent?.confidence ?? null,
    surface: answers.surface?.choice ?? null,
    surfaceConfidence: answers.surface?.confidence ?? null,
    action,
    bestExistingPage: best && best.probability >= thresholds.partiallyCovered ? best : null,
  };
}

function buildReport(results) {
  const section = (title, action, describe) => {
    const rows = results.filter((result) => result.action === action);
    const lines = [`## ${title} (${rows.length})`, ''];
    if (rows.length === 0) lines.push('None.', '');
    for (const row of rows) lines.push(`- **${row.keyword}**${row.demand ? ` (demand ${row.demand})` : ''} — ${describe(row)}`);
    lines.push('');
    return lines;
  };
  const percent = (value) => `${Math.round((value ?? 0) * 100)}%`;
  return [
    `# Keyword intent & content gaps — ${toIsoDate()}`,
    '',
    'Judged by TypeSafe. "Demand" is the larger of search volume and GSC impressions where available.',
    '',
    ...section('Content backlog: no page serves this yet', 'create',
      (row) => `build a ${row.surface} (${percent(row.surfaceConfidence)} confident); intent: ${row.intent}`),
    ...section('Partly covered: expand an existing page', 'expand-existing',
      (row) => `closest page ${row.bestExistingPage.path} (${percent(row.bestExistingPage.probability)} satisfied); ideal surface: ${row.surface}`),
    ...section('Already covered: optimize, do not create', 'optimize-existing',
      (row) => `${row.bestExistingPage.path} (${percent(row.bestExistingPage.probability)} satisfied)`),
    ...section('Not a fit for the site', 'ignore', (row) => `relevance ${percent(row.relevance)}; intent: ${row.intent}`),
  ].join('\n');
}

async function main() {
  const args = parseCliArgs();
  const inventory = loadSiteInventory().map((entry) => ({
    slug: entry.pathname,
    title: entry.label,
    surface: entry.surface,
    tags: entry.tokens,
  }));
  const keywords = collectKeywords().slice(0, Number(args.limit || 150));
  const candidatesFor = (keyword) => retrieveCandidates(keyword, inventory, { limit: CANDIDATE_LIMIT });

  if (args['dry-run']) {
    const first = keywords[0];
    console.log(JSON.stringify({ keywords: keywords.length, request: buildKeywordRequest(first.keyword, candidatesFor(first.keyword)) }, null, 2));
    return;
  }

  requireApiKey();
  const cache = openCache('keyword-intent');
  const responses = [];
  const results = (await mapLimit(keywords, Number(args.concurrency || 4), async (entry) => {
    const candidates = candidatesFor(entry.keyword);
    try {
      const response = await cachedSystemOne(cache, buildKeywordRequest(entry.keyword, candidates));
      responses.push(response);
      return interpretKeyword(entry, candidates, response.answers);
    } catch (error) {
      console.warn(`Skipped "${entry.keyword}": ${error.message}`);
      return null;
    }
  })).filter(Boolean);
  cache.save();

  const outputDir = path.join(typesafeOutputRoot, toIsoDate());
  const jsonPath = writeJsonFile(path.join(outputDir, 'keyword-intent.json'), {
    generatedAt: new Date().toISOString(),
    thresholds: KEYWORD_THRESHOLDS,
    usage: summarizeUsage(responses),
    results,
  });
  const reportPath = writeTextFile(path.join(outputDir, 'keyword-intent.md'), buildReport(results));
  const count = (action) => results.filter((result) => result.action === action).length;
  console.log(JSON.stringify({
    ok: true,
    keywords: results.length,
    create: count('create'),
    expandExisting: count('expand-existing'),
    optimizeExisting: count('optimize-existing'),
    ignore: count('ignore'),
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
