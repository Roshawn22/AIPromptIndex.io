import path from 'node:path';

import { parseCliArgs, toIsoDate } from '../seo/_shared.mjs';
import {
  cachedSystemOne,
  loadJson,
  mapLimit,
  normalizeScore,
  noul,
  openCache,
  requireApiKey,
  score,
  summarizeUsage,
  typesafeOutputRoot,
  writeJsonFile,
  writeTextFile,
} from './_client.mjs';

// Advisory gate. Jev's primary training language is English and TypeSafe documents lower
// accuracy for other languages, so this pre-screens pages for the human reviewer and never
// edits `reviewStatus`. Structural checks (variables, lengths, fingerprints) stay in
// scripts/seo/guard-localization-pilot.mjs.
// Calibrated against the first run (2026-09-19), which flagged all 8 pilot pages. The cause
// was that these pages are deliberate condensations — one prompt description goes from 796
// to 224 characters — so a single "faithfulness" score marks intentional editing as failure.
// Contradiction and omission are now separate judgments: inventing or contradicting something
// is a defect, leaving material out is an editorial choice a human should confirm.
export const LOCALIZATION_THRESHOLDS = {
  contradiction: 0.5,
  omission: 0.5,
  naturalness: 0.6,
  // Only applied to the contradiction judgment. Naturalness confidence is routinely low
  // because Jev's accuracy outside English is lower, so gating on it flagged nearly everything.
  confidence: 0.4,
};

const OMISSION_LEVELS = [
  'Everything of substance in the source survives in the translation.',
  'A minor detail or nuance is left out; a reader would learn the same things.',
  'A meaningful point, constraint or example from the source is missing.',
  'Most of the source\'s substance is gone; the translation is a brief summary of a much fuller text.',
];

const NATURALNESS_LEVELS = [
  'Reads like word-for-word machine translation: awkward phrasing a Brazilian reader would stumble over, or European Portuguese usage.',
  'Understandable but stiff; several phrases sound translated rather than written in Brazilian Portuguese.',
  'Reads naturally to a Brazilian reader, with at most one slightly unusual phrase.',
  'Reads as if originally written by a fluent Brazilian Portuguese writer for a Brazilian audience.',
];

const asText = (value) => (Array.isArray(value) ? value.join('\n') : value);

export function sourceFieldsFor(page, { prompts, bestofPages }) {
  if (page.type === 'prompt') {
    const source = prompts.find((prompt) => prompt.slug === page.sourceSlug);
    if (!source) return {};
    return {
      title: source.title,
      description: source.description,
      metaDescription: source.metaDescription,
      promptText: source.promptText,
      tips: asText(source.tips),
    };
  }
  if (page.type === 'roundup') {
    const source = bestofPages.find((roundup) => roundup.slug === page.sourceSlug);
    return source ? { title: source.title, description: source.description } : {};
  }
  // The home page has no structured English source, so it is judged on naturalness only.
  return {};
}

const TRANSLATED_FIELDS = ['title', 'description', 'metaDescription', 'intro', 'heading', 'promptText', 'tips'];

export function buildLocalizationRequest(page, sourceFields) {
  const fields = TRANSLATED_FIELDS
    .filter((name) => page[name])
    .map((name) => ({
      name,
      ...(sourceFields[name] ? { source: asText(sourceFields[name]) } : {}),
      translation: asText(page[name]),
    }));
  const questions = {};
  fields.forEach((field, index) => {
    if (field.source) {
      // Asked separately because a condensed translation omits a great deal while
      // contradicting nothing, and only the second of those is a defect.
      questions[`contradicts_${index}`] = noul(
        `Does \`fields[${index}].translation\` (Brazilian Portuguese) state anything that contradicts \`fields[${index}].source\` (English), or add a claim the source does not make?`,
        {
          true: 'It asserts something the source does not support, names a different capability or benefit, or reverses an instruction.',
          false: 'Everything it asserts is supported by the source, even if it says less than the source does. Placeholders inside [SQUARE_BRACKETS] are meant to stay unchanged.',
        },
      );
      questions[`omits_${index}`] = score(
        `How much of the substance of \`fields[${index}].source\` (English) is missing from \`fields[${index}].translation\` (Brazilian Portuguese)?`,
        OMISSION_LEVELS,
      );
    }
    questions[`naturalness_${index}`] = score(
      `How natural is \`fields[${index}].translation\` as Brazilian Portuguese? Ignore placeholders inside [SQUARE_BRACKETS] and names of AI products.`,
      NATURALNESS_LEVELS,
    );
  });
  return {
    state: { sourceLocale: 'en', targetLocale: 'pt-BR', pageType: page.type, fields },
    questions,
    fields,
  };
}

