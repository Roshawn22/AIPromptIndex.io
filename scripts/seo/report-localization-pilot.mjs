import path from 'node:path';

import {
  getSeoOutputDir,
  parseCliArgs,
  readOptionalJson,
  repoRoot,
  writeJson,
  writeText,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const pilot = readOptionalJson(
  path.join(repoRoot, 'src/data/i18n/pt-BR/pilot-pages.json'),
  { pages: {} }
);
const ga4 = readOptionalJson(path.join(outputDir, 'ga4-landing-pages.json'), { ranges: {} });
const gsc = readOptionalJson(path.join(outputDir, 'gsc-pages.json'), { ranges: {} });
const sourcePaths = new Set(Object.keys(pilot.pages || {}));
const launchDate = args['launch-date'] || process.env.LOCALIZATION_PILOT_LAUNCH_DATE || null;
const generatedAt = new Date().toISOString();

function pathnameFromValue(value) {
  if (!value) return '/';
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).pathname;
  } catch {
    return '/';
  }
  return value.split(/[?#]/, 1)[0] || '/';
}

function normalizePathname(value) {
  const pathname = pathnameFromValue(value);
  if (pathname === '/') return '/';
  return `${pathname.replace(/\/+$/, '')}/`;
}

function isLocalized(value) {
  return normalizePathname(value).startsWith('/pt-BR/');
}

function isEnglishControl(value) {
  return sourcePaths.has(normalizePathname(value));
}

function summarizeGa4(range, matcher) {
  const summary = (range?.summary || []).filter((row) => matcher(row.landingPage));
  return summary.reduce((totals, row) => {
    totals.sessions += Number(row.sessions || 0);
    totals.engagedSessions += Number(row.engagedSessions || 0);
    for (const [eventName, count] of Object.entries(row.keyEvents || {})) {
      totals.events[eventName] = (totals.events[eventName] || 0) + Number(count || 0);
    }
    return totals;
  }, { sessions: 0, engagedSessions: 0, events: {} });
}

function summarizeGsc(range, matcher) {
  const rows = (range?.rows || []).filter((row) => matcher(row.dimensions?.page || row.key));
  const totals = rows.reduce((result, row) => {
    result.clicks += Number(row.clicks || 0);
    result.impressions += Number(row.impressions || 0);
    return result;
  }, { clicks: 0, impressions: 0 });
  return {
    ...totals,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
  };
}

function summarizeWindow(label) {
  return {
    label,
    startDate: ga4.ranges?.[label]?.startDate || gsc.ranges?.[label]?.startDate || null,
    endDate: ga4.ranges?.[label]?.endDate || gsc.ranges?.[label]?.endDate || null,
    localized: {
      ga4: summarizeGa4(ga4.ranges?.[label], isLocalized),
      gsc: summarizeGsc(gsc.ranges?.[label], isLocalized),
    },
    englishControl: {
      ga4: summarizeGa4(ga4.ranges?.[label], isEnglishControl),
      gsc: summarizeGsc(gsc.ranges?.[label], isEnglishControl),
    },
  };
}

const windows = ['last7', 'last28', 'last90']
  .filter((label) => ga4.ranges?.[label] || gsc.ranges?.[label])
  .map(summarizeWindow);
const primaryWindow = windows.find((window) => window.label === 'last90') || windows.at(-1) || null;
const localized = primaryWindow?.localized;
const daysLive = launchDate
  ? Math.max(0, Math.floor((Date.now() - new Date(`${launchDate}T00:00:00Z`).getTime()) / 86_400_000))
  : null;
const actionCount = localized
  ? ['prompt_copied', 'prompt_saved', 'newsletter_cta_clicked']
      .reduce((total, name) => total + Number(localized.ga4.events[name] || 0), 0)
  : 0;
const assessment = !launchDate
  ? 'prelaunch'
  : daysLive < 42
    ? 'collecting'
    : localized?.gsc.impressions >= 100
      && localized?.gsc.clicks >= 5
      && actionCount >= 10
      ? 'eligible-for-expansion-review'
      : 'hold-and-learn';

const report = {
  source: 'localization-pilot-report',
  generatedAt,
  locale: pilot.locale,
  launchDate,
  daysLive,
  assessment,
  expansionReviewThresholds: {
    minimumDays: 42,
    localizedOrganicImpressions: 100,
    localizedOrganicClicks: 5,
    combinedCopiesSavesAndNewsletterClicks: 10,
    note: 'A human must also confirm at least one attributed newsletter subscription and no technical SEO regressions before expansion.',
  },
  windows,
  caveats: [
    'GA4 newsletter_cta_clicked measures the handoff to the newsletter; confirm completed subscriptions in Beehiiv using utm_campaign=pt-br-pilot.',
    'Compare localized pages with the matched English control set; raw all-site traffic is not an incremental baseline.',
    'Do not decide before six weeks unless there is a technical or quality failure.',
  ],
};

const formatNumber = new Intl.NumberFormat('en-US').format;
const primary = primaryWindow || {
  label: 'unavailable',
  localized: { ga4: { sessions: 0, engagedSessions: 0, events: {} }, gsc: { clicks: 0, impressions: 0, ctr: 0 } },
};
const markdown = `# pt-BR localization pilot report

- Generated: ${generatedAt}
- Launch date: ${launchDate || 'not set'}
- Days live: ${daysLive ?? 'not started'}
- Assessment: **${assessment}**
- Primary window: ${primary.label}

## Localized performance

- Organic impressions: ${formatNumber(primary.localized.gsc.impressions)}
- Organic clicks: ${formatNumber(primary.localized.gsc.clicks)}
- Organic CTR: ${(primary.localized.gsc.ctr * 100).toFixed(2)}%
- GA4 sessions: ${formatNumber(primary.localized.ga4.sessions)}
- Engaged sessions: ${formatNumber(primary.localized.ga4.engagedSessions)}
- Prompt copies: ${formatNumber(primary.localized.ga4.events.prompt_copied || 0)}
- Prompt saves: ${formatNumber(primary.localized.ga4.events.prompt_saved || 0)}
- Newsletter CTA clicks: ${formatNumber(primary.localized.ga4.events.newsletter_cta_clicked || 0)}

## Decision rule

Wait at least 42 days. Expansion becomes eligible for human review only after at least 100 localized organic impressions, 5 localized organic clicks, and 10 combined prompt copies, saves, and newsletter CTA clicks. Confirm at least one completed subscription in Beehiiv and verify there are no technical SEO regressions before adding another locale.
`;

writeJson(path.join(outputDir, 'localization-pilot-report.json'), report);
writeText(path.join(outputDir, 'localization-pilot-report.md'), markdown);
console.log(JSON.stringify({ ok: true, outputDir, assessment, windows: windows.length }, null, 2));
