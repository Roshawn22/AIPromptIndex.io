import path from 'node:path';

import { parseCliArgs, toIsoDate } from '../seo/_shared.mjs';
import {
  cachedSystemOne,
  loadJson,
  loadPrompts,
  mapLimit,
  normalizeScore,
  openCache,
  requireApiKey,
  summarizeUsage,
  typesafeOutputRoot,
  writeJsonFile,
  writeTextFile,
} from './_client.mjs';
import {
  QUALITY_DIMENSIONS,
  categoryQuestion,
  compositeQuality,
  descriptionAccuracyQuestion,
  difficultyQuestion,
  qualityQuestions,
  tagQuestion,
} from './rubrics.mjs';

// Calibrated against the first full run of 156 prompts (2026-09-19); re-tune when the
// catalog or the rubrics change. Re-interpreting is free — answers are cached.
export const AUDIT_THRESHOLDS = {
  // Category disagreements carry a median confidence of 0.93, so 0.6 barely filters.
  // Difficulty is far weaker (the model calls almost nothing "advanced" and is unsure at a
  // median 0.50), so only near-certain difficulty disagreements are worth a reviewer's time.
  relabelConfidence: { category: 0.6, difficulty: 0.8 },
  // Observed accuracy never dropped below 0.66, so the old 0.4 cutoff could never fire.
  descriptionInaccurate: 0.7,
  weakTag: 0.3,
  // Composite quality spans only 0.79–0.99 on a curated catalog, so an absolute cutoff is
  // meaningless. Outliers are the weakest tenth *within a promptType*, because image prompts
  // score systematically lower on rubrics written around text output.
  lowQualityPercentile: 0.1,
  minGroupForOutliers: 10,
  featuredCandidates: 15,
};

const MAX_TAG_QUESTIONS = 10;

export function buildAuditRequest(prompt, categories) {
  // The current category/difficulty/tags are deliberately left out of state so the model
  // judges the prompt itself instead of agreeing with the existing label.
  const state = {
    prompt: {
      title: prompt.title,
      promptText: prompt.promptText,
      description: prompt.description,
      ...(prompt.metaDescription ? { metaDescription: prompt.metaDescription } : {}),
      variables: (prompt.variables || []).map((variable) => ({
        name: variable.name,
        description: variable.description,
      })),
    },
  };
  const tags = (prompt.tags || []).slice(0, MAX_TAG_QUESTIONS);
  const questions = {
    ...qualityQuestions(),
    category: categoryQuestion(categories),
    difficulty: difficultyQuestion(),
    descriptionAccurate: descriptionAccuracyQuestion('description'),
    ...(prompt.metaDescription ? { metaDescriptionAccurate: descriptionAccuracyQuestion('metaDescription') } : {}),
    ...Object.fromEntries(tags.map((tag, index) => [`tag_${index}`, tagQuestion(tag)])),
  };
  return { state, questions, tags };
}

export function interpretAudit(prompt, answers, tags, thresholds = AUDIT_THRESHOLDS) {
  const dimensions = Object.fromEntries(
    Object.entries(QUALITY_DIMENSIONS).map(([id, dimension]) => [id, normalizeScore(answers[id], dimension.levels.length)]),
  );
  const quality = compositeQuality(dimensions);
  const findings = [];

  for (const field of ['category', 'difficulty']) {
    const answer = answers[field];
    if (answer && answer.choice !== prompt[field] && answer.confidence >= thresholds.relabelConfidence[field]) {
      findings.push({
        type: `${field}-mismatch`,
        current: prompt[field],
        suggested: answer.choice,
        confidence: answer.confidence,
      });
    }
  }
  for (const [id, field] of [['descriptionAccurate', 'description'], ['metaDescriptionAccurate', 'metaDescription']]) {
    const answer = answers[id];
    if (answer && answer.noul < thresholds.descriptionInaccurate) {
      findings.push({ type: `${field}-inaccurate`, probabilityAccurate: answer.noul });
    }
  }
  tags.forEach((tag, index) => {
    const answer = answers[`tag_${index}`];
    if (answer && answer.noul < thresholds.weakTag) {
      findings.push({ type: 'weak-tag', tag, probabilityAccurate: answer.noul });
    }
  });
  return {
    slug: prompt.slug,
    title: prompt.title,
    promptType: prompt.promptType || 'text',
    isFeatured: Boolean(prompt.isFeatured),
    quality,
    dimensions,
    findings,
  };
}

function percentileCutoff(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)];
}

/**
 * Flags the weakest prompts relative to their own promptType. Absolute quality cutoffs are
 * useless on a curated catalog where everything scores highly, and a single global cutoff
 * would just rediscover that image prompts score lower than text ones.
 */
export function addQualityOutliers(results, thresholds = AUDIT_THRESHOLDS) {
  const groups = new Map();
  for (const result of results) {
    if (result.quality === null || result.error) continue;
    const group = groups.get(result.promptType) || [];
    group.push(result);
    groups.set(result.promptType, group);
  }
  for (const [, group] of groups) {
    if (group.length < thresholds.minGroupForOutliers) continue;
    const cutoff = percentileCutoff(group.map((result) => result.quality), thresholds.lowQualityPercentile);
    for (const result of group) {
      if (result.quality > cutoff) continue;
      const weakest = Object.entries(result.dimensions)
        .filter(([, value]) => typeof value === 'number')
        .sort((a, b) => a[1] - b[1])[0];
      result.findings.push({
        type: 'weakest-of-type',
        quality: result.quality,
        promptType: result.promptType,
        weakestDimension: weakest?.[0],
      });
    }
  }
  return results;
}

