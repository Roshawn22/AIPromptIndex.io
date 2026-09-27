import ptBrCommon from '../data/i18n/pt-BR/common.json';
import ptBrPilot from '../data/i18n/pt-BR/pilot-pages.json';

export const DEFAULT_LOCALE = 'en' as const;
export const PILOT_LOCALE = 'pt-BR' as const;
export type SiteLocale = typeof DEFAULT_LOCALE | typeof PILOT_LOCALE;

type PilotPage = (typeof ptBrPilot.pages)[keyof typeof ptBrPilot.pages];

export const PILOT_SOURCE_PATHS = Object.keys(ptBrPilot.pages);
export const LOCALIZATION_PILOT_APPROVED = Object.values(ptBrPilot.pages).every(
  (page) => page.reviewStatus === 'approved'
);

export function normalizeLocalizedPath(pathname: string) {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/';
  const leadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return leadingSlash === '/' ? '/' : `${leadingSlash.replace(/\/+$/, '')}/`;
}

export function getLocaleFromPath(pathname: string): SiteLocale {
  return normalizeLocalizedPath(pathname).startsWith('/pt-BR/') ? PILOT_LOCALE : DEFAULT_LOCALE;
}

export function getEnglishPath(pathname: string) {
  const normalized = normalizeLocalizedPath(pathname);
  if (!normalized.startsWith('/pt-BR/')) return normalized;
  return normalizeLocalizedPath(normalized.replace(/^\/pt-BR/, '') || '/');
}

export function getLocalizedPath(pathname: string, locale: SiteLocale) {
  const englishPath = getEnglishPath(pathname);
  if (locale === DEFAULT_LOCALE) return englishPath;
  return englishPath === '/' ? '/pt-BR/' : `/pt-BR${englishPath}`;
}

export function hasPilotTranslation(pathname: string) {
  return PILOT_SOURCE_PATHS.includes(getEnglishPath(pathname));
}

export function getPilotPage(pathname: string): PilotPage | undefined {
  return (ptBrPilot.pages as Record<string, PilotPage>)[getEnglishPath(pathname)];
}

export function getPtBrCommon() {
  return ptBrCommon;
}

export function isLocalizationPilotEnabled() {
  return import.meta.env.PUBLIC_LOCALIZATION_PILOT_ENABLED === 'true';
}

export function isLocalizationPilotIndexable() {
  return isLocalizationPilotEnabled()
    && import.meta.env.PUBLIC_LOCALIZATION_PILOT_INDEXABLE === 'true'
    && import.meta.env.PUBLIC_LOCALIZATION_PILOT_REVIEW_VALID === 'true'
    && LOCALIZATION_PILOT_APPROVED;
}

export function getLocaleAlternates(pathname: string) {
  const englishPath = getEnglishPath(pathname);
  if (!hasPilotTranslation(englishPath) || !isLocalizationPilotIndexable()) return null;

  return {
    en: englishPath,
    ptBr: getLocalizedPath(englishPath, PILOT_LOCALE),
    default: englishPath,
  };
}
