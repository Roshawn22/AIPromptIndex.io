import fs from 'node:fs';
import path from 'node:path';

import {
  fetchDataForSeoLive,
  getDataForSeoAuthHeader,
  getSeoOutputDir,
  numberValue,
  optionalEnv,
  readJson,
  uniqueBy,
  writeJson,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();
const target = optionalEnv('OPENSEO_TARGET', optionalEnv('AHREFS_TARGET', 'aipromptindex.io'));
const locationCode = Number(optionalEnv('OPENSEO_LOCATION_CODE', '2840'));
const languageCode = optionalEnv('OPENSEO_LANGUAGE_CODE', 'en');
const seedPath = optionalEnv('SEO_SEED_KEYWORDS_PATH', 'scripts/config/seed-keywords.json');
const suggestionLimit = Number(optionalEnv('OPENSEO_SUGGESTION_LIMIT', '20'));
const seedCap = Number(optionalEnv('OPENSEO_SEED_CAP', '8'));
const competitorKeywordLimit = Number(optionalEnv('OPENSEO_COMPETITOR_KEYWORD_LIMIT', '50'));
const competitorCap = Number(optionalEnv('OPENSEO_COMPETITOR_CAP', '5'));

function loadSeedKeywords() {
  const filePath = path.isAbsolute(seedPath) ? seedPath : path.join(process.cwd(), seedPath);
  if (!fs.existsSync(filePath)) return [];
  const payload = readJson(filePath);
  return (payload.keywords || []).slice(0, seedCap);
}

async function safeLive(name, endpointPath, task, warnings) {
  try {
    return await fetchDataForSeoLive(endpointPath, task);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`${name} unavailable: ${message}`);
    return { cost: 0, result: [] };
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];
  const costs = [];

  if (!getDataForSeoAuthHeader()) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      outputDir,
      warning: 'DATAFORSEO_API_KEY is not set',
    }, null, 2));
    return;
  }

  const backlinks = await safeLive('backlinks-summary', 'backlinks/summary/live', {
    target,
    include_subdomains: true,
  }, warnings);
  costs.push({ name: 'backlinks-summary', cost: backlinks.cost });

  const seeds = loadSeedKeywords();
  const suggestions = [];
  for (const keyword of seeds) {
    const payload = await safeLive(`keyword-suggestions:${keyword}`, 'dataforseo_labs/google/keyword_suggestions/live', {
      keyword,
      location_code: locationCode,
      language_code: languageCode,
      limit: suggestionLimit,
    }, warnings);
    costs.push({ name: `keyword-suggestions:${keyword}`, cost: payload.cost });
    const items = Array.isArray(payload.result?.[0]?.items) ? payload.result[0].items : [];
    for (const item of items) {
      suggestions.push({
        seed: keyword,
        keyword: item.keyword || '',
        volume: numberValue(item.keyword_info?.search_volume),
        competition: numberValue(item.keyword_info?.competition),
        cpc: numberValue(item.keyword_info?.cpc),
      });
    }
  }

  const competitorsPath = path.join(outputDir, 'openseo-competitors.json');
  const competitorRows = fs.existsSync(competitorsPath)
    ? (readJson(competitorsPath).rows || []).slice(0, competitorCap)
    : [];

  const competitorKeywords = [];
  for (const competitor of competitorRows) {
    const domain = competitor.domain;
    if (!domain) continue;
    const payload = await safeLive(`competitor-keywords:${domain}`, 'dataforseo_labs/google/ranked_keywords/live', {
      target: domain,
      location_code: locationCode,
      language_code: languageCode,
      item_types: ['organic'],
      limit: competitorKeywordLimit,
      historical_serp_mode: 'live',
    }, warnings);
    costs.push({ name: `competitor-keywords:${domain}`, cost: payload.cost });
    const items = Array.isArray(payload.result?.[0]?.items) ? payload.result[0].items : [];
    for (const item of items) {
      const serp = item?.ranked_serp_element?.serp_item || {};
      competitorKeywords.push({
        domain,
        keyword: item?.keyword_data?.keyword || '',
        best_position: numberValue(serp.rank_group || serp.rank_absolute),
        volume: numberValue(item?.keyword_data?.keyword_info?.search_volume),
        sum_traffic: numberValue(item?.keyword_data?.keyword_info?.etv),
      });
    }
  }

  const backlinksSummary = Array.isArray(backlinks.result) ? backlinks.result[0] : null;

  writeJson(path.join(outputDir, 'openseo-backlinks.json'), {
    source: 'openseo-dataforseo',
    target,
    generatedAt,
    warnings,
    summary: backlinksSummary || null,
  });
  writeJson(path.join(outputDir, 'openseo-keyword-ideas.json'), {
    source: 'openseo-dataforseo',
    generatedAt,
    warnings,
    seeds,
    rows: uniqueBy(suggestions.filter((row) => row.keyword), (row) => `${row.seed}::${row.keyword}`),
  });
  writeJson(path.join(outputDir, 'openseo-competitor-keywords.json'), {
    source: 'openseo-dataforseo',
    generatedAt,
    warnings,
    rows: competitorKeywords.filter((row) => row.keyword),
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    suggestionCount: suggestions.length,
    competitorKeywordCount: competitorKeywords.length,
    totalCost: costs.reduce((sum, row) => sum + numberValue(row.cost), 0),
    warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
