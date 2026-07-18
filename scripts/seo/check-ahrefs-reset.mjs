import { spawnSync } from 'node:child_process';
import path from 'node:path';

import {
  ensureDir,
  getSeoOutputDir,
  parseCliArgs,
  requireEnv,
  toIsoDate,
  writeJson,
} from './_shared.mjs';

function parseJsonSafely(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonFromCommandOutput(value) {
  const parsed = parseJsonSafely(value);
  if (parsed) return parsed;

  const match = String(value || '').match(/({[\s\S]*})\s*$/);
  return match ? parseJsonSafely(match[1]) : null;
}

function getDirectProbeMetrics(body) {
  const metrics = body?.domain_rating && typeof body.domain_rating === 'object'
    ? body.domain_rating
    : body;

  return {
    domainRating: metrics?.domain_rating,
    ahrefsRank: metrics?.ahrefs_rank,
  };
}

export function resolveProbeDate(requestedDate, now = new Date()) {
  const today = toIsoDate(now);
  if (!requestedDate) return today;
  return requestedDate > today ? today : requestedDate;
}

export function evaluateAhrefsResetCheck({
  directProbe,
  verifySetup,
  pullAhrefs,
} = {}) {
  const directBody = directProbe?.body;
  const directMetrics = getDirectProbeMetrics(directBody);
  const directProbeOk = directProbe?.status === 200 && typeof directMetrics.domainRating === 'number';

  const verifyJson = parseJsonFromCommandOutput(verifySetup?.output || '');
  const blockedEndpoints = Array.isArray(verifyJson?.blockedEndpoints)
    ? verifyJson.blockedEndpoints
    : [];
  const verifySetupOk = verifySetup?.status === 0
    && verifyJson?.workflowGates?.canRunAhrefs === true
    && !blockedEndpoints.includes('ahrefs.api');

  const pullJson = parseJsonFromCommandOutput(pullAhrefs?.output || '');
  const pullAhrefsOk = pullAhrefs?.status === 0 && pullJson?.ok === true;

  return {
    overall: directProbeOk && verifySetupOk && pullAhrefsOk ? 'PASS' : 'FAIL',
    checks: {
      directProbe: {
        ok: directProbeOk,
        detail: directProbeOk
          ? `status=${directProbe.status}, domain_rating=${directMetrics.domainRating}, ahrefs_rank=${directMetrics.ahrefsRank}`
          : `status=${directProbe?.status ?? 'unknown'}, body=${typeof directBody === 'string' ? directBody : JSON.stringify(directBody)}`,
      },
      verifySetup: {
        ok: verifySetupOk,
        detail: verifySetupOk
          ? 'canRunAhrefs=true and ahrefs.api is not blocked'
          : 'Expected canRunAhrefs=true and no ahrefs.api block',
      },
      pullAhrefs: {
        ok: pullAhrefsOk,
        detail: pullAhrefsOk
          ? 'seo:pull:ahrefs returned ok=true'
          : 'seo:pull:ahrefs did not return ok=true',
      },
    },
  };
}

async function runDirectProbe(date) {
  const token = requireEnv('AHREFS_API_TOKEN');
  const probeDate = resolveProbeDate(date);
  const url = new URL('https://api.ahrefs.com/v3/site-explorer/domain-rating');
  url.searchParams.set('target', 'aipromptindex.io');
  url.searchParams.set('mode', 'subdomains');
  url.searchParams.set('date', probeDate);
  url.searchParams.set('output', 'json');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  return {
    status: response.status,
    body: parseJsonSafely(text) || text,
  };
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  return {
    status: result.status ?? 1,
    output: [stdout, stderr].filter(Boolean).join('\n').trim(),
  };
}

function printCheck(label, check) {
  console.log(`\n${label}: ${check.ok ? 'PASS' : 'FAIL'}`);
  console.log(check.detail);
}

async function main() {
  const args = parseCliArgs();
  const date = args.date || toIsoDate(new Date());
  const outputDir = getSeoOutputDir({ date });
  ensureDir(outputDir);

  const directProbe = await runDirectProbe(date);
  const verifySetup = runCommand('npm', ['run', 'seo:verify:setup']);
  const pullAhrefs = runCommand('npm', ['run', 'seo:pull:ahrefs']);

  const result = evaluateAhrefsResetCheck({
    directProbe,
    verifySetup,
    pullAhrefs,
  });

  printCheck('[1/3] Direct Ahrefs probe', result.checks.directProbe);
  printCheck('[2/3] Verify setup', result.checks.verifySetup);
  printCheck('[3/3] Pull Ahrefs', result.checks.pullAhrefs);

  const summary = {
    ranAt: new Date().toISOString(),
    date,
    overall: result.overall,
    checks: result.checks,
  };

  writeJson(path.join(outputDir, 'ahrefs-reset-check.json'), summary);

  console.log('\n=== FINAL SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  process.exitCode = result.overall === 'PASS' ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