export function interpretLocalization(sourcePath, page, fields, answers, thresholds = LOCALIZATION_THRESHOLDS) {
  const issues = [];
  const fieldResults = fields.map((field, index) => {
    const contradictsAnswer = answers[`contradicts_${index}`];
    const omitsAnswer = answers[`omits_${index}`];
    const naturalnessAnswer = answers[`naturalness_${index}`];
    const contradicts = contradictsAnswer ? contradictsAnswer.noul : null;
    const omission = normalizeScore(omitsAnswer, OMISSION_LEVELS.length);
    const naturalness = normalizeScore(naturalnessAnswer, NATURALNESS_LEVELS.length);

    // A defect: the translation says something the source does not.
    if (contradicts !== null && contradicts >= thresholds.contradiction) {
      issues.push({ field: field.name, type: 'contradiction', severity: 'defect', contradicts });
    }
    if (naturalness !== null && naturalness < thresholds.naturalness) {
      issues.push({ field: field.name, type: 'unnatural', severity: 'defect', naturalness });
    }
    // An editorial choice: confirm the condensation was deliberate.
    if (omission !== null && omission >= thresholds.omission) {
      issues.push({ field: field.name, type: 'condensed', severity: 'confirm', omission });
    }
    if (omitsAnswer && omitsAnswer.confidence < thresholds.confidence) {
      issues.push({ field: field.name, type: 'uncertain', severity: 'confirm', judgment: 'omission', confidence: omitsAnswer.confidence });
    }
    return { field: field.name, contradicts, omission, naturalness };
  });

  const defects = issues.filter((issue) => issue.severity === 'defect');
  return {
    sourcePath,
    type: page.type,
    reviewStatus: page.reviewStatus,
    verdict: defects.length > 0 ? 'needs-attention' : (issues.length > 0 ? 'confirm-intent' : 'no-issues-found'),
    fields: fieldResults,
    issues,
  };
}

function buildReport(results) {
  const percent = (value) => (typeof value === 'number' ? `${Math.round(value * 100)}` : 'n/a');
  const lines = [
    `# pt-BR localization pre-review — ${toIsoDate()}`,
    '',
    'Advisory TypeSafe judgments to focus the human reviewer. A clean result is not an approval:',
    'non-English accuracy is lower than English, and `reviewStatus` is only ever changed by a person.',
    '',
    '**fix** marks a defect: the translation contradicts the source, invents a claim, or reads unnaturally.',
    '**confirm** marks an editorial choice to verify — usually a deliberate condensation, which is',
    'expected on the length-capped description fields.',
    '',
  ];
  for (const result of results) {
    lines.push(`## ${result.sourcePath} — ${result.verdict} (${result.reviewStatus})`, '');
    if (result.error) {
      lines.push(`- not judged: ${result.error}`, '');
      continue;
    }
    for (const field of result.fields) {
      lines.push(`- ${field.field}: contradiction risk ${percent(field.contradicts)}, omission ${percent(field.omission)}, naturalness ${percent(field.naturalness)}`);
    }
    for (const issue of result.issues.filter((entry) => entry.severity === 'defect')) {
      lines.push(`- **fix ${issue.field}**: ${issue.type}`);
    }
    for (const issue of result.issues.filter((entry) => entry.severity === 'confirm')) {
      lines.push(`- confirm ${issue.field}: ${issue.type}${issue.judgment ? ` (${issue.judgment})` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const args = parseCliArgs();
  const pilot = loadJson('src/data/i18n/pt-BR/pilot-pages.json', { pages: {} });
  const context = {
    prompts: Object.values(pilot.pages)
      .filter((page) => page.type === 'prompt')
      .map((page) => loadJson(`src/data/prompts/${page.sourceSlug}.json`))
      .filter(Boolean),
    bestofPages: loadJson('src/data/seo/bestof-pages.json', []),
  };
  const entries = Object.entries(pilot.pages);

  if (args['dry-run']) {
    const [, page] = entries.find(([, candidate]) => candidate.type === 'prompt') || entries[0];
    const { state, questions } = buildLocalizationRequest(page, sourceFieldsFor(page, context));
    console.log(JSON.stringify({ state, questions }, null, 2));
    return;
  }

  requireApiKey();
  const cache = openCache('localization');
  const responses = [];
  const results = await mapLimit(entries, Number(args.concurrency || 3), async ([sourcePath, page]) => {
    const { state, questions, fields } = buildLocalizationRequest(page, sourceFieldsFor(page, context));
    try {
      const response = await cachedSystemOne(cache, { state, questions });
      responses.push(response);
      return interpretLocalization(sourcePath, page, fields, response.answers);
    } catch (error) {
      return { sourcePath, type: page.type, reviewStatus: page.reviewStatus, verdict: 'not-judged', fields: [], issues: [], error: error.message };
    }
  });
  cache.save();

  const outputDir = path.join(typesafeOutputRoot, toIsoDate());
  const jsonPath = writeJsonFile(path.join(outputDir, 'localization-review.json'), {
    generatedAt: new Date().toISOString(),
    locale: pilot.locale,
    thresholds: LOCALIZATION_THRESHOLDS,
    usage: summarizeUsage(responses),
    results,
  });
  const reportPath = writeTextFile(path.join(outputDir, 'localization-review.md'), buildReport(results));
  const needsAttention = results.filter((result) => result.verdict === 'needs-attention').length;
  const confirm = results.filter((result) => result.verdict === 'confirm-intent').length;
  console.log(JSON.stringify({
    ok: true, pages: results.length, needsAttention, confirmIntent: confirm,
    clean: results.filter((r) => r.verdict === 'no-issues-found').length,
    usage: summarizeUsage(responses), jsonPath, reportPath,
  }, null, 2));
  if (args.strict && needsAttention > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
