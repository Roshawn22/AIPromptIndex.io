import fs from 'node:fs';
import path from 'node:path';

import {
  fetchAhrefsJson,
  getSeoOutputDir,
  inferOpportunitySurface,
  loadSiteInventory,
  normalizeText,
  numberValue,
  readJson,
  scoreKeywordMatch,
  writeJson,
  writeText,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();

function readOptional(fileName) {
  const filePath = path.join(outputDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${fileName} not found in ${outputDir}, continuing with empty data.`);
    return null;
  }
  return readJson(filePath);
}

function estimateCtr(position) {
  if (position <= 1) return 0.30;
  if (position <= 3) return 0.15;
  if (position <= 5) return 0.08;
  if (position <= 10) return 0.04;
  if (position <= 20) return 0.02;
  return 0.005;
}

function findInternalLinkingTargets(keyword, inventory, maxTargets = 5) {
  return inventory
    .map((entry) => ({
      pathname: entry.pathname,
      surface: entry.surface,
      label: entry.label,
      relevance: scoreKeywordMatch(keyword, entry),
    }))
    .filter((item) => item.relevance >= 0.3)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxTargets);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  const ahrefsKeywordsData = readOptional('ahrefs-keywords.json');
  const crossValidationData = readOptional('cross-validation.json');
  const inventory = loadSiteInventory();

  const ownKeywords = ahrefsKeywordsData?.rows || [];
  const crossMatched = crossValidationData?.matched || [];

  // Build a set of keywords where we rank well (position <= 20)
  const wellRankedKeywords = new Set();
  for (const row of ownKeywords) {
    const pos = numberValue(row.best_position);
    if (pos > 0 && pos <= 20) {
      wellRankedKeywords.add(normalizeText(row.keyword));
    }
  }

  // Also consider cross-validation matched keywords
  for (const row of crossMatched) {
    const bestPos = Math.min(
      numberValue(row.semrushPosition, Infinity),
      numberValue(row.ahrefsPosition, Infinity)
    );
    if (bestPos > 0 && bestPos <= 20) {
      wellRankedKeywords.add(normalizeText(row.keyword));
    }
  }

  // Find gap keywords: volume >= 50, position > 20 or not ranked
  const gapKeywords = ownKeywords
    .filter((row) => {
      const volume = numberValue(row.volume);
      const position = numberValue(row.best_position);
      if (volume < 50) return false;
      if (position > 0 && position <= 20) return false;
      // Exclude branded keywords
      if (/\baipromptindex\b/i.test(row.keyword)) return false;
      return true;
    })
    .sort((a, b) => numberValue(b.volume) - numberValue(a.volume))
    .slice(0, 20);

  // Enrich top-20 gap keywords with Keywords Explorer data
  const enrichedKeywords = [];
  for (const row of gapKeywords) {
    let enrichment = null;
    try {
      const response = await fetchAhrefsJson('keywords-explorer/overview', {
        select: 'keyword,volume,keyword_difficulty,cpc',
        keywords: row.keyword,
        country: 'us',
      });
      const metrics = response?.keywords?.[0] || response?.rows?.[0] || response || {};
      enrichment = {
        volume: numberValue(metrics.volume, numberValue(row.volume)),
        difficulty: numberValue(metrics.keyword_difficulty),
        cpc: numberValue(metrics.cpc),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Keywords Explorer enrichment failed for "${row.keyword}": ${message}`);
      enrichment = {
        volume: numberValue(row.volume),
        difficulty: null,
        cpc: null,
      };
    }
    enrichedKeywords.push({ keyword: row.keyword, ...enrichment });
  }

  // Generate briefs
  const briefs = enrichedKeywords.map((kw) => {
    const suggestedSurface = inferOpportunitySurface(kw.keyword);
    const linkingTargets = findInternalLinkingTargets(kw.keyword, inventory);
    const volume = numberValue(kw.volume);
    const difficulty = kw.difficulty;

    // Generate a suggested title
    const titlePrefix = {
      'best-of roundup': 'Best',
      'audience page': 'AI Prompts for',
      'guide': 'How to Use',
      'prompt page': '',
      'category hub': '',
      'blog': '',
    }[suggestedSurface] || '';

    const capitalizedKeyword = kw.keyword
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const suggestedTitle = titlePrefix
      ? `${titlePrefix} ${capitalizedKeyword}`
      : `${capitalizedKeyword} - AI Prompt Index`;

    return {
      keyword: kw.keyword,
      volume,
      difficulty,
      cpc: kw.cpc,
      suggestedSurface,
      suggestedTitle,
      trafficPotential: Math.round(volume * estimateCtr(21)),
      internalLinkingTargets: linkingTargets,
    };
  });

  // Sort by traffic potential (volume descending as proxy)
  briefs.sort((a, b) => numberValue(b.volume) - numberValue(a.volume));

  const output = {
    source: 'generate-content-briefs',
    generatedAt,
    warnings,
    summary: {
      totalGapKeywords: gapKeywords.length,
      briefsGenerated: briefs.length,
      surfaceBreakdown: briefs.reduce((acc, b) => {
        acc[b.suggestedSurface] = (acc[b.suggestedSurface] || 0) + 1;
        return acc;
      }, {}),
    },
    briefs,
  };

  writeJson(path.join(outputDir, 'content-briefs.json'), output);

  // Generate markdown brief
  const mdLines = [
    '# Content Briefs',
    '',
    `Generated: ${generatedAt}`,
    `Source: \`${outputDir}\``,
    '',
    `## Summary`,
    '',
    `- Gap keywords analyzed: ${gapKeywords.length}`,
    `- Briefs generated: ${briefs.length}`,
    '',
  ];

  if (warnings.length > 0) {
    mdLines.push('### Warnings', '');
    warnings.forEach((w) => mdLines.push(`- ${w}`));
    mdLines.push('');
  }

  mdLines.push('## Briefs', '');

  briefs.forEach((brief, index) => {
    mdLines.push(`### ${index + 1}. ${brief.suggestedTitle}`);
    mdLines.push('');
    mdLines.push(`- **Target keyword:** \`${brief.keyword}\``);
    mdLines.push(`- **Volume:** ${brief.volume.toLocaleString()}`);
    mdLines.push(`- **Difficulty:** ${brief.difficulty !== null ? brief.difficulty : 'n/a'}`);
    mdLines.push(`- **CPC:** ${brief.cpc !== null ? `$${brief.cpc.toFixed(2)}` : 'n/a'}`);
    mdLines.push(`- **Suggested page type:** ${brief.suggestedSurface}`);
    mdLines.push(`- **Estimated traffic potential:** ~${brief.trafficPotential.toLocaleString()} visits/mo`);

    if (brief.internalLinkingTargets.length > 0) {
      mdLines.push(`- **Internal linking targets:**`);
      brief.internalLinkingTargets.forEach((target) => {
        mdLines.push(`  - \`${target.pathname}\` [${target.surface}] (relevance: ${(target.relevance * 100).toFixed(0)}%)`);
      });
    } else {
      mdLines.push(`- **Internal linking targets:** none found`);
    }

    mdLines.push('');
  });

  writeText(path.join(outputDir, 'content-briefs.md'), mdLines.join('\n'));

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    ...output.summary,
    warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
