import path from 'node:path';

import {
  fetchAhrefsJson,
  getSeoOutputDir,
  numberValue,
  optionalEnv,
  parseCliArgs,
  toIsoDate,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const target = optionalEnv('AHREFS_TARGET', 'aipromptindex.io');
const mode = optionalEnv('AHREFS_TARGET_MODE', 'subdomains');
const today = toIsoDate(new Date());

async function ahrefs(endpoint, params = {}) {
  return fetchAhrefsJson(`site-explorer/${endpoint}`, {
    target,
    mode,
    date: today,
    output: 'json',
    ...params,
  });
}

function normalizeRows(response) {
  if (Array.isArray(response?.rows)) return response.rows;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.anchors)) return response.anchors;
  return [];
}

async function main() {
  const generatedAt = new Date().toISOString();
  const warnings = [];

  let anchors = [];
  try {
    const response = await ahrefs('anchors', {
      limit: 100,
      select: 'anchor,refdomains,refpages,dofollow_links,top_domain_rating,first_seen,last_seen',
    });
    anchors = normalizeRows(response).map((row) => ({
      anchor: row.anchor || '',
      refdomains: numberValue(row.refdomains),
      refpages: numberValue(row.refpages),
      dofollowLinks: numberValue(row.dofollow_links),
      topDomainRating: numberValue(row.top_domain_rating),
      firstSeen: row.first_seen || '',
      lastSeen: row.last_seen || '',
    }));
  } catch (error) {
    warnings.push(`anchors: ${error instanceof Error ? error.message : String(error)}`);
  }

  let brokenBacklinks = [];
  try {
    const response = await ahrefs('broken-backlinks', {
      limit: 100,
      select: 'url_from,url_to,anchor,domain_rating_source,first_seen,last_seen',
    });
    brokenBacklinks = normalizeRows(response).map((row) => ({
      urlFrom: row.url_from || '',
      urlTo: row.url_to || '',
      anchor: row.anchor || '',
      sourceDomainRating: numberValue(row.domain_rating_source),
      firstSeen: row.first_seen || '',
      lastSeen: row.last_seen || '',
    }));
  } catch (error) {
    warnings.push(`broken-backlinks: ${error instanceof Error ? error.message : String(error)}`);
  }

  let bestByExternalLinks = [];
  try {
    const response = await ahrefs('best-by-external-links', {
      limit: 50,
      select: 'url_to,title_target,url_rating_target,links_to_target,dofollow_to_target',
    });
    bestByExternalLinks = normalizeRows(response).map((row) => ({
      url: row.url_to || row.url_to_plain || '',
      title: row.title_target || '',
      urlRating: numberValue(row.url_rating_target),
      linksToTarget: numberValue(row.links_to_target),
      dofollowToTarget: numberValue(row.dofollow_to_target),
    }));
  } catch (error) {
    warnings.push(`best-by-external-links: ${error instanceof Error ? error.message : String(error)}`);
  }

  let bestByInternalLinks = [];
  try {
    const response = await ahrefs('best-by-internal-links', {
      limit: 50,
      select: 'url_to,title_target,url_rating_target,links_to_target,dofollow_to_target',
    });
    bestByInternalLinks = normalizeRows(response).map((row) => ({
      url: row.url_to || row.url_to_plain || '',
      title: row.title_target || '',
      urlRating: numberValue(row.url_rating_target),
      linksToTarget: numberValue(row.links_to_target),
      dofollowToTarget: numberValue(row.dofollow_to_target),
    }));
  } catch (error) {
    warnings.push(`best-by-internal-links: ${error instanceof Error ? error.message : String(error)}`);
  }

  // linked-domains endpoint unavailable at Standard tier at this path; skip silently.

  writeJson(path.join(outputDir, 'ahrefs-backlinks-deep.json'), {
    source: 'ahrefs-api-v3',
    endpoint: 'site-explorer (deep)',
    target,
    mode,
    generatedAt,
    warnings,
    anchors,
    brokenBacklinks,
    bestByExternalLinks,
    bestByInternalLinks,
  });

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    target,
    warnings,
    rows: {
      anchors: anchors.length,
      brokenBacklinks: brokenBacklinks.length,
      bestByExternalLinks: bestByExternalLinks.length,
      bestByInternalLinks: bestByInternalLinks.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
