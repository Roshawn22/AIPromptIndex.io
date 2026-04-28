import path from 'node:path';

import {
  classifyAhrefsError,
  fetchAhrefsJson,
  getArtifactEnvelope,
  getPreviousSeoOutputDir,
  getSeoOutputDir,
  numberValue,
  optionalEnv,
  parseCliArgs,
  readOptionalJson,
  rollupStatuses,
  toIsoDate,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const projectId = optionalEnv('AHREFS_RANK_TRACKER_PROJECT_ID');
const device = optionalEnv('AHREFS_RANK_TRACKER_DEVICE', 'desktop');
const country = optionalEnv('AHREFS_COUNTRY', 'us');
const date = args.date || toIsoDate(new Date());

async function fetchSerpOverview(keyword) {
  const response = await fetchAhrefsJson('rank-tracker/serp-overview', {
    project_id: projectId,
    date,
    country,
    device,
    keyword,
    select: 'position,title,url,type,domain_rating,url_rating,backlinks,refdomains,traffic,keywords,top_keyword,top_keyword_volume,page_type',
    limit: 10,
  });
  return {
    keyword,
    positions: response?.positions || response?.rows || [],
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const overviewSection = {
    status: 'unknown',
    blockedReason: null,
    warnings: [],
  };
  const competitorsSection = {
    status: 'unknown',
    blockedReason: null,
    warnings: [],
  };
  const serpSection = {
    status: 'unknown',
    blockedReason: null,
    warnings: [],
  };

  if (!projectId) {
    const reason = 'AHREFS_RANK_TRACKER_PROJECT_ID not set. Create a Rank Tracker project in Ahrefs UI and add the ID to .env.';
    const output = getArtifactEnvelope({
      source: 'ahrefs-api-v3',
      endpoint: 'rank-tracker',
      generatedAt,
      status: 'misconfigured',
      unitCostEstimate: { overview: 50, competitorsStats: 50, serpOverview: 250 },
      projectId: null,
      device,
      country,
      date,
      reason,
      warnings: [reason],
      keywordPositions: [],
      competitorStats: [],
      serpOverview: [],
      movement: { winners: [], losers: [] },
      summary: null,
    });
    writeJson(path.join(outputDir, 'ahrefs-rank-tracker.json'), output);
    console.log(JSON.stringify({ ok: true, skipped: true, reason }, null, 2));
    return;
  }

  let keywordPositions = [];
  try {
    const response = await fetchAhrefsJson('rank-tracker/overview', {
      project_id: projectId,
      date,
      country,
      device,
      select: 'keyword,url,position,keyword_difficulty,traffic,cost_per_click,volume,volume_desktop_pct,volume_mobile_pct,serp_features,parent_topic,location,is_commercial,is_navigational,is_transactional,target_positions_count',
      limit: 500,
    });
    const rows = Array.isArray(response?.overviews) ? response.overviews
      : Array.isArray(response?.rows) ? response.rows : [];
    keywordPositions = rows.map((row) => ({
      keyword: row.keyword || '',
      url: row.url || '',
      position: row.position === null ? null : numberValue(row.position),
      keywordDifficulty: numberValue(row.keyword_difficulty, null),
      traffic: numberValue(row.traffic),
      cpc: numberValue(row.cost_per_click, null),
      volume: numberValue(row.volume, null),
      volumeDesktopPct: numberValue(row.volume_desktop_pct, null),
      volumeMobilePct: numberValue(row.volume_mobile_pct, null),
      serpFeatures: Array.isArray(row.serp_features) ? row.serp_features : [],
      parentTopic: row.parent_topic || '',
      location: row.location || country,
      isCommercial: !!row.is_commercial,
      isNavigational: !!row.is_navigational,
      isTransactional: !!row.is_transactional,
      targetPositionsCount: numberValue(row.target_positions_count),
    }));
    overviewSection.status = 'ok';
  } catch (error) {
    const classified = classifyAhrefsError(error);
    overviewSection.status = classified.status;
    overviewSection.blockedReason = classified.blockedReason;
    overviewSection.warnings.push(classified.message);
  }

  let competitorStats = [];
  try {
    const response = await fetchAhrefsJson('rank-tracker/competitors-stats', {
      project_id: projectId,
      date,
      country,
      device,
      select: 'competitor,share_of_voice,traffic,average_position,pos_1_3,pos_4_10,pos_11_20,pos_21_50,pos_51_plus,pos_no_rank',
      limit: 10,
    });
    competitorStats = (response?.['competitors-metrics'] || response?.rows || []).map((row) => ({
      competitor: row.competitor || '',
      shareOfVoice: numberValue(row.share_of_voice, null),
      traffic: numberValue(row.traffic, null),
      averagePosition: numberValue(row.average_position, null),
      pos1To3: numberValue(row.pos_1_3),
      pos4To10: numberValue(row.pos_4_10),
      pos11To20: numberValue(row.pos_11_20),
      pos21To50: numberValue(row.pos_21_50),
      pos51Plus: numberValue(row.pos_51_plus),
      posNoRank: numberValue(row.pos_no_rank),
    }));
    competitorsSection.status = 'ok';
  } catch (error) {
    const classified = classifyAhrefsError(error);
    competitorsSection.status = classified.status;
    competitorsSection.blockedReason = classified.blockedReason;
    competitorsSection.warnings.push(classified.message);
  }

  let serpOverview = [];
  const serpTargets = [...keywordPositions]
    .sort((left, right) => numberValue(right.volume) - numberValue(left.volume))
    .slice(0, 5)
    .map((row) => row.keyword)
    .filter(Boolean);

  if (serpTargets.length > 0) {
    try {
      serpOverview = await Promise.all(serpTargets.map((keyword) => fetchSerpOverview(keyword)));
      serpSection.status = 'ok';
    } catch (error) {
      const classified = classifyAhrefsError(error);
      serpSection.status = classified.status;
      serpSection.blockedReason = classified.blockedReason;
      serpSection.warnings.push(classified.message);
    }
  } else {
    serpSection.status = 'skipped';
    serpSection.warnings.push('SERP overview skipped because no tracked keywords were returned.');
  }

  const previousOutputDir = getPreviousSeoOutputDir(path.basename(outputDir));
  const previousRankTracker = previousOutputDir
    ? readOptionalJson(path.join(previousOutputDir, 'ahrefs-rank-tracker.json'))
    : null;

  const previousByKeyword = new Map(
    (previousRankTracker?.keywordPositions || []).map((row) => [row.keyword, row]),
  );

  const movementRows = keywordPositions
    .map((row) => {
      const previous = previousByKeyword.get(row.keyword);
      if (!previous) return null;

      const currentPosition = row.position ?? 101;
      const previousPosition = previous.position ?? 101;
      const positionDiff = previousPosition - currentPosition;

      return {
        keyword: row.keyword,
        position: row.position,
        previousPosition: previous.position,
        positionDiff,
        volume: row.volume,
        traffic: row.traffic,
      };
    })
    .filter(Boolean)
    .sort((left, right) => Math.abs(right.positionDiff) - Math.abs(left.positionDiff));

  const movement = {
    winners: movementRows.filter((row) => row.positionDiff > 0).slice(0, 10),
    losers: movementRows.filter((row) => row.positionDiff < 0).slice(0, 10),
  };

  const ranked = keywordPositions.filter((row) => row.position !== null);
  const avgPosition = ranked.length > 0
    ? ranked.reduce((sum, row) => sum + row.position, 0) / ranked.length
    : null;
  const totalTraffic = keywordPositions.reduce((sum, row) => sum + numberValue(row.traffic), 0);
  const ownCompetitorRow = competitorStats.find((row) => row.competitor?.includes('aipromptindex.io')) || null;

  const output = getArtifactEnvelope({
    source: 'ahrefs-api-v3',
    endpoint: 'rank-tracker',
    generatedAt,
    status: rollupStatuses(overviewSection.status, competitorsSection.status, serpSection.status),
    unitCostEstimate: {
      overview: 50,
      competitorsStats: 50,
      serpOverview: serpTargets.length * 50,
    },
    projectId,
    device,
    country,
    date,
    warnings: [
      ...overviewSection.warnings,
      ...competitorsSection.warnings,
      ...serpSection.warnings,
    ],
    keywordPositions,
    competitorStats,
    serpOverview,
    movement,
    overview: {
      visibility: ownCompetitorRow?.shareOfVoice ?? (keywordPositions.length > 0 ? ranked.length / keywordPositions.length : 0),
      traffic: ownCompetitorRow?.traffic ?? totalTraffic,
      averagePosition: ownCompetitorRow?.averagePosition ?? avgPosition,
    },
    summary: {
      totalKeywords: keywordPositions.length,
      rankedKeywords: ranked.length,
      unrankedKeywords: keywordPositions.length - ranked.length,
      avgPosition,
      totalTraffic,
      previousDate: previousOutputDir ? path.basename(previousOutputDir) : null,
    },
  });

  writeJson(path.join(outputDir, 'ahrefs-rank-tracker.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    projectId,
    status: output.status,
    summary: output.summary,
    competitors: competitorStats.length,
    serpOverviewKeywords: serpOverview.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
