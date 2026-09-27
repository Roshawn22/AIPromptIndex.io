import { localizePath, normalizeLocalizedPath, splitLocalizedPath } from './locale-paths';

// Every folder under src/data/i18n that holds a pilot-pages.json is a localized locale;
// the en folder only holds the English sources sent to the translator. Adding a locale
// is a data change: drop its folder in and (optionally) register its Open Graph code.

export const DEFAULT_LOCALE = 'en';
export type SiteLocale = string;

export type ReviewStatus = 'needs-human-review' | 'approved';
export interface PilotVariable { name: string; description: string; example: string }
interface PilotPageBase {
  type: 'home' | 'roundup' | 'prompt';
  reviewStatus: ReviewStatus;
  sourceFingerprint: string;
  sourcePath: string;
  sourceSlug?: string;
  title: string;
  metaTitle?: string;
  description: string;
  metaDescription?: string;
}
export interface HomePilotPage extends PilotPageBase {
  type: 'home';
  eyebrow: string;
  heading: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  sectionHeading: string;
  sectionIntro: string;
}
export interface RoundupPilotPage extends PilotPageBase { type: 'roundup'; sourceSlug: string; intro: string }
export interface PromptPilotPage extends PilotPageBase {
  type: 'prompt';
  sourceSlug: string;
  promptText: string;
  variables: PilotVariable[];
  tips: string[];
}
export type PilotPage = HomePilotPage | RoundupPilotPage | PromptPilotPage;
export interface PilotPages { locale: string; pages: Record<string, PilotPage> }

export interface SearchCopy {
  aria: string;
  placeholder: string;
  loadError: string;
  loading: string;
  noResults: string;
  tryAgain: string;
  minimum: string;
  catalogNotice: string;
  navigate: string;
  select: string;
  oneResult: string;
  manyResults: string;
  typeLabels: Record<string, string>;
}
export interface SaveCopy { save: string; saved: string; unsaveAria: string; unavailable: string }
export interface LocaleCommon {
  locale: string;
  languageName: string;
  skipToContent: string;
  header: {
    homeLabel: string;
    mainNavigation: string;
    mobileNavigation: string;
    search: string;
    searchPrompts: string;
    openSearch: string;
    openMenu: string;
    closeMenu: string;
    submit: string;
    signIn?: string;
    themeToggle?: string;
  };
  // Short header labels keyed by collection slug; collections without one fall back to their title.
  nav?: Record<string, string>;
  languageSwitcher: { label: string };
  newsletter: {
    heading: string;
    subheading: string;
    subscribe: string;
    opensIndexed: string;
    iframeTitle: string;
    noSpam: string;
    unavailable: string;
  };
  footer: {
    crossPromoPrefix: string;
    crossPromoSuffix: string;
    directory: string;
    resources: string;
    bestPrompts: string;
    byTool: string;
    community: string;
    company: string;
    rights: string;
    watchYoutube: string;
    about?: string;
    contact?: string;
    privacy?: string;
  };
  content: {
    home: string;
    bestPrompts: string;
    copyReady: string;
    aboutPrompt: string;
    variables: string;
    example: string;
    tips: string;
    copyPrompt: string;
    copied: string;
    originalLibraryNotice: string;
    draftNotice: string;
    viewPrompt: string;
    browseCollection: string;
    added: string;
    updated: string;
    categories?: Record<string, string>;
    difficulty?: Record<string, string>;
  };
  save?: SaveCopy;
  search?: SearchCopy;
}

const pilotModules = import.meta.glob<PilotPages>('../data/i18n/*/pilot-pages.json', { eager: true, import: 'default' });
const commonModules = import.meta.glob<LocaleCommon>('../data/i18n/*/common.json', { eager: true, import: 'default' });

const localeOfModule = (modulePath: string) => modulePath.split('/').at(-2) ?? '';
function byLocale<T>(modules: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(modules)
      .map(([modulePath, module]) => [localeOfModule(modulePath), module] as const)
      .filter(([locale]) => locale && locale !== DEFAULT_LOCALE),
  );
}
const PILOTS = byLocale(pilotModules);
const COMMONS = byLocale(commonModules);

// Translators return keys in their own order, so the English source's nav map decides how
// collections are ordered in the header, footer and localized home page.
const ENGLISH_COMMON = Object.entries(commonModules).find(([modulePath]) => localeOfModule(modulePath) === DEFAULT_LOCALE)?.[1];
const COLLECTION_ORDER: readonly string[] = Object.keys(ENGLISH_COMMON?.nav ?? {});

export const LOCALIZED_LOCALES: readonly string[] = Object.keys(PILOTS).sort();

const OG_LOCALES: Record<string, string> = { en: 'en_US', 'pt-BR': 'pt_BR', 'es-419': 'es_LA', fr: 'fr_FR', de: 'de_DE' };
export function getOgLocale(locale: SiteLocale) {
  return OG_LOCALES[locale] ?? locale.replace('-', '_');
}

