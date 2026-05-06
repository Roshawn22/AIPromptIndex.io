import test from 'node:test';
import assert from 'node:assert/strict';

import {
  summarizeAhrefsUsage,
} from '../_shared.mjs';

test('summarizeAhrefsUsage derives Standard plan remaining units, percentages, and row cap', () => {
  const result = summarizeAhrefsUsage({
    subscription: 'Standard, billed monthly',
    unitsLimit: 400000,
    unitsUsed: 152654,
  });

  assert.equal(result.unitsRemaining, 247346);
  assert.equal(result.unitsUsedPercent, 38.16);
  assert.equal(result.unitsRemainingPercent, 61.84);
  assert.equal(result.rowLimitPerRequest, 250);
  assert.match(result.sharedPoolNote, /API v3, Ahrefs MCP, and Ahrefs Connect/);
});

test('summarizeAhrefsUsage handles missing usage values without inventing numbers', () => {
  const result = summarizeAhrefsUsage({
    subscription: 'Unknown',
    unitsLimit: null,
    unitsUsed: null,
  });

  assert.equal(result.unitsRemaining, null);
  assert.equal(result.unitsUsedPercent, null);
  assert.equal(result.unitsRemainingPercent, null);
  assert.equal(result.rowLimitPerRequest, null);
});
