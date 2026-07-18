import path from 'node:path';

import {
  classifySemrushError,
  fetchSemrushManagementJson,
  fetchSemrushProjectJson,
  getArtifactEnvelope,
  getSeoOutputDir,
  loadCompetitorDomains,
  loadSeedKeywords,
  normalizeText,
  numberValue,
  optionalEnv,
  parseCliArgs,
  readOptionalJson,
  rollupStatuses,
  uniqueBy,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const projectId = optionalEnv('SEMRUSH_PROJECT_ID');
const envCampaignId = optionalEnv('SEMRUSH_POSITION_TRACKING_CAMPAIGN_ID');
const ownTarget = optionalEnv('SEMRUSH_TARGET', 'aipromptindex.io');
const mode = args.mode || 'standard';
const allowSync = args.sync === 'true';
const allowRemovals = args['remove-stale'] === 'true';

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function pullOptionalArtifact(fileName) {
  return readOptionalJson(path.join(outputDir, fileName));
}

function buildSection(name, unitCostEstimate) {
  return {
    name,
    status: 'unknown',
    blockedReason: null,
    warnings: [],
    unitCostEstimate,
  };
}

function normalizeCampaignRows(response) {
  return toArray(response?.campaigns || response?.data || response).map((row) => ({
    campaignId: row.campaign_id || row.id || row.campaignId || '',
    projectId: row.project_id || row.projectId || '',
    device: row.device || '',
    searchEngine: row.search_engine || row.searchEngine || '',
    location: row.location || row.location_name || '',
    target: row.url || row.target || '',
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    competitors: Array.isArray(row.competitors) ? row.competitors : [],
    raw: row,
  }));
}

function normalizeTrackingRows(response) {
  return toArray(response?.data || response?.rows || response).map((row) => row);
}

function normalizeKeywordList(keywordItems = []) {
  return uniqueBy(
    keywordItems
      .map((keyword) => String(keyword || '').trim())
      .filter(Boolean),
    (value) => normalizeText(value),
  );
}

function deriveDesiredKeywords() {
  const seedKeywords = loadSeedKeywords();
  const rankSuggestions = pullOptionalArtifact('rank-tracker-suggestions.json');
  const keywordGaps = pullOptionalArtifact('keyword-gaps.json');
  const gscQueries = pullOptionalArtifact('gsc-queries.json');

  const gscCandidates = toArray(gscQueries?.ranges?.last28?.rows)
    .filter((row) => numberValue(row.impressions) >= 5)
    .sort((left, right) => numberValue(right.impressions) - numberValue(left.impressions))
    .slice(0, 20)
    .map((row) => row.key);

  const gapCandidates = toArray(keywordGaps?.gaps)
    .slice(0, 15)
    .map((row) => row.keyword);

  const suggestionCandidates = toArray(rankSuggestions?.suggestions)
    .slice(0, 20)
    .map((row) => row.keyword);

  return normalizeKeywordList([
    ...seedKeywords,
    ...gscCandidates,
    ...gapCandidates,
    ...suggestionCandidates,
  ]).slice(0, 50);
}

function deriveDesiredCompetitors() {
  return normalizeKeywordList(loadCompetitorDomains()).slice(0, 20);
}

async function fetchProjectSection(section, fn) {
  try {
    const data = await fn();
    section.status = 'ok';
    return data;
  } catch (error) {
    const classified = classifySemrushError(error);
    section.status = classified.status;
    section.blockedReason = classified.blockedReason;
    section.warnings.push(classified.message);
    return null;
  }
}

async function fetchTrackingReport(section, campaignId, type, params = {}) {
  return fetchProjectSection(section, async () => fetchSemrushProjectJson(`${campaignId}/tracking/`, {
    action: 'report',
    type,
    ...params,
  }));
}

async function syncKeywords(section, campaignId, desiredKeywords, currentKeywords) {
  if (!allowSync) {
    return {
      status: 'skipped',
      added: [],
      removed: [],
      reason: 'Keyword sync disabled. Re-run with --sync=true to apply Position Tracking keyword updates.',
    };
  }

  const desiredSet = new Set(desiredKeywords.map((keyword) => normalizeText(keyword)));
  const currentSet = new Set(currentKeywords.map((keyword) => normalizeText(keyword)));

  const toAdd = desiredKeywords.filter((keyword) => !currentSet.has(normalizeText(keyword)));
  const toRemove = allowRemovals
    ? currentKeywords.filter((keyword) => !desiredSet.has(normalizeText(keyword)))
    : [];

  try {
    if (toAdd.length > 0) {
      await fetchSemrushManagementJson(`${campaignId}/keywords`, {
        method: 'PUT',
        body: {
          keywords: toAdd.map((keyword) => ({ keyword })),
        },
      });
    }
    if (toRemove.length > 0) {
      await fetchSemrushManagementJson(`${campaignId}/keywords`, {
        method: 'DELETE',
        body: {
          keywords: toRemove.map((keyword) => ({ keyword })),
        },
      });
    }

    return {
      status: 'ok',
      added: toAdd,
      removed: toRemove,
      reason: null,
    };
  } catch (error) {
    const classified = classifySemrushError(error);
    section.warnings.push(`keyword sync: ${classified.message}`);
    return {
      status: classified.status,
      blockedReason: classified.blockedReason,
      added: toAdd,
      removed: toRemove,
      reason: classified.message,
    };
  }
}

async function syncCompetitors(section, campaignId, desiredCompetitors, currentCompetitors) {
  if (!allowSync) {
    return {
      status: 'skipped',
      added: [],
      removed: [],
      reason: 'Competitor sync disabled. Re-run with --sync=true to apply Position Tracking competitor updates.',
    };
  }

  const desiredSet = new Set(desiredCompetitors.map((domain) => normalizeText(domain)));
  const currentSet = new Set(currentCompetitors.map((domain) => normalizeText(domain)));

  const toAdd = desiredCompetitors.filter((domain) => !currentSet.has(normalizeText(domain)));
  const toRemove = allowRemovals
    ? currentCompetitors.filter((domain) => !desiredSet.has(normalizeText(domain)))
    : [];

  try {
    if (toAdd.length > 0) {
      await fetchSemrushManagementJson(`${campaignId}/competitors`, {
        method: 'PUT',
        body: { competitors: toAdd },
      });
    }
    if (toRemove.length > 0) {
      await fetchSemrushManagementJson(`${campaignId}/competitors`, {
        method: 'DELETE',
        body: { competitors: toRemove },
      });
    }

    return {
      status: 'ok',
      added: toAdd,
      removed: toRemove,
      reason: null,
    };
  } catch (error) {
    const classified = classifySemrushError(error);
    section.warnings.push(`competitor sync: ${classified.message}`);
    return {
      status: classified.status,
      blockedReason: classified.blockedReason,
      added: toAdd,
      removed: toRemove,
      reason: classified.message,
    };
  }
}

async function main() {
  const generatedAt = new Date().toISOString();

  if (!projectId) {
    const reason = 'SEMRUSH_PROJECT_ID not set. Create a project in Semrush UI and add the ID to .env.';
    const output = getArtifactEnvelope({
      source: 'semrush-api',
      generatedAt,
      status: 'misconfigured',
      blockedReason: null,
      unitCostEstimate: {
        siteAudit: 300,
        positionTrackingReports: 500,
        siteAuditHistory: mode === 'full' ? 10000 : 0,
        keywordSync: allowSync ? 'variable' : 0,
      },
      endpoint: 'projects',
      projectId: null,
      reason,
      campaigns: { status: 'skipped', warnings: [reason] },
      siteAudit: { status: 'skipped', warnings: [reason] },
      positionTracking: { status: 'skipped', warnings: [reason] },
      manualOnly: {
        status: 'ok',
        actionQueue: [
          'Keep Semrush On-Page SEO Checker and Link Building Tool manual until an official public API surface is confirmed.',
        ],
      },
    });
    writeJson(path.join(outputDir, 'semrush-projects.json'), output);
    console.log(JSON.stringify({ ok: true, skipped: true, reason }, null, 2));
    return;
  }

  const campaignsSection = buildSection('campaigns', 100);
  const siteAuditSection = buildSection('siteAudit', mode === 'full' ? 10600 : 1300);
  const positionTrackingSection = buildSection('positionTracking', allowSync ? 'variable' : 500);
  const manualOnly = {
    status: 'ok',
    actionQueue: [
      'Semrush On-Page SEO Checker remains manual/UI-assisted until a stable public API path is verified.',
      'Semrush Link Building Tool remains manual/UI-assisted until a stable public API path is verified.',
      'If Semrush analytics units are zero, continue running Projects API pulls and skip Analytics API calls.',
    ],
  };

  let discoveredCampaigns = [];
  const campaignsResponse = await fetchProjectSection(campaignsSection, async () => (
    fetchSemrushManagementJson(`${projectId}/tracking/campaigns`)
  ));
  if (campaignsResponse) {
    discoveredCampaigns = normalizeCampaignRows(campaignsResponse);
  }

  let activeCampaignId = envCampaignId;
  let activeCampaignSource = envCampaignId ? 'env' : 'api';

  if (!activeCampaignId && discoveredCampaigns.length > 0) {
    activeCampaignId = discoveredCampaigns[0].campaignId;
    activeCampaignSource = 'api';
  }

  if (activeCampaignId && !String(activeCampaignId).includes('_')) {
    campaignsSection.warnings.push(
      `Position Tracking campaign ID "${activeCampaignId}" does not contain a project/campaign suffix. Semrush campaign IDs typically look like "<projectId>_<campaignSuffix>".`,
    );
  }

  const campaignMetadata = discoveredCampaigns.find((campaign) => campaign.campaignId === activeCampaignId) || null;

  const siteAuditInfo = await fetchProjectSection(siteAuditSection, async () => (
    fetchSemrushProjectJson(`${projectId}/siteaudit/info`)
  ));
  const siteAuditIssuesResponse = await fetchProjectSection(siteAuditSection, async () => (
    fetchSemrushProjectJson(`${projectId}/siteaudit/issues`, { limit: 100 })
  ));
  const siteAuditPagesResponse = await fetchProjectSection(siteAuditSection, async () => (
    fetchSemrushProjectJson(`${projectId}/siteaudit/page/list`, { limit: 200 })
  ));

  let pageLookup = null;
  if (siteAuditSection.status === 'ok') {
    pageLookup = await fetchProjectSection(siteAuditSection, async () => (
      fetchSemrushProjectJson(`${projectId}/siteaudit/page/list`, { url: ownTarget, limit: 1 })
    ));
  }

  const lookedUpPage = normalizeTrackingRows(pageLookup).find(Boolean) || normalizeTrackingRows(siteAuditPagesResponse).find(Boolean) || null;
  let pageDetails = null;
  if (lookedUpPage?.id || lookedUpPage?.page_id) {
    const pageId = lookedUpPage.id || lookedUpPage.page_id;
    pageDetails = await fetchProjectSection(siteAuditSection, async () => (
      fetchSemrushProjectJson(`${projectId}/siteaudit/page/${pageId}`)
    ));
  }

  let history = null;
  if (mode === 'full') {
    history = await fetchProjectSection(siteAuditSection, async () => (
      fetchSemrushProjectJson(`${projectId}/siteaudit/history`, { limit: 4, offset: 0 })
    ));
  } else {
    siteAuditSection.warnings.push('Site Audit history skipped in standard mode. Re-run with --mode=full to fetch historical snapshots.');
  }

  let snapshots = null;
  if (mode === 'full') {
    snapshots = await fetchProjectSection(siteAuditSection, async () => (
      fetchSemrushProjectJson(`${projectId}/siteaudit/snapshots`, { limit: 4 })
    ));
  }

  let positionOverview = null;
  let positionDates = null;
  let positionRows = [];
  let visibilityRows = [];
  let landingPages = [];
  let competitors = [];
  let aiOverviewRows = [];
  let keywordSync = { status: 'skipped', added: [], removed: [], reason: 'No active campaign ID available.' };
  let competitorSync = { status: 'skipped', added: [], removed: [], reason: 'No active campaign ID available.' };

  if (!activeCampaignId) {
    positionTrackingSection.status = 'misconfigured';
    positionTrackingSection.warnings.push('No Position Tracking campaign ID available via env or campaign discovery.');
  } else {
    positionDates = await fetchTrackingReport(positionTrackingSection, activeCampaignId, 'tracking_campaign_dates');
    positionOverview = await fetchTrackingReport(positionTrackingSection, activeCampaignId, 'tracking_overview_organic');
    const positionsResponse = await fetchTrackingReport(positionTrackingSection, activeCampaignId, 'tracking_position_organic');
    const visibilityResponse = await fetchTrackingReport(positionTrackingSection, activeCampaignId, 'tracking_visibility_organic');
    const landingPagesResponse = await fetchTrackingReport(positionTrackingSection, activeCampaignId, 'tracking_landing_pages_organic', {
      url: ownTarget,
    });
    const competitorsResponse = await fetchTrackingReport(positionTrackingSection, activeCampaignId, 'tracking_competitors_organic', {
      url: ownTarget,
      main_domain: ownTarget,
      url_type: 'rootdomain',
    });
    const aiOverviewResponse = await fetchTrackingReport(positionTrackingSection, activeCampaignId, 'tracking_position_organic', {
      serp_feature_filter: 'aio',
    });

    positionRows = normalizeTrackingRows(positionsResponse);
    visibilityRows = normalizeTrackingRows(visibilityResponse);
    landingPages = normalizeTrackingRows(landingPagesResponse);
    competitors = normalizeTrackingRows(competitorsResponse);
    aiOverviewRows = normalizeTrackingRows(aiOverviewResponse);

    const currentKeywords = positionRows.map((row) => row.Ph || row.keyword || '').filter(Boolean);
    const currentCompetitors = normalizeKeywordList([
      ...(campaignMetadata?.competitors || []),
      ...competitors.map((row) => row.Dn || row.domain || ''),
    ]);

    const desiredKeywords = deriveDesiredKeywords();
    const desiredCompetitors = deriveDesiredCompetitors();

    keywordSync = await syncKeywords(positionTrackingSection, activeCampaignId, desiredKeywords, normalizeKeywordList(currentKeywords));
    competitorSync = await syncCompetitors(positionTrackingSection, activeCampaignId, desiredCompetitors, currentCompetitors);

    if (positionTrackingSection.status === 'unknown' && positionRows.length > 0) {
      positionTrackingSection.status = 'ok';
    }
  }

  const sectionStatuses = [campaignsSection.status, siteAuditSection.status, positionTrackingSection.status];
  const blockedSection = [campaignsSection, siteAuditSection, positionTrackingSection]
    .find((section) => section.status === 'blocked' && section.blockedReason);
  const hasOkSection = sectionStatuses.includes('ok');

  const output = getArtifactEnvelope({
    source: 'semrush-api',
    endpoint: 'projects',
    generatedAt,
    status: blockedSection && !hasOkSection
      ? 'blocked'
      : rollupStatuses(sectionStatuses),
    blockedReason: blockedSection?.blockedReason || null,
    unitCostEstimate: {
      siteAudit: siteAuditSection.unitCostEstimate,
      campaigns: campaignsSection.unitCostEstimate,
      positionTracking: positionTrackingSection.unitCostEstimate,
    },
    projectId,
    campaigns: {
      status: campaignsSection.status,
      blockedReason: campaignsSection.blockedReason,
      warnings: campaignsSection.warnings,
      discovered: discoveredCampaigns,
      activeCampaignId,
      activeCampaignSource,
      envCampaignId,
      metadata: campaignMetadata,
    },
    siteAudit: {
      status: siteAuditSection.status,
      blockedReason: siteAuditSection.blockedReason,
      warnings: siteAuditSection.warnings,
      health: siteAuditInfo ? {
        errors: numberValue(siteAuditInfo.errors),
        warnings: numberValue(siteAuditInfo.warnings),
        notices: numberValue(siteAuditInfo.notices),
        broken: numberValue(siteAuditInfo.broken),
        blocked: numberValue(siteAuditInfo.blocked),
        redirected: numberValue(siteAuditInfo.redirected),
        healthy: numberValue(siteAuditInfo.healthy),
        haveIssues: numberValue(siteAuditInfo.haveIssues),
        pagesCrawled: numberValue(siteAuditInfo.pages_crawled),
        pagesLimit: numberValue(siteAuditInfo.pages_limit),
        status: siteAuditInfo.status || '',
        lastAudit: siteAuditInfo.last_audit || null,
      } : null,
      issues: normalizeTrackingRows(siteAuditIssuesResponse),
      pages: normalizeTrackingRows(siteAuditPagesResponse),
      pageLookup: normalizeTrackingRows(pageLookup),
      pageDetails,
      snapshots: normalizeTrackingRows(snapshots),
      history: normalizeTrackingRows(history),
    },
    positionTracking: {
      status: positionTrackingSection.status,
      blockedReason: positionTrackingSection.blockedReason,
      warnings: positionTrackingSection.warnings,
      campaignId: activeCampaignId,
      overview: positionOverview,
      dates: normalizeTrackingRows(positionDates),
      positions: positionRows,
      visibility: visibilityRows,
      landingPages,
      competitors,
      aiOverviewPositions: aiOverviewRows,
      syncPlan: {
        desiredKeywords: deriveDesiredKeywords(),
        desiredCompetitors: deriveDesiredCompetitors(),
        keywordSync,
        competitorSync,
      },
    },
    manualOnly,
  });

  writeJson(path.join(outputDir, 'semrush-projects.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    status: output.status,
    projectId,
    activeCampaignId,
    sections: {
      campaigns: output.campaigns.status,
      siteAudit: output.siteAudit.status,
      positionTracking: output.positionTracking.status,
    },
    warnings: [
      ...output.campaigns.warnings,
      ...output.siteAudit.warnings,
      ...output.positionTracking.warnings,
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
