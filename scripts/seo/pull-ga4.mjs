import path from 'node:path';

import {
  buildDateWindow,
  fetchGoogleJson,
  getSeoOutputDir,
  numberValue,
  requireEnv,
  writeJson,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();
const keyEventNames = ['prompt_copied', 'prompt_viewed'];
const windows = [
  buildDateWindow('last7', 7),
  buildDateWindow('last28', 28),
  buildDateWindow('previous28', 28, 28),
  buildDateWindow('last90', 90),
];

function organicSearchFilter() {
  return {
    filter: {
      fieldName: 'sessionDefaultChannelGroup',
      stringFilter: {
        matchType: 'EXACT',
        value: 'Organic Search',
      },
    },
  };
}

function keyEventFilter() {
  return {
    andGroup: {
      expressions: [
        organicSearchFilter(),
        {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: keyEventNames,
            },
          },
        },
      ],
    },
  };
}

async function runReport(propertyId, body) {
  return fetchGoogleJson(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      body,
    }
  );
}

function mapLandingPageRows(rows = []) {
  return rows.map((row) => ({
    landingPage: row.dimensionValues?.[0]?.value || '',
    sessions: numberValue(row.metricValues?.[0]?.value),
    engagedSessions: numberValue(row.metricValues?.[1]?.value),
  }));
}

function mapKeyEventRows(rows = []) {
  return rows.map((row) => ({
    landingPage: row.dimensionValues?.[0]?.value || '',
    eventName: row.dimensionValues?.[1]?.value || '',
    eventCount: numberValue(row.metricValues?.[0]?.value),
  }));
}

function mergeWindowData(landingPages, keyEvents) {
  const byLandingPage = new Map();

  for (const row of landingPages) {
    byLandingPage.set(row.landingPage, {
      ...row,
      keyEvents: {},
      totalKeyEvents: 0,
    });
  }

  for (const eventRow of keyEvents) {
    const current = byLandingPage.get(eventRow.landingPage) || {
      landingPage: eventRow.landingPage,
      sessions: 0,
      engagedSessions: 0,
      keyEvents: {},
      totalKeyEvents: 0,
    };
    current.keyEvents[eventRow.eventName] = eventRow.eventCount;
    current.totalKeyEvents += eventRow.eventCount;
    byLandingPage.set(eventRow.landingPage, current);
  }

  return [...byLandingPage.values()].sort((left, right) => right.sessions - left.sessions);
}

async function fetchWindow(propertyId, window) {
  const dateRanges = [{ startDate: window.startDate, endDate: window.endDate }];
  const landingPageResponse = await runReport(propertyId, {
    dateRanges,
    dimensions: [{ name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
    dimensionFilter: organicSearchFilter(),
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    keepEmptyRows: false,
    limit: '10000',
  });
  const keyEventsResponse = await runReport(propertyId, {
    dateRanges,
    dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: keyEventFilter(),
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    keepEmptyRows: false,
    limit: '10000',
  });

  const landingPages = mapLandingPageRows(landingPageResponse.rows);
  const keyEvents = mapKeyEventRows(keyEventsResponse.rows);

  return {
    ...window,
    landingPages,
    keyEvents,
    summary: mergeWindowData(landingPages, keyEvents),
  };
}

async function main() {
  const propertyId = requireEnv('GOOGLE_ANALYTICS_PROPERTY_ID');
  const generatedAt = new Date().toISOString();
  const ranges = {};

  for (const window of windows) {
    ranges[window.label] = await fetchWindow(propertyId, window);
  }

  writeJson(path.join(outputDir, 'ga4-landing-pages.json'), {
    source: 'ga4-data-api',
    propertyId,
    generatedAt,
    keyEventNames,
    ranges,
  });

  console.log(JSON.stringify({
    ok: true,
    propertyId,
    outputDir,
    windows: Object.fromEntries(Object.entries(ranges).map(([label, value]) => [
      label,
      {
        landingPages: value.landingPages.length,
        keyEvents: value.keyEvents.length,
      },
    ])),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
