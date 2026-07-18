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

// Semrush Topic Research Tool is UI-only for clustering, but the underlying signal — question
// keywords + related keywords grouped by seed topic — is available via standard Keyword Analytics
// endpoints. This script treats each seed as a "topic" and produces clustered output.

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const database = optionalEnv('SEMRUSH_DATABASE', 'us');
const maxSeeds = Number(args['max-seeds'] || 20);
const limitPerSeed = Number(args.limit || 30);

function mapKeywordRow(row, topic) {
  return {
    keyword: row.Keyword || row.Ph || '',
    volume: numberValue(row['Search Volume'] || row.Nq),
    cpc: numberValue(row.CPC || row.Cp),
    competition: numberValue(row.Competition || row.Co),
    results: numberValue(row['Number of Results'] || row.Nr),
    topic,
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];
  const seeds = loadSeedKeywords().slice(0, maxSeeds);

  const topics = [];
  for (const topic of seeds) {
    const entry = { topic, questions: [], related: [], warnings: [] };

    try {
      const rows = await fetchSemrushRows('phrase_questions', {
        phrase: topic,
        database,
        display_limit: limitPerSeed,
        export_columns: 'Ph,Nq,Cp,Co,Nr',
      });
      entry.questions = rows.map((row) => mapKeywordRow(row, topic));
    } catch (error) {
      entry.warnings.push(`questions: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const rows = await fetchSemrushRows('phrase_related', {
        phrase: topic,
        database,
        display_limit: limitPerSeed,
        export_columns: 'Ph,Nq,Cp,Co,Nr',
      });
      entry.related = rows.map((row) => mapKeywordRow(row, topic));
    } catch (error) {
      entry.warnings.push(`related: ${error instanceof Error ? error.message : String(error)}`);
    }

    entry.totalVolume = [...entry.questions, ...entry.related]
      .reduce((sum, row) => sum + (row.volume || 0), 0);
    entry.avgCpc = entry.related.length > 0
      ? entry.related.reduce((sum, row) => sum + (row.cpc || 0), 0) / entry.related.length
      : 0;

    topics.push(entry);
    warnings.push(...entry.warnings);
  }

  // Top 10 topics by total volume
  const ranked = [...topics].sort((a, b) => b.totalVolume - a.totalVolume);

  writeJson(path.join(outputDir, 'semrush-topic-research.json'), {
    source: 'semrush-api',
    endpoint: 'topic-research (via phrase_questions + phrase_related)',
    database,
    generatedAt,
    warnings,
    topics,
    ranked: ranked.slice(0, 10).map((t) => ({
      topic: t.topic,
      totalVolume: t.totalVolume,
      avgCpc: t.avgCpc,
      questionsCount: t.questions.length,
      relatedCount: t.related.length,
    })),
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    warnings,
    topicsCount: topics.length,
    topTopics: ranked.slice(0, 5).map((t) => `${t.topic} (${t.totalVolume})`),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
