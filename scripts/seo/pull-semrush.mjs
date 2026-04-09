import fs from 'node:fs';
import path from 'node:path';

import {
  fetchSemrushRows,
  getSeoOutputDir,
  numberValue,
  optionalEnv,
  parseCliArgs,
  readJson,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const target = optionalEnv('SEMRUSH_TARGET', 'aipromptindex.io');
const database = optionalEnv('SEMRUSH_DATABASE', 'us');
const budget = args.budget || 'standard';
const skipCompetitors = args['skip-competitors'] === 'true';
const enrich = args.enrich === 'true';

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  // --- Base pulls (all budget levels) ---

  let domainOverview = {};
  try {
    const rows = await fetchSemrushRows('domain_ranks', {
      domain: target,
      database,
      export_columns: 'Dn,Rk,Or,Ot,Oc,Ad,At,Ac',
    });
    domainOverview = rows[0] || {};
  } catch (error) {
    warnings.push(`domain overview: ${error instanceof Error ? error.message : String(error)}`);
  }

  let organicKeywords = [];
  try {
    const rows = await fetchSemrushRows('domain_organic', {
      domain: target,
      database,
      display_limit: 250,
      export_columns: 'Ph,Po,Pp,Nq,Cp,Ur,Tr,Tc,Co,Nr,Fk,Fp',
    });
    organicKeywords = rows.map((row) => {
      const rawFk = (row['SERP Features by Keyword'] || row.Fk || row['SERP Features by Keyword\r'] || '').replace(/\r/g, '').trim();
      const rawFp = (row['SERP Features by Domain'] || row.Fp || row['SERP Features by Domain\r'] || '').replace(/\r/g, '').trim();
      const serpFeatures = rawFk ? rawFk.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const domainFeatures = rawFp ? rawFp.split(',').map((s) => s.trim()).filter(Boolean) : [];
      return {
        keyword: row.Keyword || '',
        position: numberValue(row.Position),
        previousPosition: numberValue(row['Previous Position']),
        volume: numberValue(row['Search Volume']),
        cpc: numberValue(row.CPC),
        url: row.Url || '',
        traffic: numberValue(row['Traffic (%)']),
        trafficCost: numberValue(row['Traffic Cost (%)']),
        competition: numberValue(row.Competition),
        results: numberValue(row['Number of Results']),
        serpFeatures,
        domainSerpFeatures: domainFeatures,
        hasAiOverview: serpFeatures.includes('52'),
        inAiOverview: domainFeatures.includes('52'),
      };
    });
  } catch (error) {
    warnings.push(`organic keywords: ${error instanceof Error ? error.message : String(error)}`);
  }

  let competitors = [];
  if (!skipCompetitors) {
    try {
      const rows = await fetchSemrushRows('domain_organic_organic', {
        domain: target,
        database,
        display_limit: 25,
        export_columns: 'Dn,Cr,Np,Or,Ot,Oc,Ad',
      });
      competitors = rows.map((row) => ({
        domain: row.Dn || '',
        competitorRelevance: numberValue(row.Cr),
        commonKeywords: numberValue(row.Np),
        organicKeywords: numberValue(row.Or),
        organicTraffic: numberValue(row.Ot),
        organicCost: numberValue(row.Oc),
        adwordsKeywords: numberValue(row.Ad),
      }));
    } catch (error) {
      warnings.push(`competitors: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // --- Rank history (standard+ budget) ---

  let rankHistory = [];
  if (budget === 'standard' || budget === 'full') {
    try {
      const rows = await fetchSemrushRows('domain_rank_history', {
        domain: target,
        database,
        export_columns: 'Rk,Or,Ot,Oc,Ad,At,Dt',
      });
      rankHistory = rows
        .map((row) => {
          const rawDate = (row.Date || row['Date\r'] || '').replace(/\r/g, '').trim();
          const date = rawDate.length === 8
            ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
            : rawDate;
          return {
            rank: numberValue(row.Rank),
            organicKeywords: numberValue(row['Organic Keywords']),
            organicTraffic: numberValue(row['Organic Traffic']),
            organicCost: numberValue(row['Organic Cost']),
            adwordsKeywords: numberValue(row['Adwords Keywords']),
            adwordsTraffic: numberValue(row['Adwords Traffic']),
            date,
          };
        })
        .filter((row) => row.date && (row.rank > 0 || row.organicKeywords > 0));
    } catch (error) {
      warnings.push(`rank history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // --- Enrichment: competitor profiles from Ahrefs discovery (standard+ budget) ---

  let competitorProfiles = [];
  if (enrich && (budget === 'standard' || budget === 'full')) {
    const ahrefsCompetitorsPath = path.join(outputDir, 'ahrefs-competitors.json');
    if (fs.existsSync(ahrefsCompetitorsPath)) {
      const ahrefsCompetitors = readJson(ahrefsCompetitorsPath);
      const domains = (ahrefsCompetitors.rows || [])
        .slice(0, 5)
        .map((row) => row.domain)
        .filter(Boolean);

      for (const domain of domains) {
        try {
          const rows = await fetchSemrushRows('domain_ranks', {
            domain,
            database,
            export_columns: 'Dn,Rk,Or,Ot,Oc,Ad',
          });
          if (rows[0]) {
            competitorProfiles.push({
              domain,
              rank: numberValue(rows[0].Rank),
              organicKeywords: numberValue(rows[0]['Organic Keywords']),
              organicTraffic: numberValue(rows[0]['Organic Traffic']),
              organicCost: numberValue(rows[0]['Organic Cost']),
              adwordsKeywords: numberValue(rows[0]['Adwords Keywords']),
            });
          }
        } catch (error) {
          warnings.push(`competitor profile ${domain}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else {
      warnings.push('enrichment skipped: ahrefs-competitors.json not found (run seo:pull:ahrefs first)');
    }
  }

  // --- Enrichment: keyword details via phrase_fullsearch (standard+ budget) ---

  let keywordDetails = [];
  if (enrich && (budget === 'standard' || budget === 'full')) {
    const ahrefsKeywordsPath = path.join(outputDir, 'ahrefs-keywords.json');
    if (fs.existsSync(ahrefsKeywordsPath)) {
      const ahrefsKeywords = readJson(ahrefsKeywordsPath);
      const topKeywords = (ahrefsKeywords.rows || [])
        .sort((a, b) => numberValue(b.sum_traffic) - numberValue(a.sum_traffic))
        .slice(0, 10)
        .map((row) => row.keyword)
        .filter(Boolean);

      for (const keyword of topKeywords) {
        try {
          const rows = await fetchSemrushRows('phrase_fullsearch', {
            phrase: keyword,
            database,
            export_columns: 'Ph,Nq,Cp,Co,Nr,Td',
          });
          if (rows[0]) {
            keywordDetails.push({
              keyword,
              volume: numberValue(rows[0]['Search Volume']),
              cpc: numberValue(rows[0].CPC),
              competition: numberValue(rows[0].Competition),
              results: numberValue(rows[0]['Number of Results']),
              trend: rows[0].Trends || rows[0].Td || '',
            });
          }
        } catch (error) {
          warnings.push(`keyword detail ${keyword}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else {
      warnings.push('keyword enrichment skipped: ahrefs-keywords.json not found');
    }
  }

  // --- Write output files ---

  writeJson(path.join(outputDir, 'semrush-overview.json'), {
    source: 'semrush-api',
    target,
    database,
    generatedAt,
    warnings,
    domainOverview,
  });
  writeJson(path.join(outputDir, 'semrush-keywords.json'), {
    source: 'semrush-api',
    target,
    database,
    generatedAt,
    rows: organicKeywords,
  });
  writeJson(path.join(outputDir, 'semrush-competitors.json'), {
    source: 'semrush-api',
    target,
    database,
    generatedAt,
    rows: competitors,
    warnings: skipCompetitors ? ['competitors skipped via --skip-competitors'] : warnings,
  });

  if (rankHistory.length > 0) {
    writeJson(path.join(outputDir, 'semrush-rank-history.json'), {
      source: 'semrush-api',
      target,
      database,
      generatedAt,
      rows: rankHistory,
    });
  }

  if (competitorProfiles.length > 0) {
    writeJson(path.join(outputDir, 'semrush-competitor-profiles.json'), {
      source: 'semrush-api',
      target,
      database,
      generatedAt,
      rows: competitorProfiles,
    });
  }

  if (keywordDetails.length > 0) {
    writeJson(path.join(outputDir, 'semrush-keyword-details.json'), {
      source: 'semrush-api',
      target,
      database,
      generatedAt,
      rows: keywordDetails,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    target,
    database,
    budget,
    enrich,
    warnings,
    rows: {
      keywords: organicKeywords.length,
      competitors: competitors.length,
      rankHistory: rankHistory.length,
      competitorProfiles: competitorProfiles.length,
      keywordDetails: keywordDetails.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
