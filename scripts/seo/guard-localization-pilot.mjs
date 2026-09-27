import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { repoRoot } from './_shared.mjs';
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, renderedSeoTitle } from '../localization/seo-limits.mjs';

// Checks every localized locale under src/data/i18n (a folder with pilot-pages.json).
// Structural problems always fail the run. Quality limits (title and description length,
// a stale source fingerprint) fail only on approved pages: nothing unapproved can be
// indexed, and the reviewer fixes those before approving. When a build exists, the HTML
// of every enabled locale is checked for lang, noindex and hreflang as well.

const i18nDir = path.join(repoRoot, 'src/data/i18n');
const distPath = path.join(repoRoot, 'dist');
const bestofPages = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src/data/seo/bestof-pages.json'), 'utf8'));
const locales = fs.readdirSync(i18nDir)
  .filter((name) => name !== 'en' && fs.existsSync(path.join(i18nDir, name, 'pilot-pages.json')))
  .sort();

const enabled = process.env.PUBLIC_LOCALIZATION_PILOT_ENABLED === 'true';
const requestedIndexing = process.env.PUBLIC_LOCALIZATION_PILOT_INDEXABLE === 'true';
const reviewLocales = (process.env.PUBLIC_LOCALIZATION_REVIEW_LOCALES || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
const isReviewLocale = (locale) => reviewLocales.includes('*') || reviewLocales.includes(locale);
const allowedStatuses = new Set(['needs-human-review', 'approved']);

function expectedFingerprint(page) {
  let sourceValue = '';
  if (page.type === 'home') {
    sourceValue = fs.readFileSync(path.join(repoRoot, 'src/pages/index.astro'), 'utf8');
  } else if (page.type === 'roundup') {
    sourceValue = JSON.stringify(bestofPages.find((roundup) => roundup.slug === page.sourceSlug));
  } else if (page.type === 'prompt') {
    const sourcePromptPath = path.join(repoRoot, 'src/data/prompts', `${page.sourceSlug}.json`);
    if (fs.existsSync(sourcePromptPath)) sourceValue = fs.readFileSync(sourcePromptPath, 'utf8');
  }
  return crypto.createHash('sha256').update(sourceValue).digest('hex').slice(0, 12);
}

const errors = [];
const warnings = [];
const summary = [];

if (locales.length === 0) errors.push('No localized locale found under src/data/i18n.');

for (const locale of locales) {
  const pilot = JSON.parse(fs.readFileSync(path.join(i18nDir, locale, 'pilot-pages.json'), 'utf8'));
  const commonPath = path.join(i18nDir, locale, 'common.json');
  if (!fs.existsSync(commonPath)) {
    errors.push(`${locale}: common.json is missing.`);
    continue;
  }
  const common = JSON.parse(fs.readFileSync(commonPath, 'utf8'));
  const entries = Object.entries(pilot.pages || {});

  if (pilot.locale !== locale || common.locale !== locale) {
    errors.push(`${locale}: both localization files must declare locale ${locale}.`);
  }
  if (entries.length < 1 || entries.length > 10) {
    errors.push(`${locale}: a pilot must contain 1-10 pages; found ${entries.length}.`);
  }

  for (const [sourcePath, page] of entries) {
    const label = `${locale} ${sourcePath}`;
    const approvedPage = page.reviewStatus === 'approved';
    const quality = (message) => (approvedPage ? errors : warnings).push(`${label}: ${message}`);

    if (page.sourcePath !== sourcePath) errors.push(`${label}: sourcePath does not match its dictionary key.`);
    if (!allowedStatuses.has(page.reviewStatus)) errors.push(`${label}: unsupported reviewStatus ${page.reviewStatus}.`);
    if (!page.title || !page.description) errors.push(`${label}: title and description are required.`);

    const seoTitle = page.metaTitle || page.title || '';
    const seoDescription = page.metaDescription || page.description || '';
    const fullSeoTitle = renderedSeoTitle(seoTitle);
    if (fullSeoTitle.length > SEO_TITLE_MAX) {
      quality(`localized rendered SEO title is ${fullSeoTitle.length} characters; maximum is ${SEO_TITLE_MAX}.`);
    }
    if (seoDescription.length > SEO_DESCRIPTION_MAX) {
      quality(`localized meta description is ${seoDescription.length} characters; maximum is ${SEO_DESCRIPTION_MAX}.`);
    }
    if (page.sourceFingerprint !== expectedFingerprint(page)) {
      quality('sourceFingerprint is stale; reset reviewStatus and refresh the translation.');
    }

    if (page.type === 'prompt') {
      const sourcePromptPath = path.join(repoRoot, 'src/data/prompts', `${page.sourceSlug}.json`);
      if (!fs.existsSync(sourcePromptPath)) {
        errors.push(`${label}: source prompt ${page.sourceSlug} does not exist.`);
        continue;
      }
      const sourcePrompt = JSON.parse(fs.readFileSync(sourcePromptPath, 'utf8'));
      const sourceVariables = (sourcePrompt.variables || []).map((variable) => variable.name).sort();
      const translatedVariables = (page.variables || []).map((variable) => variable.name).sort();
      if (JSON.stringify(sourceVariables) !== JSON.stringify(translatedVariables)) {
        errors.push(`${label}: translated variable names must exactly match the source prompt.`);
      }
      for (const variable of sourceVariables) {
        if (!page.promptText.includes(`[${variable}]`)) {
          errors.push(`${label}: translated promptText is missing [${variable}].`);
        }
      }
    } else if (page.type === 'roundup') {
      if (!bestofPages.some((roundup) => roundup.slug === page.sourceSlug)) {
        errors.push(`${label}: source collection ${page.sourceSlug} does not exist.`);
      }
    }
  }

  const approved = entries.length > 0 && entries.every(([, page]) => page.reviewStatus === 'approved');
  const localeEnabled = enabled && (approved || isReviewLocale(locale));
  const indexable = localeEnabled && requestedIndexing && approved;
  const buildChecked = localeEnabled && fs.existsSync(distPath);

  if (buildChecked) {
    for (const [sourcePath] of entries) {
      const localizedRelativePath = sourcePath === '/'
        ? `${locale}/index.html`
        : `${locale}${sourcePath}index.html`;
      const htmlPath = path.join(distPath, localizedRelativePath);
      if (!fs.existsSync(htmlPath)) {
        errors.push(`${locale} ${sourcePath}: localized build output is missing.`);
        continue;
      }
      const html = fs.readFileSync(htmlPath, 'utf8');
      if (!html.includes(`<html lang="${locale}"`)) {
        errors.push(`${locale} ${sourcePath}: localized output is missing lang=${locale}.`);
      }
      if (indexable) {
        if (!html.includes('<link rel="alternate" hreflang="en"') || !html.includes(`<link rel="alternate" hreflang="${locale}"`)) {
          errors.push(`${locale} ${sourcePath}: approved output is missing reciprocal hreflang.`);
        }
        if (html.includes('content="noindex')) {
          errors.push(`${locale} ${sourcePath}: approved output is unexpectedly noindex.`);
        }
      } else {
        if (!html.includes('content="noindex, nofollow"')) {
          errors.push(`${locale} ${sourcePath}: unapproved output must remain noindex.`);
        }
        if (html.includes(`<link rel="alternate" hreflang="${locale}"`)) {
          errors.push(`${locale} ${sourcePath}: unapproved output must not advertise ${locale} hreflang.`);
        }
      }
    }
  } else if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, locale))) {
    errors.push(`${locale}: build output exists although the locale is not enabled.`);
  }

  summary.push({
    locale,
    pages: entries.length,
    reviewStatus: approved ? 'approved' : 'needs-human-review',
    enabled: localeEnabled,
    buildChecked,
    indexable,
  });
}

if (warnings.length > 0) {
  console.warn(warnings.map((warning) => `! ${warning}`).join('\n'));
}
if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, locales: summary, warnings: warnings.length }, null, 2));
}
