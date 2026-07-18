import path from 'node:path';

import {
  fetchAhrefsJson,
  getSeoOutputDir,
  loadSeedKeywords,
  numberValue,
  optionalEnv,
  parseCliArgs,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const country = optionalEnv('AHREFS_COUNTRY', 'us');
const limit = Number(args.limit || 50);
const maxSeeds = Number(args['max-seeds'] || (args.limit ? 10 : 30));

function normalizeRows(response) {
  if (Array.isArray(response?.keywords)) return response.keywords;
  if (Array.isArray(response?.rows)) return response.rows;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

async function runOverview(seeds) {
  const response = await fetchAhrefsJson('keywords-explorer/overview', {
    keywords: seeds.join(','),
    country,
    select: 'keyword,volume,difficulty,cpc,clicks,serp_features,parent_topic',
  });
  return normalizeRows(response).map((row) => ({
    keyword: row.keyword || '',
    volume: numberValue(row.volume),
    difficulty: numberValue(row.difficulty),
    cpc: numberValue(row.cpc),
    clicks: numberValue(row.clicks),
    serpFeatures: Array.isArray(row.serp_features) ? row.serp_features : [],
    parentTopic: row.parent_topic || '',
  }));
}

async function runMatchingTerms(seed) {
  const response = await fetchAhrefsJson('keywords-explorer/matching-terms', {
    keywords: seed,
    country,
    limit,
    select: 'keyword,volume,difficulty,cpc,traffic_potential,parent_topic,intents',
    order_by: 'volume:desc',
  });
  return normalizeRows(response).map((row) => ({
    keyword: row.keyword || '',
    volume: numberValue(row.volume),
    difficulty: numberValue(row.difficulty),
    cpc: numberValue(row.cpc),
    trafficPotential: numberValue(row.traffic_potential),
    parentTopic: row.parent_topic || '',
    intents: Array.isArray(row.intents) ? row.intents : [],
    seed,
  }));
}

async function runRelatedTerms(seed) {
  const response = await fetchAhrefsJson('keywords-explorer/related-terms', {
    keywords: seed,
    country,
    limit,
    select: 'keyword,volume,difficulty,cpc,traffic_potential,parent_topic',
    order_by: 'volume:desc',
  });
  return normalizeRows(response).map((row) => ({
    keyword: row.keyword || '',
    volume: numberValue(row.volume),
    difficulty: numberValue(row.difficulty),
    cpc: numberValue(row.cpc),
    trafficPotential: numberValue(row.traffic_potential),
    parentTopic: row.parent_topic || '',
    seed,
  }));
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];
  const seeds = loadSeedKeywords().slice(0, maxSeeds);

  if (seeds.length === 0) {
    throw new Error('No seed keywords found. Populate scripts/config/seed-keywords.json.');
  }

  let overview = [];
  try {
    overview = await runOverview(seeds);
  } catch (error) {
    warnings.push(`overview: ${error instanceof Error ? error.message : String(error)}`);
  }

  const matching = [];
  const related = [];
  const topSeeds = seeds.slice(0, Math.min(10, seeds.length));
  for (const seed of topSeeds) {
    try {
      matching.push(...(await runMatchingTerms(seed)));
    } catch (error) {
      warnings.push(`matching-terms ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      related.push(...(await runRelatedTerms(seed)));
    } catch (error) {
      warnings.push(`related-terms ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  writeJson(path.join(outputDir, 'ahrefs-keywords-explorer.json'), {
    source: 'ahrefs-api-v3',
    endpoint: 'keywords-explorer',
    country,
    generatedAt,
    warnings,
    seeds,
    overview,
    matchingTerms: matching,
    relatedTerms: related,
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    country,
    warnings,
    rows: {
      overview: overview.length,
      matchingTerms: matching.length,
      relatedTerms: related.length,
      seeds: seeds.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
