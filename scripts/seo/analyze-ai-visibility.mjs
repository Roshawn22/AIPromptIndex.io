import fs from 'node:fs';
import path from 'node:path';

import {
  addDays,
  getSeoOutputDir,
  normalizePathname,
  numberValue,
  readJson,
  seoOutputRoot,
  toIsoDate,
  writeJson,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();

function readOptional(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found, continuing with empty data.`);
    return null;
  }
  return readJson(filePath);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractMetrics(dataBySource) {
  const result = {};
  for (const [source, data] of Object.entries(dataBySource || {})) {
    result[source] = safeArray(data?.metrics || data?.rows || data);
  }
  return result;
}

function buildPlatformMentions(impressions, mentions) {
  const platforms = new Set([
    ...Object.keys(impressions || {}),
    ...Object.keys(mentions || {}),
  ]);

  return [...platforms].map((platform) => {
    const impMetrics = safeArray(impressions?.[platform]?.metrics);
    const mentionMetrics = safeArray(mentions?.[platform]?.metrics);

    const totalImpressions = impMetrics.reduce((sum, m) => sum + numberValue(m.total), 0);
    const brandImpressions = impMetrics.reduce((sum, m) => sum + numberValue(m.only_target_brand), 0);
    const totalMentions = mentionMetrics.reduce((sum, m) => sum + numberValue(m.total), 0);
    const brandMentions = mentionMetrics.reduce((sum, m) => sum + numberValue(m.only_target_brand), 0);

    return {
      platform,
      totalImpressions,
      brandImpressions,
      totalMentions,
      brandMentions,
    };
  }).sort((a, b) => b.brandImpressions - a.brandImpressions);
}

function buildShareOfVoice(sov) {
  const platforms = {};
  for (const [source, data] of Object.entries(sov || {})) {
    const metrics = safeArray(data?.metrics || data?.rows || data);
    platforms[source] = metrics.map((m) => ({
      brand: m.brand || '',
      shareOfVoice: numberValue(m.share_of_voice),
    }));
  }
  return platforms;
}

function buildTopQuestions(aiResponses) {
  const allQuestions = [];
  for (const [source, data] of Object.entries(aiResponses || {})) {
    const responses = safeArray(data?.ai_responses || data?.rows || data);
    for (const resp of responses) {
      allQuestions.push({
        question: resp.question || '',
        volume: numberValue(resp.volume),
        platform: resp.data_source || source,
        country: resp.country || 'us',
      });
    }
  }
  return allQuestions
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 20);
}

function buildCitedPages(citedPages) {
  const pageMap = new Map();
  for (const [source, data] of Object.entries(citedPages || {})) {
    const pages = safeArray(data?.cited_pages || data?.rows || data);
    for (const page of pages) {
      const url = page.cited_url || '';
      const pathname = normalizePathname(url);
      const existing = pageMap.get(pathname) || {
        url,
        pathname,
        totalResponses: 0,
        totalVolume: 0,
        platforms: [],
      };
      existing.totalResponses += numberValue(page.responses);
      existing.totalVolume += numberValue(page.volume);
      if (!existing.platforms.includes(source)) {
        existing.platforms.push(source);
      }
      pageMap.set(pathname, existing);
    }
  }
  return [...pageMap.values()]
    .sort((a, b) => b.totalResponses - a.totalResponses);
}

function compareTrends(currentData, previousData) {
  if (!previousData) return null;

  const trends = {};

  // Compare impressions
  const currentPlatforms = buildPlatformMentions(currentData.impressions, currentData.mentions);
  const previousPlatforms = buildPlatformMentions(previousData.impressions, previousData.mentions);
  const prevByPlatform = new Map(previousPlatforms.map((p) => [p.platform, p]));

  trends.platformChanges = currentPlatforms.map((current) => {
    const prev = prevByPlatform.get(current.platform);
    if (!prev) return { ...current, impressionDelta: null, mentionDelta: null, isNew: true };
    return {
      platform: current.platform,
      impressionDelta: current.brandImpressions - prev.brandImpressions,
      impressionDeltaPct: prev.brandImpressions > 0
        ? Math.round(((current.brandImpressions - prev.brandImpressions) / prev.brandImpressions) * 100)
        : null,
      mentionDelta: current.brandMentions - prev.brandMentions,
      mentionDeltaPct: prev.brandMentions > 0
        ? Math.round(((current.brandMentions - prev.brandMentions) / prev.brandMentions) * 100)
        : null,
      isNew: false,
    };
  });

  // Compare cited pages count
  const currentCited = buildCitedPages(currentData.citedPages);
  const previousCited = buildCitedPages(previousData.citedPages);
  trends.citedPagesChange = {
    current: currentCited.length,
    previous: previousCited.length,
    delta: currentCited.length - previousCited.length,
  };

  return trends;
}

function generateRecommendations(platformMentions, citedPages, topQuestions, sov) {
  const recommendations = [];

  // Identify platforms where the brand is underrepresented
  for (const platform of platformMentions) {
    if (platform.totalImpressions > 0 && platform.brandImpressions === 0) {
      recommendations.push({
        type: 'platform-gap',
        priority: 'high',
        platform: platform.platform,
        message: `Brand has zero impressions on ${platform.platform} despite ${platform.totalImpressions} total impressions in the market. Optimize content for AI citation on this platform.`,
      });
    } else if (platform.totalImpressions > 0 && platform.brandImpressions / platform.totalImpressions < 0.05) {
      recommendations.push({
        type: 'low-visibility',
        priority: 'medium',
        platform: platform.platform,
        message: `Brand share on ${platform.platform} is below 5%. Focus on creating authoritative, structured content for AI citation.`,
      });
    }
  }

  // Identify high-volume questions where we are not cited
  const uncitedPathnames = new Set(citedPages.map((p) => p.pathname));
  const highVolQuestions = topQuestions.filter((q) => q.volume >= 100);
  if (highVolQuestions.length > 0 && citedPages.length === 0) {
    recommendations.push({
      type: 'content-gap',
      priority: 'high',
      message: `${highVolQuestions.length} high-volume AI questions found, but no pages are being cited. Create authoritative FAQ-style content targeting these questions.`,
      questions: highVolQuestions.slice(0, 5).map((q) => q.question),
    });
  }

  // Pages that are cited frequently should be kept updated
  const topCited = citedPages.slice(0, 5);
  for (const page of topCited) {
    recommendations.push({
      type: 'maintain-citation',
      priority: 'medium',
      pathname: page.pathname,
      message: `"${page.pathname}" is cited ${page.totalResponses} times across ${page.platforms.join(', ')}. Keep this page updated and accurate to maintain AI citation.`,
    });
  }

  // Share of voice improvements
  for (const [platform, brands] of Object.entries(sov)) {
    const ownBrand = brands.find((b) => b.brand?.toLowerCase().includes('aipromptindex'));
    const topBrand = brands.sort((a, b) => b.shareOfVoice - a.shareOfVoice)[0];
    if (ownBrand && topBrand && topBrand.brand !== ownBrand.brand && topBrand.shareOfVoice > ownBrand.shareOfVoice * 2) {
      recommendations.push({
        type: 'sov-gap',
        priority: 'medium',
        platform,
        message: `On ${platform}, leading brand "${topBrand.brand}" has ${(topBrand.shareOfVoice * 100).toFixed(1)}% SoV vs your ${(ownBrand.shareOfVoice * 100).toFixed(1)}%. Study their cited content for optimization ideas.`,
      });
    }
  }

  return recommendations
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  const brandRadar = readOptional(path.join(outputDir, 'brand-radar.json'));

  if (!brandRadar) {
    console.log(JSON.stringify({
      ok: true,
      outputDir,
      message: 'No brand-radar.json found. Run seo:pull:brand-radar first to generate AI visibility data.',
      warnings: ['brand-radar.json not found'],
    }, null, 2));
    writeJson(path.join(outputDir, 'ai-visibility-analysis.json'), {
      source: 'analyze-ai-visibility',
      generatedAt,
      warnings: ['brand-radar.json not found — no data to analyze'],
      summary: null,
      platformMentions: [],
      shareOfVoice: {},
      topQuestions: [],
      citedPages: [],
      trends: null,
      recommendations: [],
    });
    return;
  }

  // Analyze current data
  const platformMentions = buildPlatformMentions(brandRadar.impressions, brandRadar.mentions);
  const sov = buildShareOfVoice(brandRadar.sov);
  const topQuestions = buildTopQuestions(brandRadar.aiResponses);
  const citedPages = buildCitedPages(brandRadar.citedPages);

  // Attempt to load previous day's data for trend comparison
  const yesterday = toIsoDate(addDays(new Date(), -1));
  const previousOutputDir = path.join(seoOutputRoot, yesterday);
  const previousBrandRadar = readOptional(path.join(previousOutputDir, 'brand-radar.json'));

  let trends = null;
  if (previousBrandRadar) {
    trends = compareTrends(brandRadar, previousBrandRadar);
  } else {
    warnings.push(`No previous day data found at ${previousOutputDir}/brand-radar.json for trend comparison.`);
  }

  // Generate recommendations
  const recommendations = generateRecommendations(platformMentions, citedPages, topQuestions, sov);

  const summary = {
    activePlatforms: brandRadar.activeSources || [],
    totalPlatformsMeasured: platformMentions.length,
    totalBrandImpressions: platformMentions.reduce((sum, p) => sum + p.brandImpressions, 0),
    totalBrandMentions: platformMentions.reduce((sum, p) => sum + p.brandMentions, 0),
    citedPagesCount: citedPages.length,
    topQuestionsCount: topQuestions.length,
    recommendationsCount: recommendations.length,
    hasTrendData: trends !== null,
  };

  const output = {
    source: 'analyze-ai-visibility',
    generatedAt,
    warnings,
    summary,
    platformMentions,
    shareOfVoice: sov,
    topQuestions,
    citedPages,
    trends,
    recommendations,
  };

  writeJson(path.join(outputDir, 'ai-visibility-analysis.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    ...summary,
    warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
