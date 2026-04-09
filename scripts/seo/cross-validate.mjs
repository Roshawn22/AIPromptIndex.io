import path from 'node:path';
import fs from 'node:fs';

import {
  getSeoOutputDir,
  normalizeText,
  numberValue,
  readJson,
  writeJson,
} from './_shared.mjs';

const outputDir = getSeoOutputDir();

function main() {
  const generatedAt = new Date().toISOString();

  const semrushPath = path.join(outputDir, 'semrush-keywords.json');
  const ahrefsPath = path.join(outputDir, 'ahrefs-keywords.json');

  if (!fs.existsSync(semrushPath) || !fs.existsSync(ahrefsPath)) {
    console.error('Both semrush-keywords.json and ahrefs-keywords.json are required. Run seo:pull:semrush and seo:pull:ahrefs first.');
    process.exitCode = 1;
    return;
  }

  const semrushData = readJson(semrushPath);
  const ahrefsData = readJson(ahrefsPath);

  const semrushRows = semrushData.rows || [];
  const ahrefsRows = ahrefsData.rows || [];

  const semrushByKeyword = new Map();
  for (const row of semrushRows) {
    const key = normalizeText(row.keyword);
    if (key && !semrushByKeyword.has(key)) {
      semrushByKeyword.set(key, row);
    }
  }

  const ahrefsByKeyword = new Map();
  for (const row of ahrefsRows) {
    const key = normalizeText(row.keyword);
    if (key && !ahrefsByKeyword.has(key)) {
      ahrefsByKeyword.set(key, row);
    }
  }

  const matched = [];
  const semrushOnly = [];
  const ahrefsOnly = [];

  for (const [key, semrush] of semrushByKeyword) {
    const ahrefs = ahrefsByKeyword.get(key);
    if (ahrefs) {
      const semrushPos = numberValue(semrush.position);
      const ahrefsPos = numberValue(ahrefs.best_position);
      const semrushVol = numberValue(semrush.volume);
      const ahrefsVol = numberValue(ahrefs.volume);

      const posDiff = Math.abs(semrushPos - ahrefsPos);
      const volDiff = Math.max(semrushVol, ahrefsVol) > 0
        ? Math.abs(semrushVol - ahrefsVol) / Math.max(semrushVol, ahrefsVol)
        : 0;

      const positionDiscrepancy = posDiff > 10;
      const volumeDiscrepancy = volDiff > 0.5;

      const posConfidence = Math.max(0, 1 - (posDiff / 50));
      const volConfidence = Math.max(0, 1 - volDiff);
      const confidence = (posConfidence + volConfidence) / 2;

      matched.push({
        keyword: semrush.keyword,
        semrushPosition: semrushPos,
        ahrefsPosition: ahrefsPos,
        positionDiff: posDiff,
        positionDiscrepancy,
        semrushVolume: semrushVol,
        ahrefsVolume: ahrefsVol,
        volumeDiffPct: Math.round(volDiff * 100),
        volumeDiscrepancy,
        confidence: Math.round(confidence * 100) / 100,
        semrushUrl: semrush.url || '',
        ahrefsUrl: ahrefs.best_position_url || '',
      });
    } else {
      semrushOnly.push({
        keyword: semrush.keyword,
        position: numberValue(semrush.position),
        volume: numberValue(semrush.volume),
        url: semrush.url || '',
      });
    }
  }

  for (const [key, ahrefs] of ahrefsByKeyword) {
    if (!semrushByKeyword.has(key)) {
      ahrefsOnly.push({
        keyword: ahrefs.keyword,
        best_position: numberValue(ahrefs.best_position),
        volume: numberValue(ahrefs.volume),
        best_position_url: ahrefs.best_position_url || '',
      });
    }
  }

  matched.sort((a, b) => {
    const aFlagged = (a.positionDiscrepancy || a.volumeDiscrepancy) ? 1 : 0;
    const bFlagged = (b.positionDiscrepancy || b.volumeDiscrepancy) ? 1 : 0;
    if (bFlagged !== aFlagged) return bFlagged - aFlagged;
    return b.positionDiff - a.positionDiff;
  });

  const output = {
    source: 'cross-validation',
    generatedAt,
    summary: {
      totalSemrush: semrushRows.length,
      totalAhrefs: ahrefsRows.length,
      matched: matched.length,
      semrushOnly: semrushOnly.length,
      ahrefsOnly: ahrefsOnly.length,
      highDiscrepancy: matched.filter((m) => m.positionDiscrepancy || m.volumeDiscrepancy).length,
      averageConfidence: matched.length > 0
        ? Math.round((matched.reduce((sum, m) => sum + m.confidence, 0) / matched.length) * 100) / 100
        : 0,
    },
    matched,
    semrushOnly,
    ahrefsOnly,
  };

  writeJson(path.join(outputDir, 'cross-validation.json'), output);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    ...output.summary,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
