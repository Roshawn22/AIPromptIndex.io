import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  classifyAhrefsError,
  summarizeSeoWorkflowGates,
} from '../_shared.mjs';

test('classifyAhrefsError marks exhausted units as blocked', () => {
  const result = classifyAhrefsError('{"error":"API units limit reached. Expected usage: 50, API units left: 0."}');

  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedReason, 'ahrefs_api_units_exhausted');
});

test('summarizeSeoWorkflowGates keeps Ahrefs core enabled when only Site Audit is blocked', () => {
  const summary = summarizeSeoWorkflowGates({
    ahrefsApi: { status: 'ok' },
    ahrefsSiteAudit: { status: 'blocked', blockedReason: 'ahrefs_api_units_exhausted' },
    ahrefsRankTracker: { status: 'ok' },
    semrushAnalytics: { status: 'ok', unitsRemaining: 1200 },
    semrushProjects: { status: 'ok' },
    semrushPositionTracking: { status: 'blocked', blockedReason: 'semrush_api_units_zero' },
  });

  assert.deepEqual(summary.blockedEndpoints, ['ahrefs.siteAudit', 'semrush.positionTracking']);
  assert.equal(summary.sources.ahrefsApi, 'ok');
  assert.equal(summary.sources.ahrefsSiteAudit, 'blocked');
  assert.equal(summary.workflowGates.canRunAhrefs, true);
  assert.equal(summary.workflowGates.canRunAhrefsSiteAudit, false);
  assert.equal(summary.workflowGates.canRunAhrefsRankTracker, true);
  assert.equal(summary.workflowGates.canRunSemrushAnalytics, true);
});

test('summarizeSeoWorkflowGates keeps Ahrefs enabled when optional probes are skipped', () => {
  const summary = summarizeSeoWorkflowGates({
    ahrefsApi: { status: 'ok' },
    ahrefsSiteAudit: { status: 'skipped' },
    ahrefsRankTracker: { status: 'skipped' },
    semrushAnalytics: { status: 'ok', unitsRemaining: 500 },
    semrushProjects: { status: 'unknown' },
    semrushPositionTracking: { status: 'skipped' },
  });

  assert.deepEqual(summary.blockedEndpoints, []);
  assert.equal(summary.workflowGates.canRunAhrefs, true);
  assert.equal(summary.workflowGates.canRunAhrefsSiteAudit, false);
  assert.equal(summary.workflowGates.canRunAhrefsRankTracker, false);
  assert.equal(summary.workflowGates.canRunSemrushProjects, true);
});

const scheduledWorkflows = [
  {
    name: 'daily',
    path: '../../../.github/workflows/seo-data-pull.yml',
    daylightCron: '0 14 * * *',
    standardCron: '0 15 * * *',
  },
  {
    name: 'weekly',
    path: '../../../.github/workflows/seo-weekly.yml',
    daylightCron: '0 14 * * 1',
    standardCron: '0 15 * * 1',
  },
  {
    name: 'monthly',
    path: '../../../.github/workflows/seo-monthly.yml',
    daylightCron: '0 14 1 * *',
    standardCron: '0 15 1 * *',
  },
];

for (const workflow of scheduledWorkflows) {
  test(`${workflow.name} workflow selects the Pacific cron by schedule identity`, () => {
    const source = fs.readFileSync(new URL(workflow.path, import.meta.url), 'utf8');

    assert.match(source, /TRIGGERING_SCHEDULE: \$\{\{ github\.event\.schedule \}\}/);
    assert.ok(source.includes(`-0700:${workflow.daylightCron}`));
    assert.ok(source.includes(`-0800:${workflow.standardCron}`));
    assert.doesNotMatch(source, /local_hour|date \+%H/);
  });
}
