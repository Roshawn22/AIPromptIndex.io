import fs from 'node:fs';
import path from 'node:path';

// Writes the English source files that General Translation translates:
//   src/data/i18n/en/pilot-content.json      the eight pilot pages (es-419, fr)
//   src/data/i18n/en/data-analysis.json      the German test collection (de)
//   src/data/i18n/en/common.json             UI strings shared by every locale
// Only translatable text goes in. Structure (page type, source slugs, fingerprints,
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
write('src/data/i18n/en/pilot-content.json', { pages });
write('src/data/i18n/en/data-analysis.json', { pages: { '/best/data-analysis-prompts/': roundupContent('data-analysis-prompts') } });

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