function listFromEnv(value: unknown): string[] {
  return typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

// Gating, per locale. PUBLIC_LOCALIZATION_PILOT_ENABLED builds localized routes at all;
// a locale then builds only when every page is approved or when a review build asks for it
// (PUBLIC_LOCALIZATION_REVIEW_LOCALES lists locales or "*"). Indexing additionally needs
// PUBLIC_LOCALIZATION_PILOT_INDEXABLE and fresh fingerprints, which astro.config.mjs
// verifies and injects as PUBLIC_LOCALIZATION_REVIEW_VALID_LOCALES.
export function isLocalizationPilotEnabled() {
  return import.meta.env.PUBLIC_LOCALIZATION_PILOT_ENABLED === 'true';
}
function isReviewBuildLocale(locale: SiteLocale) {
  const requested = listFromEnv(import.meta.env.PUBLIC_LOCALIZATION_REVIEW_LOCALES);
  return requested.includes('*') || requested.includes(locale);
}
export function isLocaleApproved(locale: SiteLocale) {
  const pages = Object.values(PILOTS[locale]?.pages ?? {});
  return pages.length > 0 && pages.every((page) => page.reviewStatus === 'approved');
}
export function isLocaleEnabled(locale: SiteLocale) {
  return locale in PILOTS && isLocalizationPilotEnabled() && (isLocaleApproved(locale) || isReviewBuildLocale(locale));
}
export function isLocaleIndexable(locale: SiteLocale) {
  return isLocaleEnabled(locale)
    && import.meta.env.PUBLIC_LOCALIZATION_PILOT_INDEXABLE === 'true'
    && isLocaleApproved(locale)
    && listFromEnv(import.meta.env.PUBLIC_LOCALIZATION_REVIEW_VALID_LOCALES).includes(locale);
}
export function getEnabledLocales() {
  return LOCALIZED_LOCALES.filter(isLocaleEnabled);
}

export { normalizeLocalizedPath };
export function getLocaleFromPath(pathname: string): SiteLocale {
  return splitLocalizedPath(pathname, LOCALIZED_LOCALES).locale ?? DEFAULT_LOCALE;
}
export function getEnglishPath(pathname: string) {
  return splitLocalizedPath(pathname, LOCALIZED_LOCALES).path;
}
export function getLocalizedPath(pathname: string, locale: SiteLocale) {
  return localizePath(pathname, locale === DEFAULT_LOCALE ? null : locale, LOCALIZED_LOCALES);
}

export function getPilotPages(locale: SiteLocale): Record<string, PilotPage> {
  return PILOTS[locale]?.pages ?? {};
}
export function getLocalizedRoundups(locale: SiteLocale): RoundupPilotPage[] {
  const rank = (page: RoundupPilotPage) => {
    const index = COLLECTION_ORDER.indexOf(page.sourceSlug);
    return index === -1 ? COLLECTION_ORDER.length : index;
  };
  return Object.values(getPilotPages(locale))
    .filter((page): page is RoundupPilotPage => page.type === 'roundup')
    .sort((left, right) => rank(left) - rank(right));
}
export function getPilotPage(pathname: string, locale: SiteLocale = getLocaleFromPath(pathname)): PilotPage | undefined {
  return getPilotPages(locale)[getEnglishPath(pathname)];
}
export function hasPilotTranslation(pathname: string, locale: SiteLocale = getLocaleFromPath(pathname)) {
  return getPilotPage(pathname, locale) !== undefined;
}
export function getCommon(locale: SiteLocale): LocaleCommon | null {
  return COMMONS[locale] ?? null;
}
export function getLanguageName(locale: SiteLocale) {
  return locale === DEFAULT_LOCALE ? 'English' : COMMONS[locale]?.languageName ?? locale;
}

export function getLocaleAlternates(pathname: string) {
  const englishPath = getEnglishPath(pathname);
  const alternates = LOCALIZED_LOCALES
    .filter((locale) => hasPilotTranslation(englishPath, locale) && isLocaleIndexable(locale))
    .map((locale) => ({ locale, path: getLocalizedPath(englishPath, locale) }));
  if (alternates.length === 0) return null;
  return { en: englishPath, default: englishPath, alternates };
}

export function getLanguageSwitcherTargets(pathname: string, currentLocale: SiteLocale) {
  const englishPath = getEnglishPath(pathname);
  const targets: Array<{ locale: SiteLocale; href: string; label: string }> = [];
  if (currentLocale !== DEFAULT_LOCALE) {
    targets.push({ locale: DEFAULT_LOCALE, href: englishPath, label: getLanguageName(DEFAULT_LOCALE) });
  }
  for (const locale of getEnabledLocales()) {
    if (locale === currentLocale || !hasPilotTranslation(englishPath, locale)) continue;
    targets.push({ locale, href: getLocalizedPath(englishPath, locale), label: getLanguageName(locale) });
  }
  return targets;
}
