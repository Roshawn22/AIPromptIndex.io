import path from 'node:path';

import {
  fetchAhrefsJson,
  getSeoOutputDir,
  numberValue,
  optionalEnv,
  toIsoDate,
  uniqueBy,
  writeJson,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();
const target = optionalEnv('AHREFS_TARGET', 'aipromptindex.io');
const mode = optionalEnv('AHREFS_TARGET_MODE', 'subdomains');
const today = toIsoDate(new Date());

async function requestAhrefs(endpointPath, params = {}) {
  return fetchAhrefsJson(endpointPath, {
    target,
    mode,
    date: today,
    output: 'json',
    ...params,
  });
}

function normalizeRows(response) {
  if (Array.isArray(response?.rows)) return response.rows;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function buildTopPagesFallback(keywordRows) {
  const byPage = new Map();

  for (const row of keywordRows) {
    const page = row.best_position_url;
    if (!page) continue;
    const rowTraffic = numberValue(row.sum_traffic);
    const rowPosition = numberValue(row.best_position);
    const rowVolume = numberValue(row.volume);
    const current = byPage.get(page) || {
      url: page,
      traffic: 0,
      refdomains: null,
      keywords: 0,
      topKeyword: row.keyword,
      topKeywordVolume: rowVolume,
      topPosition: rowPosition,
    };

    current.traffic += rowTraffic;
    current.keywords += 1;
    if (rowTraffic > current.traffic - rowTraffic) {
      current.topKeyword = row.keyword;
      current.topKeywordVolume = rowVolume;
      current.topPosition = rowPosition;
    } else if (rowPosition < current.topPosition) {
      current.topPosition = rowPosition;
    }

    byPage.set(page, current);
  }

  return [...byPage.values()]
    .sort((left, right) => right.traffic - left.traffic)
    .slice(0, 100);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  const domainRating = await requestAhrefs('site-explorer/domain-rating');
  const backlinksStats = await requestAhrefs('site-explorer/backlinks-stats');
  const organicKeywordsResponse = await requestAhrefs('site-explorer/organic-keywords', {
    limit: 250,
    select: 'keyword,best_position,best_position_url,volume,sum_traffic',
  });
  const organicKeywords = normalizeRows(organicKeywordsResponse).map((row) => ({
    keyword: row.keyword || '',
    best_position: numberValue(row.best_position),
    best_position_diff: 0,
    best_position_url: row.best_position_url || '',
    volume: numberValue(row.volume),
    sum_traffic: numberValue(row.sum_traffic),
  }));

  let topPages = [];
  try {
    const topPagesResponse = await requestAhrefs('site-explorer/top-pages', {
      limit: 200,
      select: 'url,sum_traffic,referring_domains,top_keyword,top_keyword_volume',
    });
    topPages = normalizeRows(topPagesResponse).map((row) => ({
      url: row.url || '',
      title: '',
      traffic: numberValue(row.sum_traffic),
      refdomains: row.referring_domains === undefined ? null : numberValue(row.referring_domains),
      topKeyword: row.top_keyword || '',
      topKeywordVolume: numberValue(row.top_keyword_volume),
    }));
  } catch (error) {
    warnings.push(`top-pages fallback used: ${error instanceof Error ? error.message : String(error)}`);
    topPages = buildTopPagesFallback(organicKeywords);
  }

  let referringDomains = [];
  try {
    const referringDomainsResponse = await requestAhrefs('site-explorer/refdomains', {
      limit: 100,
      select: 'domain,domain_rating,links_to_target,first_seen,last_seen',
    });
    referringDomains = normalizeRows(referringDomainsResponse).map((row) => ({
      refdomain: row.domain || '',
      domain_rating: numberValue(row.domain_rating),
      links_to_target: numberValue(row.links_to_target),
      first_seen: row.first_seen || '',
      last_visited: row.last_seen || '',
    }));
  } catch (error) {
    warnings.push(`refdomains unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  let organicCompetitors = [];
  try {
    const competitorsResponse = await requestAhrefs('site-explorer/organic-competitors', {
      limit: 25,
      country: 'us',
      select: 'competitor_domain,keywords_common,traffic,domain_rating',
    });
    organicCompetitors = normalizeRows(competitorsResponse).map((row) => ({
      domain: row.competitor_domain || '',
      keywords_matched: numberValue(row.keywords_common),
      traffic: numberValue(row.traffic),
      domainRating: numberValue(row.domain_rating),
    }));
  } catch (error) {
    warnings.push(`organic competitors: ${error instanceof Error ? error.message : String(error)}`);
  }

  const overview = {
    source: 'ahrefs-api-v3',
    target,
    mode,
    generatedAt,
    warnings,
    domainRating,
    backlinksStats,
    referringDomains: uniqueBy(referringDomains, (row) => row.refdomain),
  };

  writeJson(path.join(outputDir, 'ahrefs-overview.json'), overview);
  writeJson(path.join(outputDir, 'ahrefs-keywords.json'), {
    source: 'ahrefs-api-v3',
    target,
    mode,
    generatedAt,
    rows: organicKeywords,
  });
  writeJson(path.join(outputDir, 'ahrefs-top-pages.json'), {
    source: 'ahrefs-api-v3',
    target,
    mode,
    generatedAt,
    rows: topPages,
    warnings,
  });
  writeJson(path.join(outputDir, 'ahrefs-competitors.json'), {
    source: 'ahrefs-api-v3',
    target,
    mode,
    generatedAt,
    rows: organicCompetitors,
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    target,
    warnings,
    rows: {
      keywords: organicKeywords.length,
      topPages: topPages.length,
      referringDomains: referringDomains.length,
      organicCompetitors: organicCompetitors.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
