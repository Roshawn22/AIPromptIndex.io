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

  const sections = [
    headerLines.join('\n'),
    semrushSnapshotSection,
    crossToolSection,
    competitiveLandscapeSection,
    buildAiVisibilitySection(semrushKeywords, brandRadar),
  ];

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

  writeText(path.join(outputDir, 'brief.md'), sections.join('\n'));

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
