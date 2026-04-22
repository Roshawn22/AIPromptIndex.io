import fs from 'node:fs';
import path from 'node:path';

import {
  classifyAhrefsError,
  getAhrefsLimitsAndUsage,
  getArtifactEnvelope,
  getPreviousSeoOutputDir,
  getSemrushApiUnitsBalance,
  getSeoOutputDir,
  parseCliArgs,
  readOptionalJson,
  rollupStatuses,
  summarizeSeoWorkflowGates,
  writeJson,
  writeText,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const repoRoot = process.cwd();
const dotenvFiles = ['.env.local', '.env'];

const localPipelineChecks = [
  { name: 'AHREFS_API_TOKEN', label: 'Ahrefs API token', required: true },
  { name: 'SEMRUSH_API_KEY', label: 'Semrush API key (optional)', required: false },
  { name: 'GOOGLE_ANALYTICS_PROPERTY_ID', label: 'GA4 property ID', required: true },
  { name: 'GOOGLE_SERVICE_ACCOUNT_JSON', label: 'Google service account JSON', required: true },
  {
    name: 'GOOGLE_SEARCH_CONSOLE_PROPERTY',
    label: 'GSC property',
    aliases: ['GOOGLE_SEARCH_CONSOLE_SITE'],
    required: true,
  },
];

const optionalProjectChecks = [
  { name: 'AHREFS_SITE_AUDIT_PROJECT_ID', label: 'Ahrefs Site Audit project ID' },
  { name: 'AHREFS_RANK_TRACKER_PROJECT_ID', label: 'Ahrefs Rank Tracker project ID' },
  { name: 'SEMRUSH_PROJECT_ID', label: 'Semrush project ID' },
  { name: 'SEMRUSH_POSITION_TRACKING_CAMPAIGN_ID', label: 'Semrush Position Tracking campaign ID' },
  { name: 'SEMRUSH_SITE_AUDIT_CAMPAIGN_ID', label: 'Semrush Site Audit campaign ID' },
  { name: 'SEMRUSH_ONPAGE_CAMPAIGN_ID', label: 'Semrush On-Page campaign ID' },
];

const publicSiteEnvChecks = [
  { name: 'PUBLIC_GOOGLE_SITE_VERIFICATION', label: 'Google verification tag' },
  { name: 'PUBLIC_AHREFS_SITE_VERIFICATION', label: 'Ahrefs verification tag' },
  { name: 'PUBLIC_GA_MEASUREMENT_ID', label: 'GA measurement ID' },
  { name: 'PUBLIC_SITE_URL', label: 'Canonical site URL' },
];

function parseDotenvFile(filePath) {
  if (!fs.existsSync(filePath)) return new Map();

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const vars = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    vars.set(name, rawValue.trim());
  }

  return vars;
}

function loadDotenvSources() {
  return dotenvFiles
    .map((fileName) => {
      const filePath = path.join(repoRoot, fileName);
      const vars = parseDotenvFile(filePath);
      return vars.size > 0 ? { fileName, vars } : null;
    })
    .filter(Boolean);
}

function findConfigSource(name, aliases = [], dotenvSources = []) {
  const candidates = [name, ...aliases];

  for (const candidate of candidates) {
    if (process.env[candidate]?.trim()) {
      return { configured: true, configuredAs: candidate, source: 'process.env' };
    }
  }

  for (const dotenvSource of dotenvSources) {
    for (const candidate of candidates) {
      const value = dotenvSource.vars.get(candidate);
      if (value && value !== '""' && value !== "''") {
        return { configured: true, configuredAs: candidate, source: dotenvSource.fileName };
      }
    }
  }

  return { configured: false, configuredAs: name, source: null };
}

function toStatusCheck(check, result) {
  return {
    ...check,
    ...result,
    status: result.configured ? 'ok' : (check.required ? 'misconfigured' : 'skipped'),
    reason: result.configured ? null : (check.required ? `${check.name} is not configured` : `${check.name} is optional and not configured`),
  };
}

function loadLatestLiveVerification() {
  const currentReport = readOptionalJson(path.join(outputDir, 'live-verification.json'));
  if (currentReport) return { sourceDate: path.basename(outputDir), report: currentReport };

  const previousOutputDir = getPreviousSeoOutputDir(path.basename(outputDir));
  if (!previousOutputDir) return null;
  const previousReport = readOptionalJson(path.join(previousOutputDir, 'live-verification.json'));
  if (!previousReport) return null;
  return { sourceDate: path.basename(previousOutputDir), report: previousReport };
}

