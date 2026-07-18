import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateAhrefsResetCheck,
  resolveProbeDate,
} from '../check-ahrefs-reset.mjs';

test('evaluateAhrefsResetCheck passes only when all three checks pass', () => {
  const result = evaluateAhrefsResetCheck({
    directProbe: {
      status: 200,
      body: { domain_rating: { domain_rating: 42, ahrefs_rank: 123456 } },
    },
    verifySetup: {
      status: 0,
      output: `\n> aipromptindex@0.0.1 seo:verify:setup\n> node scripts/seo/verify-setup.mjs\n\n${JSON.stringify({
          workflowGates: { canRunAhrefs: true },
          blockedEndpoints: [],
        })}`,
    },
    pullAhrefs: {
      status: 0,
      output: `\n> aipromptindex@0.0.1 seo:pull:ahrefs\n> node scripts/seo/pull-ahrefs.mjs\n\n${JSON.stringify({ ok: true })}`,
    },
  });

  assert.equal(result.overall, 'PASS');
  assert.equal(result.checks.directProbe.ok, true);
  assert.equal(result.checks.verifySetup.ok, true);
  assert.equal(result.checks.pullAhrefs.ok, true);
});

test('evaluateAhrefsResetCheck fails when Ahrefs remains blocked in setup verification', () => {
  const result = evaluateAhrefsResetCheck({
    directProbe: {
      status: 200,
      body: { domain_rating: 42, ahrefs_rank: 123456 },
    },
    verifySetup: {
      status: 0,
      output: JSON.stringify({
        workflowGates: { canRunAhrefs: false },
        blockedEndpoints: ['ahrefs.api'],
      }),
    },
    pullAhrefs: {
      status: 0,
      output: JSON.stringify({ ok: true }),
    },
  });

  assert.equal(result.overall, 'FAIL');
  assert.equal(result.checks.directProbe.ok, true);
  assert.equal(result.checks.verifySetup.ok, false);
  assert.equal(result.checks.pullAhrefs.ok, true);
});

test('resolveProbeDate clamps future dates to the current UTC date', () => {
  const result = resolveProbeDate('2026-05-03', new Date('2026-04-19T18:50:30.369Z'));
  assert.equal(result, '2026-04-19');
});
