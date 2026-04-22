import path from 'node:path';

import {
  classifyAhrefsError,
  fetchAhrefsJson,
  fetchAhrefsPaginated,
  getArtifactEnvelope,
  getPreviousSeoOutputDir,
  getSeoOutputDir,
  numberValue,
  optionalEnv,
  parseCliArgs,
  readOptionalJson,
  rollupStatuses,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const projectId = optionalEnv('AHREFS_SITE_AUDIT_PROJECT_ID');
const mode = args.mode || 'overview';

async function loadPageContent(targetUrl) {
  const response = await fetchAhrefsJson('site-audit/page-content', {
    project_id: projectId,
    target_url: targetUrl,
    select: 'crawl_datetime,page_text',
  });

  const content = response?.['page-content'] || {};
  return {
    targetUrl,
    crawlDatetime: content.crawl_datetime || null,
    textSnippet: String(content.page_text || '').slice(0, 1200),
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const projectSection = {
    status: 'unknown',
    blockedReason: null,
    warnings: [],
  };
  const issuesSection = {
    status: 'unknown',
    blockedReason: null,
    warnings: [],
  };
  const pageExplorerSection = {
    status: 'unknown',
    blockedReason: null,
    warnings: [],
  };
  const pageContentSection = {
    status: 'unknown',
    blockedReason: null,
    warnings: [],
  };

  if (!projectId) {
    const reason = 'AHREFS_SITE_AUDIT_PROJECT_ID not set. Create a Site Audit project in Ahrefs UI and add the ID to .env.';
    const output = getArtifactEnvelope({
      source: 'ahrefs-api-v3',
      endpoint: 'site-audit',
      generatedAt,
      status: 'misconfigured',
      unitCostEstimate: { overview: 50, issues: 150, pageExplorer: 100, pageContent: 150 },
      projectId: null,
      reason,
      overview: null,
      severityCounts: {},
      issues: [],
      pageExplorer: [],
      pageContent: [],
      historicalComparisons: null,
      warnings: [reason],
    });
    writeJson(path.join(outputDir, 'ahrefs-site-audit.json'), output);
    console.log(JSON.stringify({ ok: true, skipped: true, reason }, null, 2));
    return;
  }

  let overview = null;
  try {
    const response = await fetchAhrefsJson('site-audit/projects', { limit: 100 });
    const healthscores = response?.healthscores || [];
    overview = healthscores.find((row) => String(row.project_id) === String(projectId)) || null;
    projectSection.status = 'ok';
  } catch (error) {
    const classified = classifyAhrefsError(error);
    projectSection.status = classified.status;
    projectSection.blockedReason = classified.blockedReason;
    projectSection.warnings.push(classified.message);
  }

  let issues = [];
  if (mode === 'overview') {
    issuesSection.status = 'skipped';
  } else {
    try {
      const rows = await fetchAhrefsPaginated(
        'site-audit/issues',
        { project_id: projectId, limit: 200 },
        { maxPages: 10, rowsKey: 'issues' },
      );
      issues = rows.map((row) => ({
        issueId: row.issue_id || '',
        name: row.name || '',
        category: row.category || '',
        importance: row.importance || '',
        isIndexable: row.is_indexable,
        crawled: numberValue(row.crawled),
        change: numberValue(row.change),
        added: numberValue(row.added),
        new: numberValue(row.new),
        removed: numberValue(row.removed),
        missing: numberValue(row.missing),
      }));
      issuesSection.status = 'ok';
    } catch (error) {
      const classified = classifyAhrefsError(error);
      issuesSection.status = classified.status;
      issuesSection.blockedReason = classified.blockedReason;
      issuesSection.warnings.push(classified.message);
    }
  }

  let pageExplorer = [];
  if (mode === 'overview') {
    pageExplorerSection.status = 'skipped';
  } else {
    try {
      const response = await fetchAhrefsJson('site-audit/page-explorer', {
        project_id: projectId,
        limit: 50,
      });
      const rows = response?.pages || response?.rows || [];
      pageExplorer = rows.map((row) => ({
        url: row.url || '',
        title: Array.isArray(row.title) ? row.title[0] || '' : row.title || '',
        h1: Array.isArray(row.h1) ? row.h1[0] || '' : row.h1 || '',
        httpCode: numberValue(row.http_code, null),
        canonical: row.canonical || '',
        canonicalCode: row.canonical_code ?? null,
        compliant: row.compliant ?? null,
        isNoindex: Boolean(row.page_is_noindex),
        isNofollow: Boolean(row.page_is_nofollow),
        traffic: numberValue(row.traffic, null),
        incomingAllLinks: numberValue(row.incoming_all_links, null),
        internalLinks: numberValue(row.links_count_internal, null),
        externalLinks: numberValue(row.links_count_external, null),
        pageRating: numberValue(row.page_rating, null),
        contentType: row.content_type || '',
        crawlDatetime: row.crawl_datetime || null,
      }));
      pageExplorerSection.status = 'ok';
    } catch (error) {
      const classified = classifyAhrefsError(error);
      pageExplorerSection.status = classified.status;
      pageExplorerSection.blockedReason = classified.blockedReason;
      pageExplorerSection.warnings.push(classified.message);
    }
  }

  let pageContent = [];
  if (mode === 'overview') {
    pageContentSection.status = 'skipped';
  } else if (pageExplorer.length > 0) {
    const contentTargets = pageExplorer
      .filter((row) => row.httpCode === 200 && /html/i.test(row.contentType))
      .slice(0, 5)
      .map((row) => row.url);

    try {
      pageContent = await Promise.all(contentTargets.map((targetUrl) => loadPageContent(targetUrl)));
      pageContentSection.status = 'ok';
    } catch (error) {
      const classified = classifyAhrefsError(error);
      pageContentSection.status = classified.status;
      pageContentSection.blockedReason = classified.blockedReason;
      pageContentSection.warnings.push(classified.message);
    }
  } else {
    pageContentSection.status = 'skipped';
    pageContentSection.warnings.push('Page content skipped because Page Explorer returned no HTML pages.');
  }

  const severityCounts = issues.reduce((acc, issue) => {
    const key = (issue.importance || 'unknown').toLowerCase();
    acc[key] = (acc[key] || 0) + issue.crawled;
    return acc;
  }, {});

  const previousOutputDir = getPreviousSeoOutputDir(path.basename(outputDir));
  const previousAudit = previousOutputDir
    ? readOptionalJson(path.join(previousOutputDir, 'ahrefs-site-audit.json'))
    : null;

  const historicalComparisons = {
    previousDate: previousOutputDir ? path.basename(previousOutputDir) : null,
    healthScoreDelta: previousAudit?.overview && overview
      ? numberValue(overview.health_score) - numberValue(previousAudit.overview.health_score)
      : null,
    urlsWithErrorsDelta: previousAudit?.overview && overview
      ? numberValue(overview.urls_with_errors) - numberValue(previousAudit.overview.urls_with_errors)
      : null,
    issueDeltas: issues
      .filter((issue) => issue.change || issue.added || issue.removed || issue.new)
      .slice(0, 15)
      .map((issue) => ({
        issueId: issue.issueId,
        name: issue.name,
        change: issue.change,
        added: issue.added,
        new: issue.new,
        removed: issue.removed,
      })),
  };

  const output = getArtifactEnvelope({
    source: 'ahrefs-api-v3',
    endpoint: 'site-audit',
    generatedAt,
    status: mode === 'overview'
      ? rollupStatuses(projectSection.status)
      : rollupStatuses(projectSection.status, issuesSection.status, pageExplorerSection.status, pageContentSection.status),
    unitCostEstimate: {
      overview: 50,
      issues: mode === 'full' ? 500 : 0,
      pageExplorer: mode === 'full' ? 250 : 0,
      pageContent: mode === 'full' ? 250 : 0,
    },
    projectId,
    mode,
    warnings: [
      ...projectSection.warnings,
      ...issuesSection.warnings,
      ...pageExplorerSection.warnings,
      ...pageContentSection.warnings,
    ],
    overview,
    severityCounts,
    issues,
    pageExplorer,
    pageContent,
    historicalComparisons,
  });

  writeJson(path.join(outputDir, 'ahrefs-site-audit.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    projectId,
    status: output.status,
    healthScore: overview?.health_score ?? null,
    rows: {
      issues: issues.length,
      pageExplorer: pageExplorer.length,
      pageContent: pageContent.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
