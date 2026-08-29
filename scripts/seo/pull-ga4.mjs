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
const keyEventNames = [
  'newsletter_cta_clicked',
  'outbound_tool_clicked',
  'prompt_copied',
  'prompt_saved',
  'prompt_unsaved',
  'prompt_submission_succeeded',
  'prompt_viewed',
  'search_opened',
  'search_query',
  'vote_cast_succeeded',
];
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

function mapLocaleDemandRows(rows = []) {
  return rows.map((row) => ({
    language: row.dimensionValues?.[0]?.value || '(not set)',
    countryId: row.dimensionValues?.[1]?.value || '(not set)',
    sessions: numberValue(row.metricValues?.[0]?.value),
    engagedSessions: numberValue(row.metricValues?.[1]?.value),
    activeUsers: numberValue(row.metricValues?.[2]?.value),
  }));
}

function aggregateLocaleDemand(rows, key) {
  const totals = new Map();

  for (const row of rows) {
    const value = row[key];
    const current = totals.get(value) || {
      [key]: value,
      sessions: 0,
      engagedSessions: 0,
      activeUsers: 0,
    };
    current.sessions += row.sessions;
    current.engagedSessions += row.engagedSessions;
    current.activeUsers += row.activeUsers;
    totals.set(value, current);
  }

  return [...totals.values()].sort((left, right) => right.sessions - left.sessions);
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

async function fetchLocaleDemandWindow(propertyId, window, dimensionFilter) {
  const response = await runReport(propertyId, {
    dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
    dimensions: [{ name: 'language' }, { name: 'countryId' }],
    metrics: [
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'activeUsers' },
    ],
    dimensionFilter,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    keepEmptyRows: false,
    limit: '10000',
  });
  const rows = mapLocaleDemandRows(response.rows);

  return {
    ...window,
    rows,
    languages: aggregateLocaleDemand(rows, 'language'),
    countries: aggregateLocaleDemand(rows, 'countryId'),
  };
}

async function main() {
  const propertyId = requireEnv('GOOGLE_ANALYTICS_PROPERTY_ID');
  const generatedAt = new Date().toISOString();
  const ranges = {};
  const localeDemandRanges = {};

  for (const window of windows) {
    ranges[window.label] = await fetchWindow(propertyId, window);
    localeDemandRanges[window.label] = {
      ...window,
      allTraffic: await fetchLocaleDemandWindow(propertyId, window),
      organicSearch: await fetchLocaleDemandWindow(propertyId, window, organicSearchFilter()),
    };
  }

  writeJson(path.join(outputDir, 'ga4-landing-pages.json'), {
    source: 'ga4-data-api',
    propertyId,
    generatedAt,
    keyEventNames,
    ranges,
  });
  writeJson(path.join(outputDir, 'ga4-locale-demand.json'), {
    source: 'ga4-data-api',
    propertyId,
    generatedAt,
    metricDefinitions: {
      language: 'GA4 browser or app language dimension.',
      countryId: 'ISO 3166-1 alpha-2 country code inferred by GA4.',
      allTraffic: 'All measured sessions.',
      organicSearch: 'Sessions where sessionDefaultChannelGroup is Organic Search.',
    },
    ranges: localeDemandRanges,
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
    localeDemandRows: Object.fromEntries(Object.entries(localeDemandRanges).map(([label, value]) => [
      label,
      {
        allTraffic: value.allTraffic.rows.length,
        organicSearch: value.organicSearch.rows.length,
      },
    ])),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
