import path from 'node:path';

import {
  fetchSemrushAnalyticsRows,
  getSeoOutputDir,
  numberValue,
  optionalEnv,
  parseCliArgs,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const target = optionalEnv('SEMRUSH_TARGET', 'aipromptindex.io');
const targetType = optionalEnv('SEMRUSH_TARGET_TYPE', 'root_domain');
const limit = Number(args.limit || 100);

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  let overview = {};
  try {
    const rows = await fetchSemrushAnalyticsRows('backlinks_overview', {
      target,
      target_type: targetType,
      export_columns: 'ascore,total,domains_num,urls_num,ips_num,ipclassc_num,follows_num,nofollows_num,sponsored_num,ugc_num,texts_num,images_num,forms_num,frames_num',
    });
    overview = rows[0] || {};
  } catch (error) {
    warnings.push(`backlinks_overview: ${error instanceof Error ? error.message : String(error)}`);
  }

  let refDomains = [];
  try {
    const rows = await fetchSemrushAnalyticsRows('backlinks_refdomains', {
      target,
      target_type: targetType,
      display_limit: limit,
      export_columns: 'domain,domain_ascore,backlinks_num,ip,country,first_seen,last_seen',
    });
    refDomains = rows.map((row) => ({
      domain: row.domain || '',
      ascore: numberValue(row.domain_ascore),
      backlinks: numberValue(row.backlinks_num),
      ip: row.ip || '',
      country: row.country || '',
      firstSeen: row.first_seen || '',
      lastSeen: row.last_seen || '',
    }));
  } catch (error) {
    warnings.push(`backlinks_refdomains: ${error instanceof Error ? error.message : String(error)}`);
  }

  let anchors = [];
  try {
    const rows = await fetchSemrushAnalyticsRows('backlinks_anchors', {
      target,
      target_type: targetType,
      display_limit: limit,
      export_columns: 'anchor,domains_num,backlinks_num,first_seen,last_seen',
    });
    anchors = rows.map((row) => ({
      anchor: row.anchor || '',
      refdomains: numberValue(row.domains_num),
      backlinks: numberValue(row.backlinks_num),
      firstSeen: row.first_seen || '',
      lastSeen: row.last_seen || '',
    }));
  } catch (error) {
    warnings.push(`backlinks_anchors: ${error instanceof Error ? error.message : String(error)}`);
  }

  let pages = [];
  try {
    const rows = await fetchSemrushAnalyticsRows('backlinks_pages', {
      target,
      target_type: targetType,
      display_limit: limit,
      export_columns: 'source_url,response_code,backlinks_num,domains_num,last_seen',
    });
    pages = rows.map((row) => ({
      url: row.source_url || '',
      responseCode: numberValue(row.response_code),
      backlinks: numberValue(row.backlinks_num),
      refdomains: numberValue(row.domains_num),
      lastSeen: row.last_seen || '',
    }));
  } catch (error) {
    warnings.push(`backlinks_pages: ${error instanceof Error ? error.message : String(error)}`);
  }

  let competitors = [];
  try {
    const rows = await fetchSemrushAnalyticsRows('backlinks_competitors', {
      target,
      target_type: targetType,
      display_limit: 50,
      export_columns: 'neighbour,similarity,common_refdomains',
    });
    competitors = rows.map((row) => ({
      domain: row.neighbour || '',
      similarity: numberValue(row.similarity),
      commonRefdomains: numberValue(row.common_refdomains),
    }));
  } catch (error) {
    warnings.push(`backlinks_competitors: ${error instanceof Error ? error.message : String(error)}`);
  }

  writeJson(path.join(outputDir, 'semrush-backlinks-deep.json'), {
    source: 'semrush-api',
    endpoint: 'backlinks (deep)',
    target,
    targetType,
    generatedAt,
    warnings,
    overview,
    refDomains,
    anchors,
    pages,
    competitors,
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    target,
    warnings,
    rows: {
      refDomains: refDomains.length,
      anchors: anchors.length,
      pages: pages.length,
      competitors: competitors.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
