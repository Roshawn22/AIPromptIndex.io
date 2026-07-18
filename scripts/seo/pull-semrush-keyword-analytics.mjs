import path from 'node:path';

import {
  fetchSemrushRows,
  getSeoOutputDir,
  loadSeedKeywords,
  numberValue,
  optionalEnv,
  parseCliArgs,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const database = optionalEnv('SEMRUSH_DATABASE', 'us');
const maxSeeds = Number(args['max-seeds'] || 15);
const limitPerReport = Number(args['limit'] || 25);

function mapKeywordRow(row, seed) {
  return {
    keyword: row.Keyword || row.Ph || '',
    volume: numberValue(row['Search Volume'] || row.Nq),
    cpc: numberValue(row.CPC || row.Cp),
    competition: numberValue(row.Competition || row.Co),
    results: numberValue(row['Number of Results'] || row.Nr),
    trend: row.Trends || row.Td || '',
    difficulty: numberValue(row['Keyword Difficulty Index'] || row.Kd),
    seed: seed || '',
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];
  const seeds = loadSeedKeywords().slice(0, maxSeeds);

  if (seeds.length === 0) {
    throw new Error('No seed keywords. Populate scripts/config/seed-keywords.json.');
  }

  const overview = [];
  const related = [];
  const broadMatch = [];
  const questions = [];
  const difficulty = [];

  for (const seed of seeds) {
    try {
      const rows = await fetchSemrushRows('phrase_this', {
        phrase: seed,
        database,
        export_columns: 'Ph,Nq,Cp,Co,Nr,Td',
      });
      rows.forEach((row) => overview.push(mapKeywordRow(row, seed)));
    } catch (error) {
      warnings.push(`phrase_this ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const rows = await fetchSemrushRows('phrase_related', {
        phrase: seed,
        database,
        display_limit: limitPerReport,
        export_columns: 'Ph,Nq,Cp,Co,Nr',
      });
      rows.forEach((row) => related.push(mapKeywordRow(row, seed)));
    } catch (error) {
      warnings.push(`phrase_related ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const rows = await fetchSemrushRows('phrase_fullsearch', {
        phrase: seed,
        database,
        display_limit: limitPerReport,
        export_columns: 'Ph,Nq,Cp,Co,Nr,Td',
      });
      rows.forEach((row) => broadMatch.push(mapKeywordRow(row, seed)));
    } catch (error) {
      warnings.push(`phrase_fullsearch ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const rows = await fetchSemrushRows('phrase_questions', {
        phrase: seed,
        database,
        display_limit: limitPerReport,
        export_columns: 'Ph,Nq,Cp,Co,Nr',
      });
      rows.forEach((row) => questions.push(mapKeywordRow(row, seed)));
    } catch (error) {
      warnings.push(`phrase_questions ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const rows = await fetchSemrushRows('phrase_kdi', {
        phrase: seed,
        database,
        export_columns: 'Ph,Kd',
      });
      rows.forEach((row) => difficulty.push(mapKeywordRow(row, seed)));
    } catch (error) {
      warnings.push(`phrase_kdi ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  writeJson(path.join(outputDir, 'semrush-keyword-analytics.json'), {
    source: 'semrush-api',
    endpoint: 'keyword-analytics',
    database,
    generatedAt,
    warnings,
    seeds,
    overview,
    related,
    broadMatch,
    questions,
    difficulty,
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    database,
    warnings,
    rows: {
      overview: overview.length,
      related: related.length,
      broadMatch: broadMatch.length,
      questions: questions.length,
      difficulty: difficulty.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
