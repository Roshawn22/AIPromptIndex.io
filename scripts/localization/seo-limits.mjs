// SEO length limits for localized pages, shared by the source builder (which tells the
// translator the budget) and the guard (which enforces it), so the two cannot drift.
// Every page's <title> gets " | AIPromptIndex" appended unless it already names the site.

export const SEO_TITLE_MAX = 60;
export const SEO_TITLE_SUFFIX = ' | AIPromptIndex';
export const SEO_DESCRIPTION_MAX = 155;

// Room left for the translated metaTitle itself once the suffix is appended.
export const SEO_TITLE_BUDGET = SEO_TITLE_MAX - SEO_TITLE_SUFFIX.length;

export function renderedSeoTitle(title) {
  return title.includes('AIPromptIndex') ? title : `${title}${SEO_TITLE_SUFFIX}`;
}
