// Pure path helpers shared by the site code and the Node tests. A locale prefix is the
// folder name under src/data/i18n (for example pt-BR or es-419); English has no prefix.

export function normalizeLocalizedPath(pathname: string) {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/';
  const leadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return leadingSlash === '/' ? '/' : `${leadingSlash.replace(/\/+$/, '')}/`;
}

export function splitLocalizedPath(pathname: string, locales: readonly string[]) {
  const normalized = normalizeLocalizedPath(pathname);
  for (const locale of locales) {
    const prefix = `/${locale}/`;
    if (normalized === prefix) return { locale, path: '/' };
    if (normalized.startsWith(prefix)) {
      return { locale, path: normalizeLocalizedPath(normalized.slice(prefix.length - 1)) };
    }
  }
  return { locale: null, path: normalized };
}

export function localizePath(pathname: string, locale: string | null, locales: readonly string[]) {
  const { path } = splitLocalizedPath(pathname, locales);
  if (!locale) return path;
  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}
