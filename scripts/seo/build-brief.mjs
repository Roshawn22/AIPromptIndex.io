import fs from 'node:fs';
import path from 'node:path';

import {
  classifySurface,
  getSeoOutputDir,
  inferOpportunitySurface,
  loadSiteInventory,
  normalizePathname,
  numberValue,
  readJson,
  scoreKeywordMatch,
  writeText,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();
const inventory = loadSiteInventory();

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function decimal(value) {
  return Number(value || 0).toFixed(1);
}

function integer(value) {
  return Math.round(Number(value || 0)).toLocaleString();
}

function mapByPath(rows, selector = (row) => row) {
  return rows.reduce((map, row) => {
    const pathname = normalizePathname(row.key || row.landingPage || row.url || row.best_position_url);
    map.set(pathname, selector(row));
    return map;
  }, new Map());
}

function expectedCtr(position) {
  if (position <= 5) return 0.08;
  if (position <= 10) return 0.04;
  return 0.02;
}

function getRouteMatch(keyword) {
  let bestMatch = null;
  let bestScore = 0;

  for (const entry of inventory) {
    const score = scoreKeywordMatch(keyword, entry);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return { bestMatch, bestScore };
}

function renderSection(title, intro, items, renderItem) {
  const lines = [`## ${title}`, '', intro, ''];

  if (items.length === 0) {
    lines.push('- No qualifying items in the latest pull.', '');
    return lines.join('\n');
  }

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${renderItem(item)}`);
  });
  lines.push('');
  return lines.join('\n');
}

function summarizeSemrushSiteAuditIssue(issue) {
  const affectedPages = numberValue(issue.total || issue.count || issue.num || 0);
  const sample = Array.isArray(issue.data) ? issue.data.find(Boolean) : null;
  const sampleLabel = sample?.source_url || sample?.title || sample?.page_id || '';
  const label = issue.issue_id ? `Issue #${issue.issue_id}` : (issue.title || issue.name || 'Issue');
  const details = [
    label,
    affectedPages > 0 ? `${integer(affectedPages)} pages` : null,
    sampleLabel ? `sample: ${sampleLabel}` : null,
  ].filter(Boolean);
  return details.join(' | ');
}

function main() {
  const readOptional = (fileName) => {
    const filePath = path.join(outputDir, fileName);
    if (!fs.existsSync(filePath)) return null;
    return readJson(filePath);
  };

  // Core artifacts — Ahrefs is required, GSC/GA4 are optional
  const ahrefsOverview = readOptional('ahrefs-overview.json');
  const ahrefsKeywords = readOptional('ahrefs-keywords.json');
  const ahrefsTopPages = readOptional('ahrefs-top-pages.json');

  if (!ahrefsOverview || !ahrefsKeywords || !ahrefsTopPages) {
    throw new Error('Missing required Ahrefs artifacts. Run seo:pull:ahrefs first.');
  }

  const gscPages = readOptional('gsc-pages.json');
  const ga4 = readOptional('ga4-landing-pages.json');
  const semrushOverview = readOptional('semrush-overview.json');
  const semrushKeywords = readOptional('semrush-keywords.json');
  const semrushRankHistory = readOptional('semrush-rank-history.json');
  const crossValidation = readOptional('cross-validation.json');
  const ahrefsCompetitors = readOptional('ahrefs-competitors.json');
  const semrushCompetitorProfiles = readOptional('semrush-competitor-profiles.json');
  const brandRadar = readOptional('brand-radar.json');

  // Upgraded-plan artifacts (optional; skipped if not present)
  const ahrefsSiteAudit = readOptional('ahrefs-site-audit.json');
  const ahrefsRankTracker = readOptional('ahrefs-rank-tracker.json');
  const ahrefsBatchAnalysis = readOptional('ahrefs-batch-analysis.json');
  const ahrefsKeywordsExplorer = readOptional('ahrefs-keywords-explorer.json');
  const ahrefsBacklinksDeep = readOptional('ahrefs-backlinks-deep.json');
  const semrushKeywordAnalytics = readOptional('semrush-keyword-analytics.json');
  const semrushBacklinksDeep = readOptional('semrush-backlinks-deep.json');
  const semrushSupplemental = readOptional('semrush-supplemental.json');
  const semrushTopicResearch = readOptional('semrush-topic-research.json');
  const semrushTrafficAnalytics = readOptional('semrush-traffic-analytics.json');
  const semrushProjects = readOptional('semrush-projects.json');
  const contentBriefs = readOptional('content-briefs.json');

  const topPages = ahrefsTopPages.rows || [];
  const keywords = ahrefsKeywords.rows || [];

  const topPagesByPath = mapByPath(topPages, (row) => ({
    traffic: numberValue(row.traffic),
    refdomains: row.refdomains === null || row.refdomains === undefined ? null : numberValue(row.refdomains),
    topKeyword: row.topKeyword || row.top_keyword || '',
  }));

  // --- CTR Wins (requires GSC) ---

  let ctrWins = [];
  let refreshCandidates = [];

  if (gscPages) {
    const gsc28 = gscPages.ranges.last28.rows;
    const gscPrev28 = gscPages.ranges.previous28.rows;
    const prev28ByPath = mapByPath(gscPrev28);

    const ga4Summary28 = ga4?.ranges?.last28?.summary || [];
    const ga4ByPath = mapByPath(ga4Summary28, (row) => ({
      sessions: numberValue(row.sessions),
      engagedSessions: numberValue(row.engagedSessions),
      totalKeyEvents: numberValue(row.totalKeyEvents),
    }));

    ctrWins = gsc28
      .map((row) => {
        const pathname = normalizePathname(row.key);
        const targetCtr = expectedCtr(row.position);
        const upsideClicks = row.impressions * Math.max(targetCtr - row.ctr, 0);
        return {
          pathname,
          surface: classifySurface(pathname),
          clicks: numberValue(row.clicks),
          impressions: numberValue(row.impressions),
          ctr: numberValue(row.ctr),
          position: numberValue(row.position),
          targetCtr,
          upsideClicks,
          ga4: ga4ByPath.get(pathname) || null,
        };
      })
      .filter((row) => row.impressions >= 100 && row.position >= 3 && row.position <= 20 && row.ctr < row.targetCtr * 0.65)
      .sort((left, right) => right.upsideClicks - left.upsideClicks)
      .slice(0, 12);

    refreshCandidates = gsc28
      .map((row) => {
        const pathname = normalizePathname(row.key);
        const previous = prev28ByPath.get(pathname);
        if (!previous) return null;

        const previousClicks = numberValue(previous.clicks);
        const currentClicks = numberValue(row.clicks);
        const clickChangePct = previousClicks > 0 ? ((currentClicks - previousClicks) / previousClicks) * 100 : 0;
        const positionDelta = numberValue(row.position) - numberValue(previous.position);

        return {
          pathname,
          surface: classifySurface(pathname),
          currentClicks,
          previousClicks,
          clickChangePct,
          currentPosition: numberValue(row.position),
          previousPosition: numberValue(previous.position),
          positionDelta,
          score: Math.max(previousClicks - currentClicks, 0) * 10 + Math.max(positionDelta, 0) * 25,
        };
      })
      .filter(Boolean)
      .filter((row) => row.previousClicks >= 10 && (row.clickChangePct <= -20 || row.positionDelta >= 1.5))
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);
  }

  // --- New Content Opportunities ---

  const newContentOpportunities = keywords
    .map((row) => {
      const keyword = row.keyword || '';
      const routeMatch = getRouteMatch(keyword);
      const existingPath = normalizePathname(row.best_position_url);
      const existingRoute = inventory.find((entry) => entry.pathname === existingPath);
      const existingRouteScore = existingRoute ? scoreKeywordMatch(keyword, existingRoute) : 0;
      const clearExistingRoute = routeMatch.bestScore >= 0.85 || existingRouteScore >= 0.65;

      return {
        keyword,
        volume: numberValue(row.volume),
        traffic: numberValue(row.sum_traffic),
        bestPosition: numberValue(row.best_position),
        bestPositionUrl: row.best_position_url || '',
        suggestedSurface: inferOpportunitySurface(keyword),
        bestRouteScore: routeMatch.bestScore,
        clearExistingRoute,
        upsideScore: numberValue(row.volume) + numberValue(row.sum_traffic) * 20,
      };
    })
    .filter((row) => row.keyword && row.volume >= 100)
    .filter((row) => !/\baipromptindex\b/i.test(row.keyword))
    .filter((row) => !row.clearExistingRoute)
    .sort((left, right) => right.upsideScore - left.upsideScore)
    .filter((row, index, items) => items.findIndex((candidate) => candidate.keyword === row.keyword) === index)
    .slice(0, 12);

  // --- Link Targets ---

  const linkTargets = keywords
    .filter((row) => numberValue(row.best_position) >= 4 && numberValue(row.best_position) <= 20)
    .filter((row) => numberValue(row.sum_traffic) >= 10 || numberValue(row.volume) >= 100)
    .reduce((map, row) => {
      const pathname = normalizePathname(row.best_position_url);
      if (pathname === '/') return map;

      const current = map.get(pathname) || {
        pathname,
        surface: classifySurface(pathname),
        keywords: 0,
        topKeyword: row.keyword,
        topKeywordTraffic: numberValue(row.sum_traffic),
        totalTraffic: 0,
        bestPosition: numberValue(row.best_position),
      };

      current.keywords += 1;
      current.totalTraffic += numberValue(row.sum_traffic);
      current.bestPosition = Math.min(current.bestPosition, numberValue(row.best_position));
      if (numberValue(row.sum_traffic) > current.topKeywordTraffic) {
        current.topKeyword = row.keyword;
        current.topKeywordTraffic = numberValue(row.sum_traffic);
      }

      map.set(pathname, current);
      return map;
    }, new Map());

  const rankedLinkTargets = [...linkTargets.values()]
    .map((row) => {
      const pageMetrics = topPagesByPath.get(row.pathname);
      const refdomains = pageMetrics?.refdomains;
      const weakRefdomains = refdomains === null ? true : refdomains <= 20;
      return {
        ...row,
        refdomains,
        weakRefdomains,
        score: row.totalTraffic / Math.max((refdomains ?? 0) + 1, 1),
      };
    })
    .filter((row) => row.weakRefdomains)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  // --- Semrush Snapshot section ---

  let semrushSnapshotSection = '';
  if (semrushOverview) {
    const overview = semrushOverview.domainOverview || {};
    const rank = integer(overview.Rank || overview['Rank']);
    const orgKw = integer(overview['Organic Keywords']);
    const orgTraffic = integer(overview['Organic Traffic']);

    const topSemrushKw = (semrushKeywords?.rows || [])
      .sort((a, b) => numberValue(b.volume) - numberValue(a.volume))
      .slice(0, 5);

    const kwLines = topSemrushKw.length > 0
      ? topSemrushKw.map((kw) => `  - \`${kw.keyword}\` | pos ${kw.position} | vol ${integer(kw.volume)}`).join('\n')
      : '  - No keywords tracked yet.';

    let trendLine = '';
    const historyRows = semrushRankHistory?.rows || [];
    if (historyRows.length >= 2) {
      const sorted = [...historyRows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const oldest = sorted[0];
      const newest = sorted[sorted.length - 1];
      const kwDelta = newest.organicKeywords - oldest.organicKeywords;
      const direction = kwDelta > 0 ? 'up' : kwDelta < 0 ? 'down' : 'flat';
      trendLine = `\n- Keyword trend: ${direction} (${oldest.organicKeywords} -> ${newest.organicKeywords} over ${sorted.length} months)`;
    }

    semrushSnapshotSection = [
      '## Semrush Snapshot',
      '',
      `- Domain Rank: ${rank}`,
      `- Organic Keywords: ${orgKw}`,
      `- Organic Traffic: ${orgTraffic}`,
      `- Top keywords by volume:`,
      kwLines,
      trendLine,
      '',
    ].filter(Boolean).join('\n');
  }

  let semrushSupplementalSection = '';
  if (semrushSupplemental) {
    const topOrganicPages = (semrushSupplemental.organicPages || []).slice(0, 5);
    const topRefDomains = (semrushSupplemental.referringDomains || []).slice(0, 5);
    const batchRows = (semrushSupplemental.batchComparison || []).slice(0, 5);
    const lines = [
      '## Semrush Supplemental',
      '',
      `- Status: ${semrushSupplemental.status}${semrushSupplemental.blockedReason ? ` (${semrushSupplemental.blockedReason})` : ''}`,
      `- Units remaining: ${semrushSupplemental.unitsBalance?.unitsRemaining ?? 'n/a'}`,
    ];

    if (semrushSupplemental.status === 'blocked') {
      lines.push(`- Current limitation: ${(semrushSupplemental.sections?.organicKeywords?.warnings || [])[0] || 'Semrush analytics units are exhausted.'}`);
      lines.push('');
      semrushSupplementalSection = lines.join('\n');
    } else {
      const overview = semrushSupplemental.backlinksOverview || {};
      lines.push(`- Backlink Authority Score: ${integer(overview.ascore || 0)} | Referring domains: ${integer(overview.referringDomains || 0)} | Backlinks: ${integer(overview.totalBacklinks || 0)}`);
      lines.push('');

      if (topOrganicPages.length > 0) {
        lines.push('**Top organic pages (Semrush):**');
        topOrganicPages.forEach((page) => lines.push(`  - \`${normalizePathname(page.url)}\` | kw ${integer(page.keywords)} | traffic ${integer(page.traffic)} | share ${decimal(page.trafficShare)}%`));
        lines.push('');
      }

      if (topRefDomains.length > 0) {
        lines.push('**Top referring domains (Semrush):**');
        topRefDomains.forEach((domain) => lines.push(`  - \`${domain.domain}\` | AS ${integer(domain.ascore)} | backlinks ${integer(domain.backlinks)} | ${domain.country || 'n/a'}`));
        lines.push('');
      }

      if (batchRows.length > 0) {
        lines.push('**Batch comparison (Semrush):**');
        batchRows.forEach((row) => lines.push(`  - \`${row.target}\` | AS ${integer(row.ascore)} | refdomains ${integer(row.domains)} | backlinks ${integer(row.backlinks)}`));
        lines.push('');
      }

      if (semrushTrafficAnalytics?.status === 'blocked') {
        lines.push(`- Traffic Analytics: blocked (${semrushTrafficAnalytics.blockedReason || 'insufficient units'})`);
        lines.push('');
      }

      semrushSupplementalSection = lines.join('\n');
    }
  }

  // --- Cross-Tool Keyword Validation section ---

  let crossToolSection = '';
  if (crossValidation) {
    const cv = crossValidation;
    const highDiscrepancy = (cv.matched || []).filter((m) => m.positionDiscrepancy || m.volumeDiscrepancy).slice(0, 8);
    const semrushOnly = (cv.semrushOnly || []).slice(0, 5);
    const ahrefsOnly = (cv.ahrefsOnly || []).slice(0, 5);

    const discrepancyLines = highDiscrepancy.length > 0
      ? highDiscrepancy.map((m) => {
        const flags = [];
        if (m.positionDiscrepancy) flags.push(`pos: Ahrefs ${m.ahrefsPosition} vs Semrush ${m.semrushPosition}`);
        if (m.volumeDiscrepancy) flags.push(`vol: Ahrefs ${integer(m.ahrefsVolume)} vs Semrush ${integer(m.semrushVolume)}`);
        return `  - \`${m.keyword}\` | ${flags.join(' | ')} | confidence ${decimal(m.confidence)}`;
      }).join('\n')
      : '  - No high-discrepancy keywords found.';

    const semrushOnlyLines = semrushOnly.length > 0
      ? semrushOnly.map((k) => `  - \`${k.keyword}\` | pos ${k.position} | vol ${integer(k.volume)}`).join('\n')
      : '  - None';

    const ahrefsOnlyLines = ahrefsOnly.length > 0
      ? ahrefsOnly.map((k) => `  - \`${k.keyword}\` | pos ${k.best_position} | vol ${integer(k.volume)}`).join('\n')
      : '  - None';

    crossToolSection = [
      '## Cross-Tool Keyword Validation',
      '',
      'Keywords where Semrush and Ahrefs disagree significantly (position diff > 10 or volume diff > 50%).',
      '',
      discrepancyLines,
      '',
      '**Semrush-only keywords** (not in Ahrefs):',
      semrushOnlyLines,
      '',
      '**Ahrefs-only keywords** (not in Semrush):',
      ahrefsOnlyLines,
      '',
    ].join('\n');
  }

  // --- Competitive Landscape section ---

  let competitiveLandscapeSection = '';
  if (ahrefsCompetitors && (ahrefsCompetitors.rows || []).length > 0) {
    const ahrefsList = (ahrefsCompetitors.rows || []).slice(0, 10);
    const semrushProfiles = new Map(
      (semrushCompetitorProfiles?.rows || []).map((p) => [p.domain, p])
    );

    const competitorLines = ahrefsList.map((c) => {
      const semrush = semrushProfiles.get(c.domain);
      const semrushInfo = semrush
        ? ` | Semrush rank ${integer(semrush.rank)} | Semrush kw ${integer(semrush.organicKeywords)}`
        : '';
      return `  - \`${c.domain}\` | shared kw ${integer(c.keywords_matched || c.commonKeywords || 0)} | Ahrefs traffic ${integer(c.traffic || 0)}${semrushInfo}`;
    }).join('\n');

    competitiveLandscapeSection = [
      '## Competitive Landscape',
      '',
      'Competitors auto-discovered by Ahrefs, enriched with Semrush domain data.',
      '',
      competitorLines,
      '',
    ].join('\n');
  }

  // --- AI Visibility section ---

  function buildAiVisibilitySection(semrushKw, radar) {
    const parts = [];

    const kwRows = semrushKw?.rows || [];
    const aiOverviewKeywords = kwRows.filter((kw) => kw.hasAiOverview);
    const inAiOverviewKeywords = kwRows.filter((kw) => kw.inAiOverview);

    if (kwRows.length > 0) {
      parts.push('## AI Visibility');
      parts.push('');
      parts.push('### Google AI Overviews (via Semrush)');
      parts.push('');
      parts.push(`- Keywords triggering AI Overviews: ${aiOverviewKeywords.length} of ${kwRows.length}`);
      parts.push(`- Keywords where aipromptindex.io appears in AI Overview: ${inAiOverviewKeywords.length}`);

      if (aiOverviewKeywords.length > 0) {
        parts.push('');
        parts.push('AI Overview keywords:');
        aiOverviewKeywords.slice(0, 10).forEach((kw) => {
          const inIt = kw.inAiOverview ? ' **[YOU\'RE IN IT]**' : '';
          parts.push(`  - \`${kw.keyword}\` | pos ${kw.position} | vol ${integer(kw.volume)}${inIt}`);
        });
      }
      parts.push('');
    }

    if (radar) {
      const activeSources = radar.activeSources || [];
      const missingAddons = Object.entries(radar.addonStatus || {})
        .filter(([, status]) => status === 'addon_not_enabled')
        .map(([source]) => source);

      if (activeSources.length > 0) {
        parts.push('### AI Platform Visibility (via Ahrefs Brand Radar)');
        parts.push('');
        parts.push(`Active sources: ${activeSources.join(', ')}`);
        parts.push('');

        for (const source of activeSources) {
          const imp = (radar.impressions?.[source]?.metrics || [])[0];
          const sovData = (radar.sov?.[source]?.metrics || []);
          if (imp) {
            parts.push(`**${source}**: ${integer(imp.total)} impressions | ${integer(imp.only_target_brand)} yours exclusively`);
          }
          const brandSov = sovData.find((m) => m.brand?.toLowerCase() === radar.brand?.toLowerCase());
          if (brandSov) {
            parts.push(`  Share of Voice: ${percent(brandSov.share_of_voice)}`);
          }
        }
        parts.push('');

        const historySources = Object.entries(radar.impressionsHistory || {});
        if (historySources.length > 0) {
          parts.push('Recent Brand Radar history:');
          historySources.slice(0, 4).forEach(([source, history]) => {
            const metrics = history?.metrics || [];
            const latest = metrics[metrics.length - 1];
            if (!latest) return;
            parts.push(`  - ${source}: latest impressions ${integer(latest.impressions || latest.total || 0)}`);
          });
          parts.push('');
        }

        const allResponses = Object.values(radar.aiResponses || {}).flatMap((r) =>
          (r?.ai_responses || []).map((resp) => ({ ...resp }))
        );
        if (allResponses.length > 0) {
          parts.push('Top AI questions mentioning your brand:');
          allResponses
            .sort((a, b) => numberValue(b.volume) - numberValue(a.volume))
            .slice(0, 5)
            .forEach((resp) => {
              parts.push(`  - \`${resp.question}\` | vol ${integer(resp.volume)} | ${resp.data_source}`);
            });
          parts.push('');
        }

        const allCited = Object.values(radar.citedPages || {}).flatMap((r) =>
          (r?.cited_pages || []).map((p) => ({ ...p }))
        );
        if (allCited.length > 0) {
          parts.push('Your pages cited in AI responses:');
          allCited.slice(0, 5).forEach((p) => {
            parts.push(`  - \`${p.cited_url}\` | cited ${integer(p.responses)} times | vol ${integer(p.volume)}`);
          });
          parts.push('');
        }
      }

      if (missingAddons.length > 0) {
        if (parts.length === 0) {
          parts.push('## AI Visibility');
          parts.push('');
        }
        parts.push(`> **Brand Radar addons not enabled:** ${missingAddons.join(', ')}. Enable in [Ahrefs Brand Radar](https://app.ahrefs.com/brand-radar) to unlock full AI visibility tracking.`);
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  // --- Assemble brief ---

  const headerLines = [
    '# Weekly SEO Brief',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source directory: \`${outputDir}\``,
  ];
  if (gscPages) headerLines.push(`Search Console property: \`${gscPages.siteProperty}\``);
  if (ga4) headerLines.push(`GA4 property: \`${ga4.propertyId}\``);
  headerLines.push(`Ahrefs target: \`${ahrefsOverview.target}\``);
  if (semrushOverview) headerLines.push(`Semrush target: \`${semrushOverview.target}\``);
  headerLines.push('');

  // --- Site Health (from Ahrefs Site Audit + Semrush Projects Site Audit) ---
  let siteHealthSection = '';
  if (ahrefsSiteAudit && !ahrefsSiteAudit.skipped) {
    const ov = ahrefsSiteAudit.overview || {};
    const topIssues = (ahrefsSiteAudit.issues || [])
      .sort((a, b) => numberValue(b.crawled) - numberValue(a.crawled))
      .slice(0, 5);
    const issueLines = topIssues.length > 0
      ? topIssues.map((iss) => `  - ${iss.name} [${iss.importance || iss.category || 'issue'}] x${integer(iss.crawled)}`).join('\n')
      : '  - No issues surfaced.';
    siteHealthSection = [
      '## Site Health (Ahrefs Site Audit)',
      '',
      `- Score: ${ov.health_score ?? 'n/a'} | Crawled URLs: ${integer(ov.total)}`,
      `- Errors: ${integer(ov.urls_with_errors)} | Warnings: ${integer(ov.urls_with_warnings)} | Notices: ${integer(ov.urls_with_notices)}`,
      '',
      '**Top issues:**',
      issueLines,
      '',
    ].join('\n');
  }
  if (semrushProjects && !semrushProjects.skipped && semrushProjects.siteAudit) {
    const sa = semrushProjects.siteAudit;
    const topIssues = (sa.issues || []).slice(0, 5);
    const issueLines = topIssues.length > 0
      ? topIssues.map((iss) => `  - ${summarizeSemrushSiteAuditIssue(iss)}`).join('\n')
      : (sa.status === 'ok' ? '  - No issues surfaced.' : '  - Issue details unavailable in the current run.');
    const statusLine = sa.status === 'ok'
      ? `- Status: ${sa.health?.status || 'ok'} | Crawled pages: ${integer(sa.health?.pagesCrawled)}`
      : `- Status: ${sa.status}${sa.blockedReason ? ` (${sa.blockedReason})` : ''} | Crawled pages: ${integer(sa.health?.pagesCrawled)}`;
    siteHealthSection += [
      '## Site Health (Semrush Site Audit)',
      '',
      statusLine,
      `- Errors: ${integer(sa.health?.errors)} | Warnings: ${integer(sa.health?.warnings)} | Notices: ${integer(sa.health?.notices)}`,
      sa.warnings?.length ? `- Current limitation: ${sa.warnings[0]}` : '',
      '',
      issueLines,
      '',
    ].join('\n');
  }

  // --- Rank Movement (from Ahrefs Rank Tracker) ---
  let rankMovementSection = '';
  if (ahrefsRankTracker && !ahrefsRankTracker.skipped) {
    const winners = (ahrefsRankTracker.movement?.winners || []).slice(0, 10);
    const losers = (ahrefsRankTracker.movement?.losers || []).slice(0, 10);
    const winnerLines = winners.length > 0
      ? winners.map((w) => `  - \`${w.keyword}\` | ${decimal(w.position)} (↑${Math.abs(w.positionDiff).toFixed(0)}) | vol ${integer(w.volume)}`).join('\n')
      : '  - No ranking improvements this period.';
    const loserLines = losers.length > 0
      ? losers.map((l) => `  - \`${l.keyword}\` | ${decimal(l.position)} (↓${l.positionDiff.toFixed(0)}) | vol ${integer(l.volume)}`).join('\n')
      : '  - No ranking drops this period.';
    rankMovementSection = [
      '## Rank Movement (Ahrefs Rank Tracker)',
      '',
      `Tracking ${integer(ahrefsRankTracker.keywordPositions?.length)} keywords. Visibility: ${decimal(ahrefsRankTracker.overview?.visibility || 0)}`,
      '',
      '**Winners (moved up):**',
      winnerLines,
      '',
      '**Losers (dropped):**',
      loserLines,
      '',
      ahrefsRankTracker.competitorStats?.length > 0 ? '**Competitor stats:**' : '',
      ahrefsRankTracker.competitorStats?.slice(0, 5).map((row) => `  - \`${row.competitor}\` | SoV ${percent(row.shareOfVoice || 0)} | traffic ${integer(row.traffic || 0)} | avg pos ${decimal(row.averagePosition || 0)}`).join('\n') || '',
      ahrefsRankTracker.competitorStats?.length > 0 ? '' : '',
    ].join('\n');
  }

  // --- Competitor Authority (from Ahrefs Batch Analysis) ---
  let competitorAuthoritySection = '';
  if (ahrefsBatchAnalysis && (ahrefsBatchAnalysis.ranked || []).length > 0) {
    const lines = ahrefsBatchAnalysis.ranked.slice(0, 10).map((r) =>
      `  - \`${r.url}\` | DR ${integer(r.domainRating)} | backlinks ${integer(r.backlinks)} | refdomains ${integer(r.refdomains)} | organic ${integer(r.organicTraffic)}`
    ).join('\n');
    competitorAuthoritySection = [
      '## Competitor Authority (Ahrefs Batch Analysis)',
      '',
      `${ahrefsBatchAnalysis.domainCount} domains compared on a single pass.`,
      '',
      lines,
      '',
    ].join('\n');
  }

  // --- Keyword Research Opportunities (from Keywords Explorer + Keyword Analytics + Topic Research) ---
  let keywordResearchSection = '';
  if (ahrefsKeywordsExplorer || semrushKeywordAnalytics || semrushTopicResearch) {
    const parts = ['## Keyword Research Opportunities', ''];
    if (ahrefsKeywordsExplorer) {
      const matching = (ahrefsKeywordsExplorer.matchingTerms || [])
        .sort((a, b) => b.volume - a.volume).slice(0, 8);
      if (matching.length > 0) {
        parts.push('**Ahrefs matching terms (top volume):**');
        matching.forEach((m) => parts.push(`  - \`${m.keyword}\` | vol ${integer(m.volume)} | KD ${integer(m.difficulty)} | TP ${integer(m.trafficPotential)}`));
        parts.push('');
      }
    }
    if (semrushTopicResearch && (semrushTopicResearch.ranked || []).length > 0) {
      parts.push('**Semrush topics by total search volume:**');
      semrushTopicResearch.ranked.slice(0, 8).forEach((t) =>
        parts.push(`  - \`${t.topic}\` | total volume ${integer(t.totalVolume)} | ${t.questionsCount} questions, ${t.relatedCount} related`)
      );
      parts.push('');
    }
    if (semrushKeywordAnalytics) {
      const questions = (semrushKeywordAnalytics.questions || [])
        .sort((a, b) => b.volume - a.volume).slice(0, 6);
      if (questions.length > 0) {
        parts.push('**Top question keywords (Semrush):**');
        questions.forEach((q) => parts.push(`  - \`${q.keyword}\` | vol ${integer(q.volume)}`));
        parts.push('');
      }
    }
    if (parts.length > 2) keywordResearchSection = parts.join('\n');
  }

  // --- Backlink Intelligence (from deep pulls) ---
  let backlinkDeepSection = '';
  if (ahrefsBacklinksDeep || semrushBacklinksDeep) {
    const parts = ['## Backlink Intelligence', ''];
    if (ahrefsBacklinksDeep) {
      const broken = (ahrefsBacklinksDeep.brokenBacklinks || []).slice(0, 5);
      if (broken.length > 0) {
        parts.push(`**Broken backlinks (${ahrefsBacklinksDeep.brokenBacklinks.length} total) — reclaim opportunities:**`);
        broken.forEach((b) => parts.push(`  - from \`${b.urlFrom}\` → \`${b.urlTo}\` | DR ${integer(b.sourceDomainRating)}`));
        parts.push('');
      }
      const topAnchors = (ahrefsBacklinksDeep.anchors || []).slice(0, 8);
      if (topAnchors.length > 0) {
        parts.push('**Top anchor texts:**');
        topAnchors.forEach((a) => parts.push(`  - \`${a.anchor}\` | refdomains ${integer(a.refdomains)} | dofollow ${integer(a.dofollowLinks)}`));
        parts.push('');
      }
    }
    if (semrushBacklinksDeep) {
      const competitors = (semrushBacklinksDeep.competitors || []).slice(0, 5);
      if (competitors.length > 0) {
        parts.push('**Similar-backlink-profile competitors (Semrush):**');
        competitors.forEach((c) => parts.push(`  - \`${c.domain}\` | similarity ${decimal(c.similarity)} | shared refdomains ${integer(c.commonRefdomains)}`));
        parts.push('');
      }
    }
    if (semrushSupplemental && (semrushSupplemental.anchors || []).length > 0) {
      parts.push('**Top anchor texts (Semrush supplemental):**');
      semrushSupplemental.anchors.slice(0, 5).forEach((anchor) => {
        parts.push(`  - \`${anchor.anchor}\` | refdomains ${integer(anchor.refdomains)} | backlinks ${integer(anchor.backlinks)}`);
      });
      parts.push('');
    }
    if (parts.length > 2) backlinkDeepSection = parts.join('\n');
  }

  const sections = [
    headerLines.join('\n'),
    siteHealthSection,
    rankMovementSection,
    semrushSnapshotSection,
    crossToolSection,
    competitiveLandscapeSection,
    competitorAuthoritySection,
    keywordResearchSection,
    backlinkDeepSection,
    buildAiVisibilitySection(semrushKeywords, brandRadar),
  ].filter(Boolean);

  if (semrushSupplementalSection) {
    sections.splice(4, 0, semrushSupplementalSection);
  }

  if (gscPages) {
    sections.push(renderSection(
      'CTR Wins',
      'Pages with meaningful impressions, rank range 3-20, and clear click-through underperformance.',
      ctrWins,
      (item) => {
        const ga4Note = item.ga4
          ? ` | organic sessions ${integer(item.ga4.sessions)} | key events ${integer(item.ga4.totalKeyEvents)}`
          : '';
        return `\`${item.pathname}\` [${item.surface}] | pos ${decimal(item.position)} | CTR ${percent(item.ctr)} vs target ${percent(item.targetCtr)} | impressions ${integer(item.impressions)} | upside ~${integer(item.upsideClicks)} clicks${ga4Note}`;
      }
    ));
    sections.push(renderSection(
      'Refresh Candidates',
      'Pages losing clicks or average position versus the prior 28-day window.',
      refreshCandidates,
      (item) => `\`${item.pathname}\` [${item.surface}] | clicks ${integer(item.previousClicks)} -> ${integer(item.currentClicks)} (${item.clickChangePct.toFixed(1)}%) | avg position ${decimal(item.previousPosition)} -> ${decimal(item.currentPosition)}`
    ));
  }

  sections.push(renderSection(
    'New Content Opportunities',
    'High-value keywords where the site has no clear matching route today.',
    newContentOpportunities,
    (item) => `\`${item.keyword}\` -> build as ${item.suggestedSurface} | volume ${integer(item.volume)} | est traffic ${integer(item.traffic)} | current best position ${decimal(item.bestPosition)}${item.bestPositionUrl ? ` | current URL \`${normalizePathname(item.bestPositionUrl)}\`` : ''}`
  ));
  sections.push(renderSection(
    'Link Targets',
    'Pages ranking 4-20 with upside and comparatively weak referring-domain support.',
    rankedLinkTargets,
    (item) => `\`${item.pathname}\` [${item.surface}] | top keyword \`${item.topKeyword}\` | best position ${decimal(item.bestPosition)} | traffic potential ${integer(item.totalTraffic)} | refdomains ${item.refdomains === null ? 'n/a' : integer(item.refdomains)}`
  ));

  const technicalFixQueue = [];
  (ahrefsSiteAudit?.issues || [])
    .filter((issue) => numberValue(issue.crawled) > 0)
    .slice(0, 8)
    .forEach((issue) => {
      technicalFixQueue.push(`${issue.name} | severity ${issue.importance || issue.category} | affected ${integer(issue.crawled)} URLs`);
    });
  (semrushProjects?.manualOnly?.actionQueue || []).slice(0, 3).forEach((item) => technicalFixQueue.push(item));

  const refreshQueue = refreshCandidates.slice(0, 8).map((item) => (
    `\`${item.pathname}\` | clicks ${integer(item.previousClicks)} -> ${integer(item.currentClicks)} | avg position ${decimal(item.previousPosition)} -> ${decimal(item.currentPosition)}`
  ));

  const newContentQueue = [
    ...(contentBriefs?.briefs || []).slice(0, 8).map((brief) => (
      `\`${brief.keyword}\` | ${brief.suggestedSurface} | vol ${integer(brief.volume)} | est potential ${integer(brief.trafficPotential)}`
    )),
    ...newContentOpportunities.slice(0, 4).map((item) => (
      `\`${item.keyword}\` | ${item.suggestedSurface} | vol ${integer(item.volume)}`
    )),
  ];

  const citationQueue = [];
  Object.values(brandRadar?.citedPages || {})
    .flatMap((entry) => entry?.cited_pages || [])
    .sort((left, right) => numberValue(right.responses) - numberValue(left.responses))
    .slice(0, 5)
    .forEach((page) => {
      citationQueue.push(`Maintain cited page \`${normalizePathname(page.cited_url)}\` | cited ${integer(page.responses)} times | volume ${integer(page.volume)}`);
    });
  rankedLinkTargets.slice(0, 5).forEach((item) => {
    citationQueue.push(`Outreach target \`${item.pathname}\` | top keyword \`${item.topKeyword}\` | refdomains ${item.refdomains === null ? 'n/a' : integer(item.refdomains)}`);
  });

  sections.push(renderSection(
    'Technical Fix Queue',
    'Highest-signal technical SEO fixes and manual follow-ups from the current pull.',
    technicalFixQueue,
    (item) => item
  ));
  sections.push(renderSection(
    'Content Refresh Queue',
    'Existing pages to refresh first based on click loss, ranking softness, or citation maintenance.',
    refreshQueue,
    (item) => item
  ));
  sections.push(renderSection(
    'New Content Queue',
    'Next briefs or route gaps to turn into new pages.',
    newContentQueue,
    (item) => item
  ));
  sections.push(renderSection(
    'Link/Citation Queue',
    'Pages to support with link building, citation maintenance, or AI-answer reinforcement.',
    citationQueue,
    (item) => item
  ));

  let briefText = sections.join('\n');
  if (semrushSupplementalSection && !briefText.includes('## Semrush Supplemental')) {
    const anchorPattern = /(## Cross-Tool Keyword Validation|## Competitive Landscape|## Competitor Authority|## Keyword Research Opportunities|## Backlink Intelligence|## New Content Opportunities)/;
    briefText = anchorPattern.test(briefText)
      ? briefText.replace(anchorPattern, `${semrushSupplementalSection}\n\n$1`)
      : `${briefText}\n\n${semrushSupplementalSection}`;
  }

  writeText(path.join(outputDir, 'brief.md'), briefText);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    sections: {
      ctrWins: ctrWins.length,
      refreshCandidates: refreshCandidates.length,
      newContentOpportunities: newContentOpportunities.length,
      linkTargets: rankedLinkTargets.length,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
