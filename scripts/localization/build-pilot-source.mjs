import fs from 'node:fs';
import path from 'node:path';

import { SEO_DESCRIPTION_MAX, SEO_TITLE_BUDGET } from './seo-limits.mjs';

// Writes the English source files that General Translation translates:
//   src/data/i18n/en/pilot-content.json      the eight pilot pages (es-419, fr)
//   src/data/i18n/en/data-analysis.json      the German test collection (de)
//   src/data/i18n/en/common.json             UI strings shared by every locale
// plus a <file>.metadata.json sidecar for each of the first two, carrying translator
// context. Only translatable text goes in. Structure (page type, source slugs, fingerprints,
// variable names) is re-attached by assemble-pilot.mjs, so machine translation can
// never alter it. Keys mirror src/data/i18n/pt-BR/pilot-pages.json.

const repoRoot = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
const write = (relativePath, value) => {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n');
  console.log(`wrote ${relativePath}`);
};

const pilot = read('src/data/i18n/pt-BR/pilot-pages.json');
const bestof = read('src/data/seo/bestof-pages.json');

// The localized home page is its own small page rather than a copy of index.astro,
// so its English copy lives here. Keep it in step with HeroEntrance.tsx and index.astro.
const HOME = {
  title: 'Free AI Prompt Library for ChatGPT, Claude and More',
  metaTitle: 'Free AI Prompt Library',
  description: 'Browse a free library of prompts and templates for ChatGPT, Claude, Midjourney, Gemini, Cursor, and other tools. Copy, customize, and use them fast.',
  metaDescription: 'Browse free prompts and templates for ChatGPT, Claude, Gemini, Midjourney, and Cursor. Copy, customize, and use them fast.',
  eyebrow: 'Free AI prompt library',
  heading: 'Find a better prompt. Start faster.',
  intro: 'Copy-ready prompts organized by tool, category, and goal. Pick a starting point, fill in the variables, and keep what works.',
  primaryCta: 'Browse the best prompts',
  secondaryCta: 'See free prompts',
  sectionHeading: 'Start with these collections',
  sectionIntro: 'Start with these collections: they are the most useful pages of the catalog in this language.',
};

function roundupContent(slug) {
  const entry = bestof.find((page) => page.slug === slug);
  if (!entry) throw new Error(`collection ${slug} not found`);
  return {
    title: entry.title,
    metaTitle: entry.metaTitle ? entry.metaTitle.replace(/\s*\(20\d\d\).*$/, '') : entry.title,
    description: entry.description,
    metaDescription: entry.metaDescription || entry.description,
    intro: entry.intro || entry.description,
  };
}

function promptContent(slug) {
  const prompt = read(`src/data/prompts/${slug}.json`);
  return {
    title: prompt.title,
    metaTitle: prompt.metaTitle || prompt.title,
    description: prompt.description,
    metaDescription: prompt.metaDescription || prompt.description,
    promptText: prompt.promptText,
    // Names are not translatable; they are re-attached by slug order in assemble-pilot.mjs.
    variables: prompt.variables.map((variable) => ({ description: variable.description, example: variable.example })),
    tips: prompt.tips,
  };
}

const pages = {};
for (const [sourcePath, page] of Object.entries(pilot.pages)) {
  if (page.type === 'home') pages[sourcePath] = HOME;
  else if (page.type === 'roundup') pages[sourcePath] = roundupContent(page.sourceSlug);
  else if (page.type === 'prompt') pages[sourcePath] = promptContent(page.sourceSlug);
}
const dataAnalysisPages = { '/best/data-analysis-prompts/': roundupContent('data-analysis-prompts') };
write('src/data/i18n/en/pilot-content.json', { pages });
write('src/data/i18n/en/data-analysis.json', { pages: dataAnalysisPages });

// Translator context, keyed like the content files. Hand-written notes for particular pages
// live in PAGE_CONTEXT; every page also gets a character budget on its two SEO fields.
//
// The budget is the point: General Translation translates faithfully, and faithful
// translation of compressed SEO English overruns by 1.5-1.8x ("Humanize AI Writing"
// becomes 49 characters of French). Without a budget every new locale arrives with its
// titles and descriptions over the limits the guard enforces, and has to be cut by hand.
const PAGE_CONTEXT = {
  '/prompts/ai-slop-remover/': {
    promptText: {
      context: 'Instructions given to an AI assistant. Keep every placeholder in [SQUARE_BRACKETS] exactly as written, including [AUDIENCE], [FORMAT] and [DRAFT]. The banned-word list in rule 2 and the empty phrases in rule 3 are examples of AI-sounding writing in English; replace them with the equivalent overused words and phrases that mark machine-written text in the target language rather than translating them literally. Keep the numbered structure and the output format section.',
    },
    title: { context: "Name of a prompt that removes AI-sounding patterns from writing. 'AI slop' means low-effort, generic AI-generated text." },
  },
  '/prompts/business-plan-executive-summary/': {
    promptText: {
      context: 'Instructions given to an AI assistant. Keep every placeholder in [SQUARE_BRACKETS] exactly as written. Keep the section list and the 800-word limit.',
    },
  },
};

