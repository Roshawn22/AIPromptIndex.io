import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_BUDGET,
  SEO_TITLE_MAX,
  renderedSeoTitle,
} from '../../localization/seo-limits.mjs';

const enDir = path.join(process.cwd(), 'src/data/i18n/en');
const read = (name) => JSON.parse(fs.readFileSync(path.join(enDir, name), 'utf8'));

test('the rendered title appends the site name once, and the budget leaves room for it', () => {
  assert.equal(renderedSeoTitle('Prompts'), 'Prompts | AIPromptIndex');
  assert.equal(renderedSeoTitle('AIPromptIndex Library'), 'AIPromptIndex Library');
  assert.equal(renderedSeoTitle('x'.repeat(SEO_TITLE_BUDGET)).length, SEO_TITLE_MAX);
});

// General Translation only respects a length it is told about. If a pilot page is added
// without regenerating the sidecar, its translation arrives over the limits the guard
// enforces — which is how 16 fields had to be cut by hand on 2026-09-26.
for (const source of ['pilot-content', 'data-analysis']) {
  test(`${source}: every page tells the translator its SEO character budget`, () => {
    const pages = read(`${source}.json`).pages;
    const context = read(`${source}.metadata.json`).pages;
    for (const sourcePath of Object.keys(pages)) {
      const entry = context[sourcePath];
      assert.ok(entry, `${sourcePath} has no translator context; run npm run localization:source`);
      assert.match(entry.metaTitle?.context ?? '', new RegExp(`at most ${SEO_TITLE_BUDGET} characters`), `${sourcePath} metaTitle budget`);
      assert.match(entry.metaDescription?.context ?? '', new RegExp(`at most ${SEO_DESCRIPTION_MAX} characters`), `${sourcePath} metaDescription budget`);
    }
  });
}
