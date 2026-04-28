import path from 'node:path';

import {
  buildDateWindow,
  fetchGoogleJson,
  getSeoOutputDir,
  optionalEnv,
  writeJson,
} from './_shared.mjs';

const siteProperty = optionalEnv(
  'GOOGLE_SEARCH_CONSOLE_PROPERTY',
  optionalEnv('GOOGLE_SEARCH_CONSOLE_SITE', 'sc-domain:aipromptindex.io')
);
const outputDir = getSeoOutputDir();
const windows = [
  buildDateWindow('last7', 7),
  buildDateWindow('last28', 28),
  buildDateWindow('previous28', 28, 28),
  buildDateWindow('last90', 90),
];

async function runSearchAnalyticsQuery(window, dimensions) {
  const encodedSite = encodeURIComponent(siteProperty);
  const response = await fetchGoogleJson(
    `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
    {
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      body: {
        startDate: window.startDate,
        endDate: window.endDate,
        type: 'web',
        dataState: 'all',
        dimensions,
        rowLimit: 25000,
      },
    }
  );

  return (response.rows || []).map((row) => {
    const [primaryKey] = row.keys || [];
    return {
      key: primaryKey || '',
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0),
    };
  });
}

async function main() {
  const generatedAt = new Date().toISOString();
  const pageRanges = {};
  const queryRanges = {};

  for (const window of windows) {
    pageRanges[window.label] = {
      ...window,
      rows: await runSearchAnalyticsQuery(window, ['page']),
    };
    queryRanges[window.label] = {
      ...window,
      rows: await runSearchAnalyticsQuery(window, ['query']),
    };
  }

  writeJson(path.join(outputDir, 'gsc-pages.json'), {
    source: 'google-search-console',
    siteProperty,
    generatedAt,
    ranges: pageRanges,
  });
  writeJson(path.join(outputDir, 'gsc-queries.json'), {
    source: 'google-search-console',
    siteProperty,
    generatedAt,
    ranges: queryRanges,
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    siteProperty,
    pageRows: Object.fromEntries(Object.entries(pageRanges).map(([label, value]) => [label, value.rows.length])),
    queryRows: Object.fromEntries(Object.entries(queryRanges).map(([label, value]) => [label, value.rows.length])),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
