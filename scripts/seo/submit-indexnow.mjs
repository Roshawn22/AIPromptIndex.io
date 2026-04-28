import path from 'node:path';

import {
  defaultHost,
  defaultSiteUrl,
  getSeoOutputDir,
  optionalEnv,
  parseCliArgs,
  readOptionalJson,
  writeJson,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const siteUrl = (args.site || process.env.PUBLIC_SITE_URL || defaultSiteUrl).replace(/\/$/, '');
const host = new URL(siteUrl).host || defaultHost;
const key = args.key || optionalEnv('INDEXNOW_KEY') || optionalEnv('BING_INDEXNOW_KEY');
const keyLocation = args.keyLocation || optionalEnv('INDEXNOW_KEY_LOCATION', key ? `${siteUrl}/${key}.txt` : '');
const dryRun = args['dry-run'] === 'true' || args.dryRun === 'true';
const endpoint = args.endpoint || 'https://api.indexnow.org/indexnow';

function splitUrls(value = '') {
  return String(value)
    .split(/[,\n]/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function uniqueUrls(urls) {
  return [...new Set(urls)].filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && parsed.host === host;
    } catch {
      return false;
    }
  });
}

function loadIndexNowUrlsFromAhrefs() {
  const artifactPath = args.input
    ? path.resolve(args.input)
    : path.join(outputDir, 'ahrefs-site-audit.json');
  const artifact = readOptionalJson(artifactPath, null);
  const details = artifact?.issueDetails || [];
  const issue = details.find((item) => item.name === 'Pages to submit to IndexNow');
  return {
    artifactPath,
    urls: (issue?.pages || []).map((page) => page.url).filter(Boolean),
  };
}

async function submitIndexNow(urls) {
  const body = {
    host,
    key,
    keyLocation,
    urlList: urls,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    ok: response.ok,
    text: await response.text(),
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const source = args.urls ? { artifactPath: null, urls: splitUrls(args.urls) } : loadIndexNowUrlsFromAhrefs();
  const urls = uniqueUrls(source.urls);

  const report = {
    generatedAt,
    endpoint,
    siteUrl,
    host,
    sourceArtifact: source.artifactPath,
    dryRun,
    urlCount: urls.length,
    urls,
    status: 'pending',
    response: null,
    warnings: [],
  };

  if (urls.length === 0) {
    report.status = 'skipped';
    report.warnings.push('No same-host HTTPS URLs found for IndexNow submission.');
  } else if (dryRun) {
    report.status = 'dry-run';
  } else if (!key || !keyLocation) {
    report.status = 'misconfigured';
    report.warnings.push('Set INDEXNOW_KEY and make the matching key file reachable, or pass --key and --keyLocation.');
  } else {
    report.response = await submitIndexNow(urls);
    report.status = report.response.ok ? 'submitted' : 'failed';
  }

  const outputPath = path.join(outputDir, 'indexnow-submission.json');
  writeJson(outputPath, report);

  console.log(JSON.stringify({
    ok: report.status === 'submitted' || report.status === 'dry-run',
    status: report.status,
    outputPath,
    urlCount: report.urlCount,
    warnings: report.warnings,
    response: report.response,
  }, null, 2));

  if (report.status === 'failed' || report.status === 'misconfigured') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
