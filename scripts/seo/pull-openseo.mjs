import path from 'node:path';

import {
  callOpenSeoMcp,
  fetchDataForSeoLive,
  getDataForSeoAuthHeader,
  getOpenSeoMcpKey,
  getSeoOutputDir,
  numberValue,
  optionalEnv,
  uniqueBy,
  writeJson,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();
const target = optionalEnv('OPENSEO_TARGET', optionalEnv('AHREFS_TARGET', 'aipromptindex.io'));
const locationCode = Number(optionalEnv('OPENSEO_LOCATION_CODE', '2840'));
const languageCode = optionalEnv('OPENSEO_LANGUAGE_CODE', 'en');
const keywordLimit = Number(optionalEnv('OPENSEO_KEYWORD_LIMIT', '100'));
const pageLimit = Number(optionalEnv('OPENSEO_PAGE_LIMIT', '50'));
const competitorLimit = Number(optionalEnv('OPENSEO_COMPETITOR_LIMIT', '10'));

async function runEndpoint(name, endpointPath, task) {
  const started = Date.now();
  const payload = await fetchDataForSeoLive(endpointPath, task);
  return {
    name,
    cost: payload.cost,
    elapsedMs: Date.now() - started,
    result: payload.result,
  };
}

function firstResult(payload) {
  return Array.isArray(payload?.result) ? payload.result[0] : null;
}

function mapRankedKeywords(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.map((item) => {
    const keywordData = item?.keyword_data || {};
    const info = keywordData.keyword_info || {};
    const serp = item?.ranked_serp_element?.serp_item || {};
    return {
      keyword: keywordData.keyword || '',
      best_position: numberValue(serp.rank_group || serp.rank_absolute),
      best_position_diff: 0,
      best_position_url: serp.url || serp.relative_url || '',
      volume: numberValue(info.search_volume),
      sum_traffic: numberValue(info.etv || item?.keyword_data?.impressions_info?.etv),
    };
  }).filter((row) => row.keyword);
}

function mapTopPages(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.map((item) => {
    const organic = item?.metrics?.organic || {};
    return {
      url: item.page_address || item.url || '',
      title: item.title || '',
      traffic: numberValue(organic.etv),
      refdomains: null,
      topKeyword: '',
      topKeywordVolume: numberValue(organic.count),
    };
  }).filter((row) => row.url);
}

function mapCompetitors(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.map((item) => {
    const organic = item?.metrics?.organic || {};
    return {
      domain: item.domain || item.target || '',
      keywords_matched: numberValue(organic.count),
      traffic: numberValue(organic.etv),
      domainRating: numberValue(item.rank || item.domain_rank),
    };
  }).filter((row) => row.domain && row.domain !== target);
}

async function resolveOpenSeoProjectId() {
  const explicit = optionalEnv('OPENSEO_PROJECT_ID');
  if (explicit) return explicit;

  const listed = await callOpenSeoMcp('list_projects', {});
  const projects = Array.isArray(listed.projects) ? listed.projects : [];
  const match = projects.find((project) => {
    const domain = String(project.domain || '').replace(/^www\./, '');
    return domain === target || project.name === 'AIPromptIndex';
  });
  if (!match?._id && !match?.id) {
    throw new Error(`No OpenSEO project found for ${target}. Create one in app.openseo.so.`);
  }
  return match.id || match._id;
}

async function pullViaOpenSeoMcp(generatedAt, warnings) {
  const projectId = await resolveOpenSeoProjectId();
  const costs = [];

  let rankedPayload = { keywords: [] };
  try {
    rankedPayload = await callOpenSeoMcp('get_ranked_keywords', {
      projectId,
      target,
      scope: 'domain',
      locationCode,
      languageCode,
      resultTypes: ['organic'],
    });
    costs.push({ name: 'ranked-keywords', cost: 0 });
  } catch (error) {
    warnings.push(`ranked-keywords unavailable: ${error instanceof Error ? error.message : error}`);
  }

  let overviewPayload = {};
  try {
    overviewPayload = await callOpenSeoMcp('get_domain_overview', {
      projectId,
      domain: target,
      scope: 'domain',
      locationCode,
      languageCode,
    });
    costs.push({ name: 'domain-overview', cost: 0 });
  } catch (error) {
    warnings.push(`domain-rank unavailable: ${error instanceof Error ? error.message : error}`);
  }

  const rankedKeywords = mapRankedKeywords({ items: rankedPayload.keywords || [] });
  const topPages = uniqueBy(
    rankedKeywords
      .filter((row) => row.best_position_url)
      .map((row) => ({
        url: row.best_position_url,
        title: '',
        traffic: numberValue(row.sum_traffic),
        refdomains: null,
        topKeyword: row.keyword,
        topKeywordVolume: numberValue(row.volume),
      })),
    (row) => row.url,
  ).slice(0, pageLimit);

  const overview = {
    source: 'openseo-mcp',
    provider: 'OpenSEO MCP',
    target,
    projectId,
    locationCode,
    languageCode,
    generatedAt,
    warnings,
    costs,
    totalCost: 0,
    metrics: overviewPayload.metrics || overviewPayload.overview || overviewPayload,
    rankedKeywordCount: rankedKeywords.length,
    topPageCount: topPages.length,
    competitorCount: 0,
  };

  writeJson(path.join(outputDir, 'openseo-overview.json'), overview);
  writeJson(path.join(outputDir, 'openseo-keywords.json'), {
    source: 'openseo-mcp',
    target,
    generatedAt,
    warnings,
    rows: rankedKeywords,
  });
  writeJson(path.join(outputDir, 'openseo-top-pages.json'), {
    source: 'openseo-mcp',
    target,
    generatedAt,
    warnings,
    rows: topPages,
  });
  writeJson(path.join(outputDir, 'openseo-competitors.json'), {
    source: 'openseo-mcp',
    target,
    generatedAt,
    warnings,
    rows: [],
  });

  console.log(JSON.stringify({
    ok: true,
    provider: 'openseo-mcp',
    outputDir,
    target,
    projectId,
    keywordCount: rankedKeywords.length,
    pageCount: topPages.length,
    competitorCount: 0,
    totalCost: 0,
    warnings,
  }, null, 2));
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];
  const costs = [];

  if (getOpenSeoMcpKey()) {
    await pullViaOpenSeoMcp(generatedAt, warnings);
    return;
  }

  if (!getDataForSeoAuthHeader()) {
    writeJson(path.join(outputDir, 'openseo-overview.json'), {
      source: 'openseo-dataforseo',
      skipped: true,
      generatedAt,
      warnings: ['OPENSEO_API_KEY or DATAFORSEO_API_KEY is not set. First-party GSC/GA4 pulls still run.'],
    });
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      outputDir,
      warning: 'OPENSEO_API_KEY or DATAFORSEO_API_KEY is not set',
    }, null, 2));
    return;
  }

  const calls = [
    ['domain-rank', 'dataforseo_labs/google/domain_rank_overview/live', {
      target,
      location_code: locationCode,
      language_code: languageCode,
    }],
    ['ranked-keywords', 'dataforseo_labs/google/ranked_keywords/live', {
      target,
      location_code: locationCode,
      language_code: languageCode,
      item_types: ['organic'],
      limit: keywordLimit,
      historical_serp_mode: 'live',
    }],
    ['relevant-pages', 'dataforseo_labs/google/relevant_pages/live', {
      target,
      location_code: locationCode,
      language_code: languageCode,
      item_types: ['organic'],
      limit: pageLimit,
    }],
    ['competitors', 'dataforseo_labs/google/competitors_domain/live', {
      target,
      location_code: locationCode,
      language_code: languageCode,
      item_types: ['organic'],
      limit: competitorLimit,
    }],
  ];

  const results = {};
  for (const [name, endpoint, task] of calls) {
    try {
      const payload = await runEndpoint(name, endpoint, task);
      results[name] = payload;
      costs.push({ name, cost: payload.cost });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${name} unavailable: ${message}`);
      results[name] = { name, cost: 0, result: [] };
    }
  }

  const rankedKeywords = mapRankedKeywords(firstResult(results['ranked-keywords']));
  const topPages = mapTopPages(firstResult(results['relevant-pages']));
  const competitors = uniqueBy(mapCompetitors(firstResult(results['competitors'])), (row) => row.domain);
  const overviewResult = firstResult(results['domain-rank']);

  const overview = {
    source: 'openseo-dataforseo',
    provider: 'OpenSEO (DataForSEO Labs)',
    target,
    locationCode,
    languageCode,
    generatedAt,
    warnings,
    costs,
    totalCost: costs.reduce((sum, row) => sum + numberValue(row.cost), 0),
    metrics: overviewResult?.metrics || null,
    rankedKeywordCount: rankedKeywords.length,
    topPageCount: topPages.length,
    competitorCount: competitors.length,
  };

  writeJson(path.join(outputDir, 'openseo-overview.json'), overview);
  writeJson(path.join(outputDir, 'openseo-keywords.json'), {
    source: 'openseo-dataforseo',
    target,
    generatedAt,
    warnings,
    rows: rankedKeywords,
  });
  writeJson(path.join(outputDir, 'openseo-top-pages.json'), {
    source: 'openseo-dataforseo',
    target,
    generatedAt,
    warnings,
    rows: topPages,
  });
  writeJson(path.join(outputDir, 'openseo-competitors.json'), {
    source: 'openseo-dataforseo',
    target,
    generatedAt,
    warnings,
    rows: competitors,
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    target,
    keywordCount: rankedKeywords.length,
    pageCount: topPages.length,
    competitorCount: competitors.length,
    totalCost: overview.totalCost,
    warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
