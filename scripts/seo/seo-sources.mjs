import fs from 'node:fs';
import path from 'node:path';

import {
  normalizePathname,
  numberValue,
  readOptionalJson,
} from './_shared.mjs';

function mapGscQueriesToKeywordRows(gscQueries) {
  return (gscQueries?.ranges?.last28?.rows || []).map((row) => ({
    keyword: row.key || '',
    best_position: numberValue(row.position),
    best_position_diff: 0,
    best_position_url: '',
    volume: numberValue(row.impressions),
    sum_traffic: numberValue(row.clicks),
    impressions: numberValue(row.impressions),
    clicks: numberValue(row.clicks),
    ctr: numberValue(row.ctr),
  })).filter((row) => row.keyword);
}

function mapGscPagesToTopPages(gscPages) {
  return (gscPages?.ranges?.last28?.rows || []).map((row) => ({
    url: row.key || '',
    title: '',
    traffic: numberValue(row.clicks),
    impressions: numberValue(row.impressions),
    position: numberValue(row.position),
    refdomains: null,
    topKeyword: '',
    topKeywordVolume: 0,
  })).filter((row) => row.url);
}

export function loadResearchKeywords(outputDir) {
  const openseo = readOptionalJson(path.join(outputDir, 'openseo-keywords.json'));
  if (Array.isArray(openseo?.rows) && openseo.rows.length > 0) {
    return { source: openseo.source || 'openseo-dataforseo', rows: openseo.rows };
  }

  const ahrefs = readOptionalJson(path.join(outputDir, 'ahrefs-keywords.json'));
  if (Array.isArray(ahrefs?.rows) && ahrefs.rows.length > 0) {
    return { source: ahrefs.source || 'ahrefs-api-v3', rows: ahrefs.rows };
  }

  const gsc = readOptionalJson(path.join(outputDir, 'gsc-queries.json'));
  const rows = mapGscQueriesToKeywordRows(gsc);
  return {
    source: rows.length > 0 ? 'google-search-console' : null,
    rows,
  };
}

export function loadResearchTopPages(outputDir) {
  const openseo = readOptionalJson(path.join(outputDir, 'openseo-top-pages.json'));
  if (Array.isArray(openseo?.rows) && openseo.rows.length > 0) {
    return { source: openseo.source || 'openseo-dataforseo', rows: openseo.rows };
  }

  const ahrefs = readOptionalJson(path.join(outputDir, 'ahrefs-top-pages.json'));
  if (Array.isArray(ahrefs?.rows) && ahrefs.rows.length > 0) {
    return { source: ahrefs.source || 'ahrefs-api-v3', rows: ahrefs.rows };
  }

  const gsc = readOptionalJson(path.join(outputDir, 'gsc-pages.json'));
  const rows = mapGscPagesToTopPages(gsc);
  return {
    source: rows.length > 0 ? 'google-search-console' : null,
    rows,
  };
}

export function loadResearchCompetitors(outputDir) {
  const openseo = readOptionalJson(path.join(outputDir, 'openseo-competitors.json'));
  if (Array.isArray(openseo?.rows) && openseo.rows.length > 0) {
    return { source: openseo.source || 'openseo-dataforseo', rows: openseo.rows };
  }

  const ahrefs = readOptionalJson(path.join(outputDir, 'ahrefs-competitors.json'));
  if (Array.isArray(ahrefs?.rows) && ahrefs.rows.length > 0) {
    return { source: ahrefs.source || 'ahrefs-api-v3', rows: ahrefs.rows };
  }

  return { source: null, rows: [] };
}

export function loadResearchOverview(outputDir) {
  const openseo = readOptionalJson(path.join(outputDir, 'openseo-overview.json'));
  if (openseo) {
    return openseo;
  }
  return readOptionalJson(path.join(outputDir, 'ahrefs-overview.json'));
}

export function hasFirstPartySeoArtifacts(outputDir) {
  return fs.existsSync(path.join(outputDir, 'gsc-pages.json'))
    || fs.existsSync(path.join(outputDir, 'gsc-queries.json'))
    || fs.existsSync(path.join(outputDir, 'ga4-landing-pages.json'));
}

export function pathnameFromRow(row) {
  return normalizePathname(row.key || row.landingPage || row.url || row.best_position_url);
}
