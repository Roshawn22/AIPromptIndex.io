import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { classifyClerkLoadFailure } from '../../../src/lib/sentryEvents.ts';

const errorEvent = (value) => ({
  level: 'error',
  exception: { values: [{ type: 'Error', value }] },
});

describe('classifyClerkLoadFailure', () => {
  it('downgrades a blocked Clerk script so it does not page as high priority', () => {
    const event = classifyClerkLoadFailure(
      errorEvent('Clerk: Failed to load Clerk, failed to load script: https://example.test/clerk.js\n\n(code="failed_to_load_clerk_js")'),
    );

    assert.equal(event.level, 'warning');
  });

  it('groups every Clerk load failure into one issue regardless of build', () => {
    const first = classifyClerkLoadFailure(errorEvent('(code="failed_to_load_clerk_js")'));
    const second = classifyClerkLoadFailure(errorEvent('other text (code="failed_to_load_clerk_js_timeout")'));

    assert.deepEqual(first.fingerprint, ['clerk-js-load-failed']);
    assert.deepEqual(second.fingerprint, first.fingerprint);
  });

  it('matches when the failure sits anywhere in the exception chain', () => {
    const event = classifyClerkLoadFailure({
      level: 'error',
      exception: {
        values: [
          { type: 'Error', value: 'failed to load script: https://example.test/clerk.js' },
          { type: 'ClerkRuntimeError', value: '(code="failed_to_load_clerk_js")' },
        ],
      },
    });

    assert.equal(event.level, 'warning');
  });

  it('leaves other errors at their original level and grouping', () => {
    const event = classifyClerkLoadFailure(errorEvent('Cannot read properties of undefined'));

    assert.equal(event.level, 'error');
    assert.equal(event.fingerprint, undefined);
  });

  it('leaves events without an exception alone', () => {
    const event = { level: 'info', message: 'plain message' };

    assert.deepEqual(classifyClerkLoadFailure(event), { level: 'info', message: 'plain message' });
  });
});
