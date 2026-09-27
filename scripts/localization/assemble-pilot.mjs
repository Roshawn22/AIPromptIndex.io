import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Turns a General Translation output file back into a pilot-pages.json for one locale:
//   node scripts/localization/assemble-pilot.mjs es-419
//   node scripts/localization/assemble-pilot.mjs de --source data-analysis
// Structure comes from the English side (page type, source slug and path, variable names)
// and every page starts as needs-human-review, so nothing a model wrote can be indexed
// until a person has read it. Source fingerprints use the same hash as the guard.

const repoRoot = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));

const [locale, ...rest] = process.argv.slice(2);
if (!locale) {
  console.error('usage: node scripts/localization/assemble-pilot.mjs <locale> [--source pilot-content|data-analysis]');
  process.exit(1);
}
const sourceName = rest.includes('--source') ? rest[rest.indexOf('--source') + 1] : 'pilot-content';
// Approved pages are a reviewer's work and are kept as they are; pass --force to replace
// them after a re-translation (the guard will then ask for a fresh review anyway).
const force = rest.includes('--force');

const translated = read(`src/data/i18n/${locale}/${sourceName}.json`).pages;
const bestof = read('src/data/seo/bestof-pages.json');
const ptBrPilot = read('src/data/i18n/pt-BR/pilot-pages.json');

function fingerprintFor(page) {
  let value = '';
  if (page.type === 'home') value = fs.readFileSync(path.join(repoRoot, 'src/pages/index.astro'), 'utf8');
  else if (page.type === 'roundup') value = JSON.stringify(bestof.find((roundup) => roundup.slug === page.sourceSlug));
  else if (page.type === 'prompt') value = fs.readFileSync(path.join(repoRoot, 'src/data/prompts', `${page.sourceSlug}.json`), 'utf8');
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

// Page structure: reuse the pt-BR definition for the shared pilot set; derive it for extra pages.
function structureFor(sourcePath) {
  const known = ptBrPilot.pages[sourcePath];
  if (known) return { type: known.type, sourcePath, sourceSlug: known.sourceSlug };
  const roundup = sourcePath.match(/^\/best\/([^/]+)\/$/);
  if (roundup) return { type: 'roundup', sourcePath, sourceSlug: roundup[1] };
  const prompt = sourcePath.match(/^\/prompts\/([^/]+)\/$/);
  if (prompt) return { type: 'prompt', sourcePath, sourceSlug: prompt[1] };
  if (sourcePath === '/') return { type: 'home', sourcePath };
  throw new Error(`cannot infer page type for ${sourcePath}`);
}

const pages = {};
for (const [sourcePath, content] of Object.entries(translated)) {
  const structure = structureFor(sourcePath);
  const page = {
    type: structure.type,
    reviewStatus: 'needs-human-review',
    sourceFingerprint: fingerprintFor(structure),
    sourcePath,
    ...(structure.sourceSlug ? { sourceSlug: structure.sourceSlug } : {}),
    ...content,
  };
  if (structure.type === 'prompt') {
    const source = read(`src/data/prompts/${structure.sourceSlug}.json`);
    if ((content.variables || []).length !== source.variables.length) {
      throw new Error(`${sourcePath}: translated variables (${content.variables?.length}) do not match source (${source.variables.length})`);
    }
    page.variables = source.variables.map((variable, index) => ({ name: variable.name, ...content.variables[index] }));
    for (const variable of source.variables) {
      if (!page.promptText.includes(`[${variable.name}]`)) {
        throw new Error(`${sourcePath}: translated promptText lost the [${variable.name}] placeholder`);
      }
    }
  }
  pages[sourcePath] = page;
}

const outputPath = `src/data/i18n/${locale}/pilot-pages.json`;
const existing = fs.existsSync(path.join(repoRoot, outputPath)) ? read(outputPath) : { pages: {} };
const kept = [];
for (const [sourcePath, page] of Object.entries(existing.pages || {})) {
  if (page.reviewStatus === 'approved' && pages[sourcePath] && !force) {
    pages[sourcePath] = page;
    kept.push(sourcePath);
  }
}
const output = {
  locale,
  sourceLocale: 'en',
  translationProvider: 'general-translation',
  reviewPolicy: 'Every page must be changed to approved by a human reviewer before it can be indexed.',
  pages: { ...existing.pages, ...pages },
};
fs.writeFileSync(path.join(repoRoot, outputPath), JSON.stringify(output, null, 2) + '\n');
const assembledCount = Object.keys(pages).length - kept.length;
console.log(`assembled ${outputPath}: ${assembledCount} page(s) from ${sourceName} as needs-human-review${kept.length ? `; kept ${kept.length} approved page(s) (${kept.join(', ')}); use --force to replace them` : ''}`);

// common.json is raw General Translation output, and the CLI translates every string in it,
// including the two that name the locale itself. Pin those so the UI cannot call es-419 "Inglés".
const LANGUAGE_NAMES = { 'pt-BR': 'Português', 'es-419': 'Español', fr: 'Français', de: 'Deutsch' };
const commonPath = `src/data/i18n/${locale}/common.json`;
if (fs.existsSync(path.join(repoRoot, commonPath))) {
  if (!LANGUAGE_NAMES[locale]) throw new Error(`no language name registered for ${locale}; add it to LANGUAGE_NAMES`);
  const common = read(commonPath);
  common.locale = locale;
  common.languageName = LANGUAGE_NAMES[locale];
  fs.writeFileSync(path.join(repoRoot, commonPath), JSON.stringify(common, null, 2) + '\n');
  console.log(`pinned ${commonPath}: locale=${locale}, languageName=${common.languageName}`);
}
