import path from 'node:path';

import {
  fetchAhrefsPost,
  getSeoOutputDir,
  loadCompetitorDomains,
  numberValue,
  optionalEnv,
  parseCliArgs,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const ownDomain = optionalEnv('AHREFS_TARGET', 'aipromptindex.io');

function buildTargets(domains) {
  return domains.map((domain) => ({
    url: domain,
    protocol: 'both',
    mode: 'subdomains',
  }));
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];
  const competitorDomains = loadCompetitorDomains();
  const domains = [ownDomain, ...competitorDomains].slice(0, 100);

  if (domains.length === 0) {
    throw new Error('No domains to analyze. Populate scripts/config/competitor-domains.json.');
  }

  let rows = [];
  try {
    const response = await fetchAhrefsPost('batch-analysis/batch-analysis', {
      targets: buildTargets(domains),
      select: [
        'url',
        'domain_rating',
        'url_rating',
        'ahrefs_rank',
        'backlinks',
        'refdomains',
        'linked_domains',
        'org_traffic',
        'org_keywords',
        'org_cost',
        'paid_traffic',
        'paid_keywords',
      ],
    });
    const list = Array.isArray(response?.targets) ? response.targets
      : Array.isArray(response?.rows) ? response.rows
      : Array.isArray(response?.data) ? response.data : [];
    rows = list.map((row) => ({
      url: row.url || row.target || '',
      domainRating: numberValue(row.domain_rating),
      urlRating: numberValue(row.url_rating),
      ahrefsRank: numberValue(row.ahrefs_rank),
      backlinks: numberValue(row.backlinks),
      refdomains: numberValue(row.refdomains),
      linkedDomains: numberValue(row.linked_domains),
      organicTraffic: numberValue(row.org_traffic),
      organicKeywords: numberValue(row.org_keywords),
      organicCost: numberValue(row.org_cost),
      paidTraffic: numberValue(row.paid_traffic),
      paidKeywords: numberValue(row.paid_keywords),
    }));
  } catch (error) {
    warnings.push(`batch-analysis: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Rank competitors by organic traffic for quick cohort view
  const ranked = [...rows].sort((a, b) => b.organicTraffic - a.organicTraffic);
  const ownEntry = ranked.find((row) => row.url.replace(/^https?:\/\//, '').replace(/^www\./, '').startsWith(ownDomain));

  writeJson(path.join(outputDir, 'ahrefs-batch-analysis.json'), {
    source: 'ahrefs-api-v3',
    endpoint: 'batch-analysis',
    ownDomain,
    generatedAt,
    warnings,
    domainCount: domains.length,
    ranked,
    ownEntry,
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    warnings,
    rows: { domains: rows.length },
    ownDomainRating: ownEntry?.domainRating ?? null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
