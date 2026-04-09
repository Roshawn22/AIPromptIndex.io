import fs from 'node:fs';
import path from 'node:path';

import {
  fetchAhrefsJson,
  getSeoOutputDir,
  normalizeText,
  numberValue,
  optionalEnv,
  readJson,
  toIsoDate,
  uniqueBy,
  writeJson,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();
const target = optionalEnv('AHREFS_TARGET', 'aipromptindex.io');
const mode = optionalEnv('AHREFS_TARGET_MODE', 'subdomains');
const today = toIsoDate(new Date());

const PROMPT_RELATED_TERMS = [
  'prompt', 'prompts', 'ai', 'chatgpt', 'claude', 'midjourney',
  'template', 'templates', 'gpt', 'openai', 'gemini', 'copilot',
  'dall-e', 'stable diffusion', 'llm', 'generative', 'ai tool',
  'ai tools', 'ai writing', 'ai image', 'ai art', 'ai assistant',
];

function readOptional(fileName) {
  const filePath = path.join(outputDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${fileName} not found in ${outputDir}, continuing with empty data.`);
    return null;
  }
  return readJson(filePath);
}

function isPromptRelated(keyword) {
  const normalized = normalizeText(keyword);
  return PROMPT_RELATED_TERMS.some((term) => normalized.includes(term));
}

function estimateCtrFromPosition(position) {
  if (position <= 1) return 0.30;
  if (position <= 2) return 0.18;
  if (position <= 3) return 0.12;
  if (position <= 5) return 0.08;
  if (position <= 10) return 0.04;
  if (position <= 20) return 0.02;
  return 0.005;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  const competitorsData = readOptional('ahrefs-competitors.json');
  const ahrefsKeywordsData = readOptional('ahrefs-keywords.json');

  if (!competitorsData || (competitorsData.rows || []).length === 0) {
    console.log(JSON.stringify({
      ok: true,
      outputDir,
      message: 'No competitor data found. Run seo:pull:ahrefs first to generate competitor data.',
      warnings: ['ahrefs-competitors.json not found or empty'],
    }, null, 2));
    writeJson(path.join(outputDir, 'keyword-gaps.json'), {
      source: 'keyword-gap-analysis',
      generatedAt,
      warnings: ['No competitor data available'],
      summary: null,
      gaps: [],
    });
    return;
  }

  // Build a set of our own keywords
  const ownKeywords = new Set();
  const ownKeywordPositions = new Map();
  for (const row of (ahrefsKeywordsData?.rows || [])) {
    const key = normalizeText(row.keyword);
    if (key) {
      ownKeywords.add(key);
      ownKeywordPositions.set(key, numberValue(row.best_position));
    }
  }

  // Take top 5 competitors by traffic
  const competitors = (competitorsData.rows || [])
    .sort((a, b) => numberValue(b.traffic) - numberValue(a.traffic))
    .slice(0, 5);

  // Fetch keywords for each competitor
  const competitorKeywords = new Map();
  for (const competitor of competitors) {
    const domain = competitor.domain;
    try {
      const response = await fetchAhrefsJson('site-explorer/organic-keywords', {
        target: domain,
        mode: 'subdomains',
        limit: 100,
        select: 'keyword,best_position,volume,sum_traffic',
        country: 'us',
        date: today,
        output: 'json',
      });

      const rows = Array.isArray(response?.rows) ? response.rows
        : Array.isArray(response?.data) ? response.data
        : [];

      for (const row of rows) {
        const key = normalizeText(row.keyword);
        if (!key) continue;

        const existing = competitorKeywords.get(key);
        const position = numberValue(row.best_position);
        const volume = numberValue(row.volume);
        const traffic = numberValue(row.sum_traffic);

        if (!existing) {
          competitorKeywords.set(key, {
            keyword: row.keyword,
            volume,
            competitorDomains: [domain],
            bestCompetitorPosition: position,
            bestCompetitorDomain: domain,
            totalCompetitorTraffic: traffic,
          });
        } else {
          if (!existing.competitorDomains.includes(domain)) {
            existing.competitorDomains.push(domain);
          }
          existing.totalCompetitorTraffic += traffic;
          if (position < existing.bestCompetitorPosition) {
            existing.bestCompetitorPosition = position;
            existing.bestCompetitorDomain = domain;
          }
          // Use the higher volume if available
          if (volume > existing.volume) {
            existing.volume = volume;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to fetch keywords for ${domain}: ${message}`);
    }
  }

  // Find gaps: competitor keywords where we don't rank
  const gaps = [];
  for (const [key, data] of competitorKeywords) {
    // Skip if we already rank for this keyword
    if (ownKeywords.has(key)) continue;

    // Filter to prompt-related keywords with volume > 50
    if (!isPromptRelated(data.keyword)) continue;
    if (data.volume < 50) continue;

    // Estimate traffic potential based on competitor position
    const estimatedCtr = estimateCtrFromPosition(data.bestCompetitorPosition);
    const trafficPotential = Math.round(data.volume * estimatedCtr);

    gaps.push({
      keyword: data.keyword,
      volume: data.volume,
      bestCompetitorPosition: data.bestCompetitorPosition,
      bestCompetitorDomain: data.bestCompetitorDomain,
      competitorCount: data.competitorDomains.length,
      competitorDomains: data.competitorDomains,
      totalCompetitorTraffic: data.totalCompetitorTraffic,
      trafficPotential,
    });
  }

  // Rank by traffic potential
  gaps.sort((a, b) => b.trafficPotential - a.trafficPotential);

  // Deduplicate by normalized keyword text
  const uniqueGaps = uniqueBy(gaps, (g) => normalizeText(g.keyword));

  const output = {
    source: 'keyword-gap-analysis',
    generatedAt,
    target,
    competitorsAnalyzed: competitors.map((c) => c.domain),
    warnings,
    summary: {
      totalCompetitorKeywords: competitorKeywords.size,
      ownKeywordsCount: ownKeywords.size,
      gapsFound: uniqueGaps.length,
      topGapVolume: uniqueGaps.length > 0 ? uniqueGaps[0].volume : 0,
      totalTrafficPotential: uniqueGaps.reduce((sum, g) => sum + g.trafficPotential, 0),
    },
    gaps: uniqueGaps,
  };

  writeJson(path.join(outputDir, 'keyword-gaps.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    ...output.summary,
    competitorsAnalyzed: output.competitorsAnalyzed,
    warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
