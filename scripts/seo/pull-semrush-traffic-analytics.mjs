import path from 'node:path';

import {
  fetchSemrushRows,
  fetchSemrushAnalyticsRows,
  getArtifactEnvelope,
  getSeoOutputDir,
  loadCompetitorDomains,
  numberValue,
  optionalEnv,
  parseCliArgs,
  writeJson,
} from './_shared.mjs';

// NOTE: Semrush Trends API (traffic_summary, traffic_sources, audience_overlap) is sold as a
// separate add-on. When not subscribed, API returns ERROR :: NOT ENOUGH CREDITS or similar.
// This script tries Trends endpoints and degrades gracefully to domain_ranks cohort if unavailable.

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const database = optionalEnv('SEMRUSH_DATABASE', 'us');
const ownTarget = optionalEnv('SEMRUSH_TARGET', 'aipromptindex.io');
const competitors = loadCompetitorDomains();
const targets = [ownTarget, ...competitors].slice(0, 20);

async function tryTrends(reportType, params) {
  return fetchSemrushAnalyticsRows(reportType, params);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  // Fallback: basic cohort via domain_ranks (Domain Analytics API; always available)
  const cohort = [];
  for (const target of targets) {
    try {
      const rows = await fetchSemrushRows('domain_ranks', {
        domain: target,
        database,
        export_columns: 'Dn,Rk,Or,Ot,Oc,Ad,At,Ac',
      });
      const row = rows[0] || {};
      cohort.push({
        domain: target,
        rank: numberValue(row.Rank),
        organicKeywords: numberValue(row['Organic Keywords']),
        organicTraffic: numberValue(row['Organic Traffic']),
        organicCost: numberValue(row['Organic Cost']),
        adwordsKeywords: numberValue(row['Adwords Keywords']),
        adwordsTraffic: numberValue(row['Adwords Traffic']),
        adwordsCost: numberValue(row['Adwords Cost']),
      });
    } catch (error) {
      warnings.push(`cohort ${target}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Attempt Trends API (may fail if plan lacks Trends)
  let trafficSummary = [];
  try {
    const rows = await tryTrends('traffic_summary', {
      targets: targets.join(','),
      display_date: 'current',
      export_columns: 'target,visits,users,direct,referral,social,search,paid,mail,display_ad,desktop_share,mobile_share',
    });
    trafficSummary = rows.map((row) => ({
      target: row.target || '',
      visits: numberValue(row.visits),
      users: numberValue(row.users),
      direct: numberValue(row.direct),
      referral: numberValue(row.referral),
      social: numberValue(row.social),
      search: numberValue(row.search),
      paid: numberValue(row.paid),
      mail: numberValue(row.mail),
      displayAd: numberValue(row.display_ad),
      desktopShare: numberValue(row.desktop_share),
      mobileShare: numberValue(row.mobile_share),
    }));
  } catch (error) {
    warnings.push(`traffic_summary (Trends API add-on required): ${error instanceof Error ? error.message : String(error)}`);
  }

  let audienceOverlap = [];
  try {
    const rows = await tryTrends('audience_overlap', {
      target: ownTarget,
      display_date: 'current',
      export_columns: 'target,domain,overlap_score,affinity_index',
    });
    audienceOverlap = rows.map((row) => ({
      domain: row.domain || '',
      overlapScore: numberValue(row.overlap_score),
      affinityIndex: numberValue(row.affinity_index),
    }));
  } catch (error) {
    warnings.push(`audience_overlap (Trends API add-on required): ${error instanceof Error ? error.message : String(error)}`);
  }

  const blockedByUnits = warnings.some((warning) => /API UNITS BALANCE IS ZERO/i.test(warning));
  const trendsUnavailable = warnings.some((warning) => /Trends API add-on required/i.test(warning));

  writeJson(path.join(outputDir, 'semrush-traffic-analytics.json'), getArtifactEnvelope({
    source: 'semrush-api',
    endpoint: 'traffic-analytics',
    status: blockedByUnits ? 'blocked' : (cohort.length > 0 || trafficSummary.length > 0 || audienceOverlap.length > 0 ? 'ok' : 'unknown'),
    blockedReason: blockedByUnits ? 'semrush_api_units_zero' : null,
    unitCostEstimate: {
      cohort: targets.length * 5,
      trends: trendsUnavailable ? 0 : 'variable',
    },
    database,
    generatedAt,
    warnings,
    targets,
    cohort,
    trafficSummary,
    audienceOverlap,
  }));

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    warnings,
    rows: {
      cohort: cohort.length,
      trafficSummary: trafficSummary.length,
      audienceOverlap: audienceOverlap.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