async function probeAhrefsProject(token, projectId, kind) {
  if (!projectId) {
    return { status: 'skipped', checked: false, message: 'Project ID not configured.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const endpoint = kind === 'siteAudit'
    ? `https://api.ahrefs.com/v3/site-audit/issues?project_id=${projectId}&limit=1`
    : `https://api.ahrefs.com/v3/rank-tracker/overview?project_id=${projectId}&date=${today}&device=desktop&country=us&select=${encodeURIComponent('keyword,position')}&limit=1`;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();
    if (!response.ok) {
      const classified = classifyAhrefsError(text);
      return {
        status: /not found|missing/i.test(text) ? 'misconfigured' : classified.status,
        blockedReason: /not found|missing/i.test(text) ? null : classified.blockedReason,
        checked: true,
        message: text.slice(0, 200),
      };
    }
    return { status: 'ok', checked: true, message: null };
  } catch (error) {
    const classified = classifyAhrefsError(error);
    return {
      status: classified.status,
      blockedReason: classified.blockedReason,
      checked: true,
      message: classified.message,
    };
  }
}

async function probeSemrushSiteAudit(projectId, apiKey) {
  if (!projectId) {
    return { status: 'skipped', checked: false, message: 'Project ID not configured.' };
  }

  try {
    const url = new URL(`https://api.semrush.com/reports/v1/projects/${projectId}/siteaudit/page/list`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('limit', '1');
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) {
      return {
        status: /API units balance is zero/i.test(text) ? 'blocked' : 'misconfigured',
        checked: true,
        message: text.slice(0, 200),
      };
    }
    return { status: 'ok', checked: true, message: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'unknown', checked: true, message };
  }
}

function renderMarkdown(report) {
  const lines = [
    '# SEO Setup Verification',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Overall status: ${report.summary.overallStatus}`,
    `- Ahrefs API: ${report.summary.sources.ahrefsApi}`,
    `- Semrush analytics (optional): ${report.summary.sources.semrushAnalytics}`,
    `- Semrush projects (optional): ${report.summary.sources.semrushProjects}`,
    `- Public site env: ${report.summary.sources.publicSiteEnv}`,
    `- Blocked endpoints: ${report.summary.blockedEndpoints.join(', ') || 'none'}`,
    `- Misconfigured sources: ${report.summary.misconfiguredSources.join(', ') || 'none'}`,
    '',
    '## Workflow Gates',
    '',
    `- Ahrefs pulls allowed: ${report.summary.workflowGates.canRunAhrefs ? 'yes' : 'no'}`,
    `- Semrush analytics pulls allowed (optional): ${report.summary.workflowGates.canRunSemrushAnalytics ? 'yes' : 'no'}`,
    `- Semrush projects pulls allowed (optional): ${report.summary.workflowGates.canRunSemrushProjects ? 'yes' : 'no'}`,
    `- Semrush position tracking pulls allowed (optional): ${report.summary.workflowGates.canRunSemrushPositionTracking ? 'yes' : 'no'}`,
    '',
    '## Local Pipeline Env',
    '',
  ];

  for (const check of report.localPipeline) {
    lines.push(`- ${check.label}: ${check.status}${check.source ? ` via ${check.source}` : ''}`);
  }

  lines.push('', '## Optional Project Config', '');

  for (const check of report.optionalProjects) {
    lines.push(`- ${check.label}: ${check.status}${check.source ? ` via ${check.source}` : ''}`);
  }

  lines.push('', '## Public Site Env', '');

  for (const check of report.publicSiteEnv) {
    const reason = check.reason ? ` — ${check.reason}` : '';
    lines.push(`- ${check.label}: ${check.status}${check.source ? ` via ${check.source}` : ''}${reason}`);
  }

  lines.push('', '## Live Probes', '');

  for (const [name, probe] of Object.entries(report.liveProbes)) {
    const detail = probe.message ? ` — ${probe.message}` : '';
    const units = probe.unitsRemaining !== undefined && probe.unitsRemaining !== null
      ? ` (units remaining: ${probe.unitsRemaining})`
      : '';
    lines.push(`- ${name}: ${probe.status}${units}${detail}`);
  }

  if (report.latestLiveVerification) {
    lines.push('', '## Latest Live Verification', '');
    lines.push(`- Source date: ${report.latestLiveVerification.sourceDate}`);
    lines.push(`- Homepage issues: ${report.latestLiveVerification.report?.homepage?.missingChecks?.join(', ') || 'none'}`);
    lines.push(`- Sample pages checked: ${report.latestLiveVerification.report?.pages?.length || 0}`);
  }

  if (report.warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  const generatedAt = new Date().toISOString();
  const dotenvSources = loadDotenvSources();

  for (const { vars } of dotenvSources) {
    for (const [name, value] of vars.entries()) {
      if (!process.env[name] && value) process.env[name] = value.replace(/^["']|["']$/g, '');
    }
  }

  const localPipeline = localPipelineChecks.map((check) => (
    toStatusCheck(check, findConfigSource(check.name, check.aliases || [], dotenvSources))
  ));

  const optionalProjects = optionalProjectChecks.map((check) => (
    toStatusCheck({ ...check, required: false }, findConfigSource(check.name, check.aliases || [], dotenvSources))
  ));

  const latestLiveVerification = loadLatestLiveVerification();
  const publicSiteEnv = publicSiteEnvChecks.map((check) => {
    const result = findConfigSource(check.name, check.aliases || [], dotenvSources);
    return {
      ...check,
      status: result.configured ? 'ok' : 'misconfigured',
      configured: result.configured,
      configuredAs: result.configuredAs,
      source: result.source,
      reason: result.configured
        ? null
        : latestLiveVerification
          ? `${check.name} is not configured in local env or CI. Live verification exists, so confirm the deployed public value there if needed.`
          : `${check.name} is not configured in local env or CI.`,
    };
  });

  const liveProbes = {};

  if (process.env.AHREFS_API_TOKEN) {
    liveProbes.ahrefsApi = await getAhrefsLimitsAndUsage(process.env.AHREFS_API_TOKEN);
    liveProbes.ahrefsSiteAudit = await probeAhrefsProject(
      process.env.AHREFS_API_TOKEN,
      process.env.AHREFS_SITE_AUDIT_PROJECT_ID,
      'siteAudit',
    );
    liveProbes.ahrefsRankTracker = await probeAhrefsProject(
      process.env.AHREFS_API_TOKEN,
      process.env.AHREFS_RANK_TRACKER_PROJECT_ID,
      'rankTracker',
    );
  } else {
    liveProbes.ahrefsApi = { status: 'misconfigured', message: 'AHREFS_API_TOKEN missing.' };
    liveProbes.ahrefsSiteAudit = { status: 'skipped', message: 'Ahrefs API token missing.' };
    liveProbes.ahrefsRankTracker = { status: 'skipped', message: 'Ahrefs API token missing.' };
  }

  if (process.env.SEMRUSH_API_KEY) {
    liveProbes.semrushAnalytics = await getSemrushApiUnitsBalance(process.env.SEMRUSH_API_KEY);
    liveProbes.semrushProjects = await probeSemrushSiteAudit(
      process.env.SEMRUSH_PROJECT_ID,
      process.env.SEMRUSH_API_KEY,
    );
    liveProbes.semrushPositionTracking = process.env.SEMRUSH_POSITION_TRACKING_CAMPAIGN_ID
      ? (liveProbes.semrushAnalytics.unitsRemaining > 0
        ? { status: 'unknown', message: 'Campaign probe is deferred to the project pull to avoid extra unit burn during verification.' }
        : { status: 'blocked', blockedReason: 'semrush_api_units_zero', message: 'Position Tracking reports require Semrush API units.' })
      : { status: 'skipped', message: 'SEMRUSH_POSITION_TRACKING_CAMPAIGN_ID not configured.' };
  } else {
    liveProbes.semrushAnalytics = { status: 'skipped', message: 'SEMRUSH_API_KEY not configured. Semrush automation is optional.' };
    liveProbes.semrushProjects = { status: 'skipped', message: 'Semrush API key missing.' };
    liveProbes.semrushPositionTracking = { status: 'skipped', message: 'Semrush API key missing.' };
  }

  const workflowSummary = summarizeSeoWorkflowGates(liveProbes);
  const blockedEndpoints = workflowSummary.blockedEndpoints;

  const requiredLocalPipelineStatuses = localPipeline
    .filter((check) => check.required)
    .map((check) => check.status);

  const liveProbeStatusesForOverall = Object.entries(liveProbes)
    .filter(([name, probe]) => {
      if (!name.startsWith('semrush')) return true;
      return process.env.SEMRUSH_API_KEY && probe.status !== 'skipped';
    })
    .map(([, probe]) => probe.status);

  const overallStatus = rollupStatuses(
    requiredLocalPipelineStatuses,
    publicSiteEnv.map((check) => check.status),
    liveProbeStatusesForOverall,
  );

  const misconfiguredSources = [
    ...localPipeline.filter((check) => check.status === 'misconfigured').map((check) => check.name),
    ...publicSiteEnv.filter((check) => check.status === 'misconfigured').map((check) => check.name),
    ...Object.entries(liveProbes)
      .filter(([, probe]) => probe.status === 'misconfigured')
      .map(([name]) => name),
  ];

  const report = getArtifactEnvelope({
    source: 'verify-setup',
    generatedAt,
    status: overallStatus,
    warnings: [],
    repoRoot,
    dotenvFiles: dotenvSources.map((source) => source.fileName),
    latestLiveVerification,
    localPipeline,
    optionalProjects,
    publicSiteEnv,
    liveProbes,
    summary: {
      overallStatus,
      blockedEndpoints,
      misconfiguredSources,
      sources: {
        localPipeline: rollupStatuses(requiredLocalPipelineStatuses),
        publicSiteEnv: rollupStatuses(publicSiteEnv.map((check) => check.status)),
        ahrefsApi: workflowSummary.sources.ahrefsApi,
        semrushAnalytics: workflowSummary.sources.semrushAnalytics,
        semrushProjects: workflowSummary.sources.semrushProjects,
      },
      workflowGates: workflowSummary.workflowGates,
    },
  });

  writeJson(path.join(outputDir, 'setup-verification.json'), report);
  writeText(path.join(outputDir, 'setup-verification.md'), renderMarkdown(report));

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    overallStatus: report.summary.overallStatus,
    blockedEndpoints: report.summary.blockedEndpoints,
    misconfiguredSources: report.summary.misconfiguredSources,
    workflowGates: report.summary.workflowGates,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
