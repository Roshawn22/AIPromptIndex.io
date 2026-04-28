import path from 'node:path';

import {
  fetchAhrefsJson,
  getArtifactEnvelope,
  getSeoOutputDir,
  optionalEnv,
  parseCliArgs,
  toIsoDate,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const brand = optionalEnv('BRAND_RADAR_BRAND', 'AI Prompt Index');
const market = optionalEnv('BRAND_RADAR_MARKET', 'AI prompts and prompt engineering');
const competitors = optionalEnv('BRAND_RADAR_COMPETITORS', 'PromptBase,FlowGPT,AIPRM,PromptHero');
const reportId = optionalEnv('BRAND_RADAR_REPORT_ID', '019d5474-1c0f-7ee5-a4d9-a39c3cd90e38');

// AI platforms to query — Google models must be queried separately from non-Google
const NON_GOOGLE_SOURCES = ['chatgpt', 'perplexity', 'gemini', 'copilot'];
const GOOGLE_SOURCES = ['google_ai_overviews', 'google_ai_mode'];
const historyDateTo = toIsoDate(new Date());
const historyDateFrom = toIsoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

async function fetchBrandRadar(endpoint, params = {}) {
  return fetchAhrefsJson(`brand-radar/${endpoint}`, {
    ...params,
    output: 'json',
  });
}

async function pullImpressions(dataSource) {
  return fetchBrandRadar('impressions-overview', {
    brand,
    competitors,
    market,
    prompts: 'custom',
    report_id: reportId,
    data_source: dataSource,
    select: 'brand,total,only_target_brand,only_competitors_brands,target_and_competitors_brands,no_tracked_brands',
  });
}

async function pullMentions(dataSource) {
  return fetchBrandRadar('mentions-overview', {
    brand,
    competitors,
    market,
    prompts: 'custom',
    report_id: reportId,
    data_source: dataSource,
    select: 'brand,total,only_target_brand,only_competitors_brands,target_and_competitors_brands',
  });
}

async function pullShareOfVoice(dataSource) {
  return fetchBrandRadar('sov-overview', {
    brand,
    competitors,
    market,
    prompts: 'custom',
    report_id: reportId,
    data_source: dataSource,
    select: 'brand,share_of_voice',
  });
}

async function pullAiResponses(dataSource) {
  return fetchBrandRadar('ai-responses', {
    brand,
    market,
    prompts: 'custom',
    report_id: reportId,
    data_source: dataSource,
    select: 'question,volume,data_source,country',
    limit: 25,
    order_by: 'volume',
  });
}

async function pullCitedPages(dataSource) {
  return fetchBrandRadar('cited-pages', {
    brand,
    market,
    prompts: 'custom',
    report_id: reportId,
    data_source: dataSource,
    select: 'cited_url,responses,volume',
    limit: 25,
  });
}

async function pullImpressionsHistory(dataSource) {
  return fetchBrandRadar('impressions-history', {
    brand,
    competitors,
    market,
    prompts: 'custom',
    report_id: reportId,
    data_source: dataSource,
    date_from: historyDateFrom,
    date_to: historyDateTo,
    select: 'date,total,only_target_brand',
  });
}

async function pullMentionsHistory(dataSource) {
  return fetchBrandRadar('mentions-history', {
    brand,
    competitors,
    market,
    prompts: 'custom',
    report_id: reportId,
    data_source: dataSource,
    date_from: historyDateFrom,
    date_to: historyDateTo,
    select: 'date,total,only_target_brand',
  });
}

async function safePull(label, fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Missing addon')) {
      return { ok: false, addonMissing: true, message };
    }
    return { ok: false, addonMissing: false, message };
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];
  const addonStatus = {};

  const impressions = {};
  const mentions = {};
  const sov = {};
  const aiResponses = {};
  const citedPages = {};
  const impressionsHistory = {};
  const mentionsHistory = {};

  for (const source of NON_GOOGLE_SOURCES) {
    const result = await safePull(`impressions-${source}`, () => pullImpressions(source));
    if (result.ok) {
      addonStatus[source] = 'active';
      impressions[source] = result.data;

      const [mentionsResult, sovResult, responsesResult, citedResult] = await Promise.all([
        safePull(`mentions-${source}`, () => pullMentions(source)),
        safePull(`sov-${source}`, () => pullShareOfVoice(source)),
        safePull(`responses-${source}`, () => pullAiResponses(source)),
        safePull(`cited-${source}`, () => pullCitedPages(source)),
      ]);

      if (mentionsResult.ok) mentions[source] = mentionsResult.data;
      if (sovResult.ok) sov[source] = sovResult.data;
      if (responsesResult.ok) aiResponses[source] = responsesResult.data;
      if (citedResult.ok) citedPages[source] = citedResult.data;

      const [impressionsHistoryResult, mentionsHistoryResult] = await Promise.all([
        safePull(`impressions-history-${source}`, () => pullImpressionsHistory(source)),
        safePull(`mentions-history-${source}`, () => pullMentionsHistory(source)),
      ]);

      if (impressionsHistoryResult.ok) impressionsHistory[source] = impressionsHistoryResult.data;
      if (mentionsHistoryResult.ok) mentionsHistory[source] = mentionsHistoryResult.data;
    } else if (result.addonMissing) {
      addonStatus[source] = 'addon_not_enabled';
    } else {
      addonStatus[source] = 'error';
      warnings.push(`${source}: ${result.message}`);
    }
  }

  for (const source of GOOGLE_SOURCES) {
    const result = await safePull(`impressions-${source}`, () => pullImpressions(source));
    if (result.ok) {
      addonStatus[source] = 'active';
      impressions[source] = result.data;

      const [mentionsResult, sovResult, responsesResult, citedResult] = await Promise.all([
        safePull(`mentions-${source}`, () => pullMentions(source)),
        safePull(`sov-${source}`, () => pullShareOfVoice(source)),
        safePull(`responses-${source}`, () => pullAiResponses(source)),
        safePull(`cited-${source}`, () => pullCitedPages(source)),
      ]);

      if (mentionsResult.ok) mentions[source] = mentionsResult.data;
      if (sovResult.ok) sov[source] = sovResult.data;
      if (responsesResult.ok) aiResponses[source] = responsesResult.data;
      if (citedResult.ok) citedPages[source] = citedResult.data;

      const [impressionsHistoryResult, mentionsHistoryResult] = await Promise.all([
        safePull(`impressions-history-${source}`, () => pullImpressionsHistory(source)),
        safePull(`mentions-history-${source}`, () => pullMentionsHistory(source)),
      ]);

      if (impressionsHistoryResult.ok) impressionsHistory[source] = impressionsHistoryResult.data;
      if (mentionsHistoryResult.ok) mentionsHistory[source] = mentionsHistoryResult.data;
    } else if (result.addonMissing) {
      addonStatus[source] = 'addon_not_enabled';
    } else {
      addonStatus[source] = 'error';
      warnings.push(`${source}: ${result.message}`);
    }
  }

  const activeSources = Object.entries(addonStatus)
    .filter(([, status]) => status === 'active')
    .map(([source]) => source);

  const missingAddons = Object.entries(addonStatus)
    .filter(([, status]) => status === 'addon_not_enabled')
    .map(([source]) => source);

  if (missingAddons.length > 0) {
    warnings.push(`Brand Radar addons not enabled: ${missingAddons.join(', ')}. Enable in Ahrefs to unlock AI visibility tracking.`);
  }

  const output = getArtifactEnvelope({
    source: 'ahrefs-brand-radar',
    status: activeSources.length > 0 ? 'ok' : (missingAddons.length > 0 ? 'blocked' : 'unknown'),
    blockedReason: activeSources.length > 0 ? null : (missingAddons.length > 0 ? 'brand_radar_addons_missing' : null),
    brand,
    market,
    competitors,
    generatedAt,
    unitCostEstimate: {
      overview: 250,
      history: 100,
      aiResponses: 100,
      citedPages: 100,
    },
    addonStatus,
    activeSources,
    warnings,
    historyWindow: {
      dateFrom: historyDateFrom,
      dateTo: historyDateTo,
    },
    impressions,
    mentions,
    sov,
    impressionsHistory,
    mentionsHistory,
    aiResponses,
    citedPages,
  });

  writeJson(path.join(outputDir, 'brand-radar.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    brand,
    market,
    addonStatus,
    activeSources: activeSources.length,
    missingAddons: missingAddons.length,
    warnings,
    dataPulled: {
      impressions: Object.keys(impressions).length,
      mentions: Object.keys(mentions).length,
      sov: Object.keys(sov).length,
      impressionsHistory: Object.keys(impressionsHistory).length,
      mentionsHistory: Object.keys(mentionsHistory).length,
      aiResponses: Object.keys(aiResponses).length,
      citedPages: Object.keys(citedPages).length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
