import fs from 'node:fs';
import path from 'node:path';

import {
  getSeoOutputDir,
  normalizeText,
  numberValue,
  readJson,
  uniqueBy,
  writeJson,
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

function scoreCandidate(candidate) {
  let score = 0;

  // Volume weight: logarithmic scale to prevent massive volumes from dominating
  const volume = numberValue(candidate.volume);
  if (volume > 0) {
    score += Math.log10(volume + 1) * 20;
  }

  // Bonus for having existing content on the site
  if (candidate.hasExistingContent) {
    score += 25;
  }

  // Low competition bonus (keyword difficulty or inferred from position)
  const difficulty = numberValue(candidate.difficulty);
  if (difficulty > 0 && difficulty <= 30) {
    score += 20;
  } else if (difficulty > 30 && difficulty <= 50) {
    score += 10;
  }

  // Bonus for traffic potential
  const trafficPotential = numberValue(candidate.trafficPotential);
  if (trafficPotential > 0) {
    score += Math.log10(trafficPotential + 1) * 10;
  }

  // Multi-source bonus: keyword appears in multiple data sources
  const sourceCount = (candidate.sources || []).length;
  if (sourceCount >= 3) {
    score += 15;
  } else if (sourceCount >= 2) {
    score += 8;
  }

  // Multi-competitor interest bonus
  const competitorCount = numberValue(candidate.competitorCount);
  if (competitorCount >= 3) {
    score += 15;
  } else if (competitorCount >= 2) {
    score += 8;
  }

  return Math.round(score * 100) / 100;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  const keywordGapsData = readOptional('keyword-gaps.json');
  const contentBriefsData = readOptional('content-briefs.json');
  const ahrefsKeywordsData = readOptional('ahrefs-keywords.json');

  const gapKeywords = keywordGapsData?.gaps || [];
  const briefs = contentBriefsData?.briefs || [];
  const ownKeywords = ahrefsKeywordsData?.rows || [];

  if (gapKeywords.length === 0 && briefs.length === 0 && ownKeywords.length === 0) {
    warnings.push('No input data found. Run keyword-gap-analysis, generate-content-briefs, or pull-ahrefs first.');
  }

  // Build candidate list from all sources
  const candidates = new Map();

  function addCandidate(keyword, data) {
    const key = normalizeText(keyword);
    if (!key) return;

    const existing = candidates.get(key);
    if (existing) {
      // Merge: keep higher volume, accumulate sources
      existing.volume = Math.max(existing.volume, numberValue(data.volume));
      if (data.source && !existing.sources.includes(data.source)) {
        existing.sources.push(data.source);
      }
      if (data.hasExistingContent) existing.hasExistingContent = true;
      if (data.difficulty !== null && data.difficulty !== undefined) {
        existing.difficulty = existing.difficulty === null
          ? numberValue(data.difficulty)
          : Math.min(existing.difficulty, numberValue(data.difficulty));
      }
      if (numberValue(data.trafficPotential) > existing.trafficPotential) {
        existing.trafficPotential = numberValue(data.trafficPotential);
      }
      if (numberValue(data.competitorCount) > existing.competitorCount) {
        existing.competitorCount = numberValue(data.competitorCount);
      }
    } else {
      candidates.set(key, {
        keyword,
        normalizedKeyword: key,
        volume: numberValue(data.volume),
        difficulty: data.difficulty !== null && data.difficulty !== undefined ? numberValue(data.difficulty) : null,
        trafficPotential: numberValue(data.trafficPotential),
        competitorCount: numberValue(data.competitorCount),
        hasExistingContent: data.hasExistingContent || false,
        currentPosition: data.currentPosition || null,
        sources: data.source ? [data.source] : [],
      });
    }
  }

  // Source 1: Gap keywords from competitor analysis
  for (const gap of gapKeywords) {
    addCandidate(gap.keyword, {
      volume: gap.volume,
      trafficPotential: gap.trafficPotential,
      competitorCount: gap.competitorCount,
      difficulty: null,
      hasExistingContent: false,
      source: 'keyword-gap',
    });
  }

  // Source 2: Brief target keywords
  for (const brief of briefs) {
    addCandidate(brief.keyword, {
      volume: brief.volume,
      difficulty: brief.difficulty,
      trafficPotential: brief.trafficPotential,
      competitorCount: 0,
      hasExistingContent: false,
      source: 'content-brief',
    });
  }

  // Source 3: Existing ranked keywords (for monitoring)
  for (const kw of ownKeywords) {
    addCandidate(kw.keyword, {
      volume: kw.volume,
      difficulty: null,
      trafficPotential: kw.sum_traffic,
      competitorCount: 0,
      hasExistingContent: true,
      currentPosition: kw.best_position,
      source: 'existing-ranking',
    });
  }

  // Identify top-performing set (position <= 5, volume >= 100) to filter out
  const topPerformingKeywords = new Set();
  for (const kw of ownKeywords) {
    const pos = numberValue(kw.best_position);
    const vol = numberValue(kw.volume);
    if (pos > 0 && pos <= 5 && vol >= 100) {
      topPerformingKeywords.add(normalizeText(kw.keyword));
    }
  }

  // Score, filter, and rank candidates
  const scoredCandidates = [...candidates.values()]
    .filter((c) => {
      // Remove already top-performing keywords
      if (topPerformingKeywords.has(c.normalizedKeyword)) return false;
      // Must have some volume signal
      if (c.volume < 10) return false;
      // Exclude branded queries
      if (/\baipromptindex\b/i.test(c.keyword)) return false;
      return true;
    })
    .map((c) => ({
      ...c,
      score: scoreCandidate(c),
    }))
    .sort((a, b) => b.score - a.score);

  // Deduplicate by normalized keyword
  const deduplicated = uniqueBy(scoredCandidates, (c) => c.normalizedKeyword);

  // Take top 25 suggestions
  const suggestions = deduplicated.slice(0, 25).map((c, index) => ({
    rank: index + 1,
    keyword: c.keyword,
    volume: c.volume,
    difficulty: c.difficulty,
    trafficPotential: c.trafficPotential,
    competitorCount: c.competitorCount,
    hasExistingContent: c.hasExistingContent,
    currentPosition: c.currentPosition,
    score: c.score,
    sources: c.sources,
  }));

  const output = {
    source: 'suggest-rank-tracker-keywords',
    generatedAt,
    warnings,
    summary: {
      totalCandidatesEvaluated: candidates.size,
      topPerformingFiltered: topPerformingKeywords.size,
      suggestionsGenerated: suggestions.length,
      sourceBreakdown: {
        fromGapAnalysis: gapKeywords.length,
        fromContentBriefs: briefs.length,
        fromExistingRankings: ownKeywords.length,
      },
    },
    suggestions,
  };

  writeJson(path.join(outputDir, 'rank-tracker-suggestions.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    ...output.summary,
    topSuggestions: suggestions.slice(0, 5).map((s) => ({
      keyword: s.keyword,
      volume: s.volume,
      score: s.score,
    })),
    warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
