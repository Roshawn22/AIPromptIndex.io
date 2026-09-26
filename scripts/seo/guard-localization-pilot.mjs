import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { repoRoot } from './_shared.mjs';

const pilotPath = path.join(repoRoot, 'src/data/i18n/pt-BR/pilot-pages.json');
const commonPath = path.join(repoRoot, 'src/data/i18n/pt-BR/common.json');
const distPath = path.join(repoRoot, 'dist');
const pilot = JSON.parse(fs.readFileSync(pilotPath, 'utf8'));
const common = JSON.parse(fs.readFileSync(commonPath, 'utf8'));
const bestofPages = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src/data/seo/bestof-pages.json'), 'utf8'));
const entries = Object.entries(pilot.pages || {});
const errors = [];

if (pilot.locale !== 'pt-BR' || common.locale !== 'pt-BR') {
  errors.push('Both localization files must declare locale pt-BR.');
}
if (entries.length < 5 || entries.length > 10) {
  errors.push(`Pilot must contain 5-10 pages; found ${entries.length}.`);
}

const allowedStatuses = new Set(['needs-human-review', 'approved']);
for (const [sourcePath, page] of entries) {
  if (page.sourcePath !== sourcePath) {
    errors.push(`${sourcePath}: sourcePath does not match its dictionary key.`);
  }
  if (!allowedStatuses.has(page.reviewStatus)) {
    errors.push(`${sourcePath}: unsupported reviewStatus ${page.reviewStatus}.`);
  }
  if (!page.title || !page.description) {
    errors.push(`${sourcePath}: title and description are required.`);
  }
  const seoTitle = page.metaTitle || page.title;
  const seoDescription = page.metaDescription || page.description;
  const fullSeoTitle = seoTitle.includes('AIPromptIndex') ? seoTitle : `${seoTitle} | AIPromptIndex`;
  if (fullSeoTitle.length > 60) {
    errors.push(`${sourcePath}: localized rendered SEO title is ${fullSeoTitle.length} characters; maximum is 60.`);
  }
  if (seoDescription.length > 155) {
    errors.push(`${sourcePath}: localized meta description is ${seoDescription.length} characters; maximum is 155.`);
  }

  let sourceValue = '';
  if (page.type === 'home') {
    sourceValue = fs.readFileSync(path.join(repoRoot, 'src/pages/index.astro'), 'utf8');
  } else if (page.type === 'roundup') {
    sourceValue = JSON.stringify(bestofPages.find((roundup) => roundup.slug === page.sourceSlug));
  } else if (page.type === 'prompt') {
    const sourcePromptPath = path.join(repoRoot, 'src/data/prompts', `${page.sourceSlug}.json`);
    if (fs.existsSync(sourcePromptPath)) sourceValue = fs.readFileSync(sourcePromptPath, 'utf8');
  }
  const expectedFingerprint = crypto.createHash('sha256').update(sourceValue).digest('hex').slice(0, 12);
  if (page.sourceFingerprint !== expectedFingerprint) {
    errors.push(`${sourcePath}: sourceFingerprint is stale; reset reviewStatus and refresh the translation.`);
  }

  if (page.type === 'prompt') {
    const sourcePromptPath = path.join(repoRoot, 'src/data/prompts', `${page.sourceSlug}.json`);
    if (!fs.existsSync(sourcePromptPath)) {
      errors.push(`${sourcePath}: source prompt ${page.sourceSlug} does not exist.`);
      continue;
    }
    const sourcePrompt = JSON.parse(fs.readFileSync(sourcePromptPath, 'utf8'));
    const sourceVariables = (sourcePrompt.variables || []).map((variable) => variable.name).sort();
    const translatedVariables = (page.variables || []).map((variable) => variable.name).sort();
    if (JSON.stringify(sourceVariables) !== JSON.stringify(translatedVariables)) {
      errors.push(`${sourcePath}: translated variable names must exactly match the source prompt.`);
    }
    for (const variable of sourceVariables) {
      if (!page.promptText.includes(`[${variable}]`)) {
        errors.push(`${sourcePath}: translated promptText is missing [${variable}].`);
      }
    }
  }
}

const approved = entries.length > 0 && entries.every(([, page]) => page.reviewStatus === 'approved');
const enabled = process.env.PUBLIC_LOCALIZATION_PILOT_ENABLED === 'true';
const requestedIndexing = process.env.PUBLIC_LOCALIZATION_PILOT_INDEXABLE === 'true';
const indexable = enabled && requestedIndexing && approved;

if (enabled && fs.existsSync(distPath)) {
  for (const [sourcePath] of entries) {
    const localizedRelativePath = sourcePath === '/'
      ? 'pt-BR/index.html'
      : `pt-BR${sourcePath}index.html`.replace(/^\//, '');
    const htmlPath = path.join(distPath, localizedRelativePath);
    if (!fs.existsSync(htmlPath)) {
      errors.push(`${sourcePath}: localized build output is missing.`);
      continue;
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!html.includes('<html lang="pt-BR"')) {
      errors.push(`${sourcePath}: localized output is missing lang=pt-BR.`);
    }
    if (indexable) {
      if (!html.includes('<link rel="alternate" hreflang="en"') || !html.includes('<link rel="alternate" hreflang="pt-BR"')) {
        errors.push(`${sourcePath}: approved output is missing reciprocal hreflang.`);
      }
      if (html.includes('content="noindex')) {
        errors.push(`${sourcePath}: approved output is unexpectedly noindex.`);
      }
    } else {
      if (!html.includes('content="noindex, nofollow"')) {
        errors.push(`${sourcePath}: unapproved output must remain noindex.`);
      }
      if (html.includes('<link rel="alternate" hreflang="pt-BR"')) {
        errors.push(`${sourcePath}: unapproved output must not advertise pt-BR hreflang.`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    locale: pilot.locale,
    pages: entries.length,
    reviewStatus: approved ? 'approved' : 'needs-human-review',
    buildChecked: enabled && fs.existsSync(distPath),
    indexable,
  }, null, 2));
}