const SEO_CONTEXT = {
  metaTitle: {
    context: `Page title shown in search results. It must be at most ${SEO_TITLE_BUDGET} characters in the target language, because the site name is appended after it. Write a short, natural title rather than a literal translation; drop filler words before meaning. Keep product names such as ChatGPT, Claude, Gemini and Cursor unchanged.`,
  },
  metaDescription: {
    context: `Meta description shown under the title in search results. It must be at most ${SEO_DESCRIPTION_MAX} characters in the target language. Condense rather than translate word for word: keep the main benefit and the product names, and drop secondary phrases before exceeding the limit.`,
  },
};

function contextFor(contentPages) {
  return {
    pages: Object.fromEntries(Object.keys(contentPages).map((sourcePath) => [
      sourcePath,
      { ...PAGE_CONTEXT[sourcePath], ...SEO_CONTEXT },
    ])),
  };
}
write('src/data/i18n/en/pilot-content.metadata.json', contextFor(pages));
write('src/data/i18n/en/data-analysis.metadata.json', contextFor(dataAnalysisPages));

// UI strings: same keys as the pt-BR file so the assemble step can copy them across.
write('src/data/i18n/en/common.json', {
  locale: 'en',
  languageName: 'English',
  skipToContent: 'Skip to main content',
  header: {
    homeLabel: 'AIPromptIndex home',
    mainNavigation: 'Main navigation',
    mobileNavigation: 'Mobile navigation',
    search: 'Search',
    searchPrompts: 'Search AI prompts',
    openSearch: 'Open search',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    submit: 'Submit a prompt (in English)',
    signIn: 'Sign in',
    themeToggle: 'Toggle dark/light mode',
  },
  // Short header labels keyed by collection slug (keys are never translated).
  nav: {
    'best-ai-prompts': 'Best',
    'free-ai-prompts': 'Free',
    'prompt-templates': 'Templates',
    'gemini-prompts': 'Gemini',
    'cursor-ai-prompts': 'Cursor',
    'data-analysis-prompts': 'Data analysis',
  },
  languageSwitcher: { label: 'Language' },
  newsletter: {
    heading: 'Get the best AI prompts every week',
    subheading: 'Curated prompts, tips, and guides, delivered free to your inbox.',
    subscribe: 'Subscribe free',
    opensIndexed: 'Opens the Indexed newsletter, in English. No spam. Unsubscribe anytime.',
    iframeTitle: 'Subscribe to the AIPromptIndex newsletter',
    noSpam: 'No spam. Unsubscribe anytime.',
    unavailable: 'Newsletter signup is temporarily unavailable.',
  },
  footer: {
    crossPromoPrefix: 'Looking for AI tools? Visit',
    crossPromoSuffix: ', the AI tools directory',
    directory: 'Directory',
    resources: 'Resources',
    bestPrompts: 'Best prompts',
    byTool: 'By tool',
    community: 'Community',
    company: 'Company',
    rights: 'All rights reserved.',
    watchYoutube: 'Watch on YouTube',
    about: 'About (in English)',
    contact: 'Contact (in English)',
    privacy: 'Privacy policy (in English)',
  },
  content: {
    home: 'Home',
    bestPrompts: 'Best prompts',
    copyReady: 'curated prompts, ready to copy and paste',
    aboutPrompt: 'About this prompt',
    variables: 'Variables to customize',
    example: 'Example',
    tips: 'Tips for the best results',
    copyPrompt: 'Copy prompt',
    copied: 'Copied!',
    originalLibraryNotice: 'The prompts below are in English. Navigation and the main pages are in this language.',
    draftNotice: 'Translation under review.',
    viewPrompt: 'View prompt (in English)',
    browseCollection: 'Browse collection',
    added: 'Added',
    updated: 'Updated',
    categories: {
      writing: 'Writing',
      coding: 'Coding',
      marketing: 'Marketing',
      'image-generation': 'Image generation',
      business: 'Business',
      'data-analysis': 'Data analysis',
      education: 'Education',
      creative: 'Creative',
    },
    difficulty: { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' },
  },
  save: {
    save: 'Save',
    saved: 'Saved',
    unsaveAria: 'Unsave prompt',
    unavailable: 'Save prompt unavailable in local development',
  },
  search: {
    aria: 'Search AI prompts',
    placeholder: 'Search prompts, guides, articles...',
    loadError: 'Search index failed to load.',
    loading: 'Loading search index...',
    noResults: 'No results for',
    tryAgain: 'Try a different search term',
    minimum: 'Type at least 2 characters to search.',
    catalogNotice: 'Results open the original catalog, in English.',
    navigate: 'navigate',
    select: 'select',
    oneResult: '1 result',
    manyResults: '{count} results',
    typeLabels: { prompt: 'Prompt', blog: 'Article', guide: 'Guide' },
  },
});
