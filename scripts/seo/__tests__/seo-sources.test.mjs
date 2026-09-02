import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDataForSeoAuthHeader } from '../_shared.mjs';
import {
  loadResearchCompetitors,
  loadResearchKeywords,
  loadResearchTopPages,
} from '../seo-sources.mjs';

function writeJson(dir, fileName, payload) {
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(payload));
}

test('loadResearchKeywords prefers OpenSEO rows over Ahrefs and GSC', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-sources-'));
  writeJson(dir, 'openseo-keywords.json', {
    source: 'openseo-dataforseo',
    rows: [{ keyword: 'gemini prompts', volume: 120, best_position: 13 }],
  });
  writeJson(dir, 'ahrefs-keywords.json', {
    source: 'ahrefs-api-v3',
    rows: [{ keyword: 'ahrefs only', volume: 999 }],
  });
  writeJson(dir, 'gsc-queries.json', {
    ranges: { last28: { rows: [{ key: 'gsc only', impressions: 50, clicks: 1, position: 40, ctr: 0.02 }] } },
  });

  const result = loadResearchKeywords(dir);
  assert.equal(result.source, 'openseo-dataforseo');
  assert.equal(result.rows[0].keyword, 'gemini prompts');
});

test('loadResearchKeywords falls back to GSC when OpenSEO and Ahrefs are empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-sources-'));
  writeJson(dir, 'gsc-queries.json', {
    ranges: { last28: { rows: [{ key: 'ai prompts for small business', impressions: 347, clicks: 2, position: 36.5, ctr: 0.006 }] } },
  });

  const result = loadResearchKeywords(dir);
  assert.equal(result.source, 'google-search-console');
  assert.equal(result.rows[0].keyword, 'ai prompts for small business');
  assert.equal(result.rows[0].volume, 347);
});

test('loadResearchTopPages and competitors prefer OpenSEO artifacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-sources-'));
  writeJson(dir, 'openseo-top-pages.json', {
    source: 'openseo-dataforseo',
    rows: [{ url: 'https://aipromptindex.io/best/gemini-prompts/', traffic: 12 }],
  });
  writeJson(dir, 'openseo-competitors.json', {
    source: 'openseo-dataforseo',
    rows: [{ domain: 'example.com', traffic: 100 }],
  });

  assert.equal(loadResearchTopPages(dir).rows[0].url, 'https://aipromptindex.io/best/gemini-prompts/');
  assert.equal(loadResearchCompetitors(dir).rows[0].domain, 'example.com');
});

test('getDataForSeoAuthHeader encodes login:password and accepts pre-encoded keys', () => {
  const previous = {
    DATAFORSEO_API_KEY: process.env.DATAFORSEO_API_KEY,
    OPENSEO_DATAFORSEO_API_KEY: process.env.OPENSEO_DATAFORSEO_API_KEY,
    DATAFORSEO_LOGIN: process.env.DATAFORSEO_LOGIN,
    DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD,
  };

  delete process.env.DATAFORSEO_API_KEY;
  delete process.env.OPENSEO_DATAFORSEO_API_KEY;
  process.env.DATAFORSEO_LOGIN = 'user@example.com';
  process.env.DATAFORSEO_PASSWORD = 'secret';

  try {
    const header = getDataForSeoAuthHeader();
    assert.equal(header, `Basic ${Buffer.from('user@example.com:secret', 'utf8').toString('base64')}`);

    process.env.DATAFORSEO_API_KEY = 'alreadyBase64';
    assert.equal(getDataForSeoAuthHeader(), 'Basic alreadyBase64');
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
