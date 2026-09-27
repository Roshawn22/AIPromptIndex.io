import assert from 'node:assert/strict';
import test from 'node:test';

import { localizePath, normalizeLocalizedPath, splitLocalizedPath } from '../../../src/lib/locale-paths.ts';

// The locale list mirrors the folders under src/data/i18n. The short codes matter: "de"
// must only match the /de/ prefix, never English paths that happen to start with those letters.
const LOCALES = ['de', 'es-419', 'fr', 'pt-BR'];

test('normalizeLocalizedPath adds the trailing slash and drops query strings', () => {
  assert.equal(normalizeLocalizedPath('/best/gemini-prompts'), '/best/gemini-prompts/');
  assert.equal(normalizeLocalizedPath('/best/gemini-prompts/?utm=1#top'), '/best/gemini-prompts/');
  assert.equal(normalizeLocalizedPath('prompts/x'), '/prompts/x/');
  assert.equal(normalizeLocalizedPath(''), '/');
  assert.equal(normalizeLocalizedPath('/'), '/');
});

test('splitLocalizedPath recognises a locale prefix and only a whole prefix', () => {
  assert.deepEqual(splitLocalizedPath('/pt-BR/best/gemini-prompts/', LOCALES), { locale: 'pt-BR', path: '/best/gemini-prompts/' });
  assert.deepEqual(splitLocalizedPath('/es-419/', LOCALES), { locale: 'es-419', path: '/' });
  assert.deepEqual(splitLocalizedPath('/de/best/data-analysis-prompts', LOCALES), { locale: 'de', path: '/best/data-analysis-prompts/' });
  assert.deepEqual(splitLocalizedPath('/design/', LOCALES), { locale: null, path: '/design/' });
  assert.deepEqual(splitLocalizedPath('/free-ai-prompts/', LOCALES), { locale: null, path: '/free-ai-prompts/' });
  assert.deepEqual(splitLocalizedPath('/', LOCALES), { locale: null, path: '/' });
});

test('localizePath moves a path between locales and back to English', () => {
  assert.equal(localizePath('/best/gemini-prompts/', 'fr', LOCALES), '/fr/best/gemini-prompts/');
  assert.equal(localizePath('/pt-BR/best/gemini-prompts/', 'fr', LOCALES), '/fr/best/gemini-prompts/');
  assert.equal(localizePath('/pt-BR/best/gemini-prompts/', null, LOCALES), '/best/gemini-prompts/');
  assert.equal(localizePath('/', 'de', LOCALES), '/de/');
  assert.equal(localizePath('/de/', null, LOCALES), '/');
});