/** The model's label distribution vs the catalog's, to catch a rubric that is skewed overall. */
export function labelSkew(results, prompts, field) {
  const counts = { catalog: {}, model: {} };
  for (const result of results) {
    const prompt = prompts.find((entry) => entry.slug === result.slug);
    const answer = result.answers?.[field];
    if (!prompt || !answer) continue;
    counts.catalog[prompt[field]] = (counts.catalog[prompt[field]] || 0) + 1;
    counts.model[answer.choice] = (counts.model[answer.choice] || 0) + 1;
  }
  return counts;
}

function buildReport(results, thresholds, skew) {
  const ranked = results.filter((result) => result.quality !== null).sort((a, b) => b.quality - a.quality);
  const percent = (value) => `${Math.round(value * 100)}`;
  const lines = [
    `# Catalog audit — ${toIsoDate()}`,
    '',
    `${results.length} prompts judged by TypeSafe. Scores are 0–100 composites of clarity, specificity, reusability and output guidance.`,
    'Every item below is a suggestion for a human to confirm; nothing in `src/data/prompts` was changed.',
    '',
    '## Difficulty label skew',
    '',
    'How the catalog labels difficulty vs how the model reads it. A large gap here means the',
    'rubric and the catalog disagree on what a level means — treat it as one question about the',
    'labelling scheme, not as one error per prompt.',
    '',
    `- catalog: ${JSON.stringify(skew.catalog)}`,
    `- model:   ${JSON.stringify(skew.model)}`,
    '',
    '## Cleanup list',
    '',
  ];
  const withFindings = results.filter((result) => result.findings.length > 0);
  if (withFindings.length === 0) lines.push('No findings above the configured thresholds.', '');
  for (const result of withFindings) {
    lines.push(`### ${result.title} (\`${result.slug}\`) — quality ${result.quality === null ? 'n/a' : percent(result.quality)}`);
    for (const finding of result.findings) {
      if (finding.type.endsWith('-mismatch')) {
        lines.push(`- ${finding.type}: \`${finding.current}\` → \`${finding.suggested}\` (confidence ${percent(finding.confidence)})`);
      } else if (finding.type === 'weak-tag') {
        lines.push(`- weak tag \`${finding.tag}\` (${percent(finding.probabilityAccurate)}% likely accurate)`);
      } else if (finding.type === 'weakest-of-type') {
        lines.push(`- among the weakest ${finding.promptType} prompts; weakest dimension: ${finding.weakestDimension}`);
      } else {
        lines.push(`- ${finding.type} (${percent(finding.probabilityAccurate)}% likely accurate)`);
      }
    }
    lines.push('');
  }

  lines.push('## Featured suggestions', '');
  lines.push('Ranked within each promptType, because rubrics written around text output score', 'image prompts lower as a group.', '');
  const types = [...new Set(ranked.map((result) => result.promptType))].sort();
  for (const promptType of types) {
    const inType = ranked.filter((result) => result.promptType === promptType);
    const candidates = inType.filter((result) => !result.isFeatured).slice(0, thresholds.featuredCandidates);
    if (candidates.length === 0) continue;
    lines.push(`### ${promptType} — highest quality, not currently featured`, '');
    for (const result of candidates) lines.push(`- ${percent(result.quality)} — ${result.title} (\`${result.slug}\`)`);
    const median = inType[Math.floor(inType.length / 2)].quality;
    const weakFeatured = inType.filter((result) => result.isFeatured && result.quality < median);
    if (weakFeatured.length > 0) {
      lines.push('', `Currently featured but below the ${promptType} median:`, '');
      for (const result of weakFeatured) lines.push(`- ${percent(result.quality)} — ${result.title} (\`${result.slug}\`)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const args = parseCliArgs();
  const categories = loadJson('src/data/categories/categories.json', []);
  let prompts = loadPrompts();
  if (args.slug) prompts = prompts.filter((prompt) => prompt.slug === args.slug);
  if (args.limit) prompts = prompts.slice(0, Number(args.limit));

  if (args['dry-run']) {
    const { state, questions } = buildAuditRequest(prompts[0], categories);
    console.log(JSON.stringify({ state, questions }, null, 2));
    return;
  }

  requireApiKey();
  const cache = openCache('catalog-audit');
  const responses = [];
  const results = await mapLimit(prompts, Number(args.concurrency || 4), async (prompt) => {
    const { state, questions, tags } = buildAuditRequest(prompt, categories);
    try {
      const response = await cachedSystemOne(cache, { state, questions });
      responses.push(response);
      return { ...interpretAudit(prompt, response.answers, tags), answers: response.answers };
    } catch (error) {
      return { slug: prompt.slug, title: prompt.title, quality: null, dimensions: {}, findings: [], error: error.message };
    }
  });
  cache.save();
  addQualityOutliers(results, AUDIT_THRESHOLDS);
  const skew = labelSkew(results, prompts, 'difficulty');

  const outputDir = path.join(typesafeOutputRoot, toIsoDate());
  const jsonPath = writeJsonFile(path.join(outputDir, 'catalog-audit.json'), {
    generatedAt: new Date().toISOString(),
    thresholds: AUDIT_THRESHOLDS,
    weights: Object.fromEntries(Object.entries(QUALITY_DIMENSIONS).map(([id, dimension]) => [id, dimension.weight])),
    usage: summarizeUsage(responses),
    results,
  });
  const reportPath = writeTextFile(path.join(outputDir, 'catalog-audit.md'), buildReport(results, AUDIT_THRESHOLDS, skew));
  console.log(JSON.stringify({
    ok: true,
    prompts: results.length,
    failed: results.filter((result) => result.error).length,
    withFindings: results.filter((result) => result.findings.length > 0).length,
    usage: summarizeUsage(responses),
    jsonPath,
    reportPath,
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
