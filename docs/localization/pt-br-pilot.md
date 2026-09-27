# Brazilian Portuguese localization pilot

This pilot covers the web app only. It does not include a mobile app and it does not make General Translation a runtime dependency.

## Why pt-BR

The 90-day demand check on August 28, 2026 showed a coherent Brazil/Portuguese signal: Brazil generated 4 organic clicks from 219 Search Console impressions (1.83% CTR), while Portuguese-language GA4 traffic showed stronger engagement than the larger but noisier Chinese-language segment. French was the closest alternative, but the observed activity was concentrated in a very small, outlier-prone sample.

The automated GA4/GSC collectors now include country and browser-language output. A fresh API pull is currently blocked because `GOOGLE_SERVICE_ACCOUNT_JSON` points to the missing file `scripts/config/google-service-account.json`. Restore that credential before recording the final launch baseline.

## Pilot routes

1. `/pt-BR/`
2. `/pt-BR/best/gemini-prompts/`
3. `/pt-BR/best/best-ai-prompts/`
4. `/pt-BR/best/free-ai-prompts/`
5. `/pt-BR/best/prompt-templates/`
6. `/pt-BR/best/cursor-ai-prompts/`
7. `/pt-BR/prompts/ai-slop-remover/`
8. `/pt-BR/prompts/business-plan-executive-summary/`

## Review and publishing gate

Translations live in `src/data/i18n/pt-BR/`. All eight pages were changed to `reviewStatus: approved` and launched on 2026-09-26 (PR #33), with both environment flags set on Vercel production and preview. Use `--launch-date=2026-09-26` for the pilot report.

Use `docs/localization/pt-br-review-checklist.md` for the required Brazilian Portuguese review. Each translation also stores a fingerprint of its English source; source changes invalidate the review gate until the translation and fingerprint are refreshed.

For a local or preview review build:

```sh
npm run localization:review-build
```

The build creates the localized routes, but they remain `noindex`, are omitted from the sitemap, and do not emit the pt-BR `hreflang` alternate.

To make the pilot eligible for indexing, a human reviewer must change every page to `reviewStatus: approved`, and the deployment environment must set both:

```text
PUBLIC_LOCALIZATION_PILOT_ENABLED=true
PUBLIC_LOCALIZATION_PILOT_INDEXABLE=true
```

The code requires both conditions. If either is missing, the localized pages cannot be indexed. Once approved, English and localized pages emit reciprocal `hreflang` values plus `x-default`.

Both flags are site-wide, but every locale is gated on its own data. With the flags set, a locale builds and is indexed only once every one of its pages is `approved` against the current English source; a locale with any page still under review is left out of the build entirely, so unreviewed machine translation never reaches production, not even as `noindex`. To build unapproved locales for review, list them in `PUBLIC_LOCALIZATION_REVIEW_LOCALES` (comma-separated, or `*` for all); `npm run localization:review-build` does that for every locale. Such pages render `noindex`, are left out of the sitemap and advertise no `hreflang`.

## Measurement

Run fresh collectors and the pilot report on a consistent date:

```sh
npm run seo:pull:gsc -- --date=YYYY-MM-DD
npm run seo:pull:ga4 -- --date=YYYY-MM-DD
npm run localization:report -- --date=YYYY-MM-DD --launch-date=YYYY-MM-DD
```

GA4 events now include `site_locale` and `localization_pilot`. The report tracks localized sessions, engaged sessions, prompt copies, prompt saves, and newsletter CTA clicks. The pt-BR newsletter URL also carries `utm_campaign=pt-br-pilot`; completed subscriptions must be confirmed in Beehiiv.

Do not expand before 42 days. After six to eight weeks, expansion is eligible for review only if the pilot has at least 100 localized organic impressions, 5 localized organic clicks, and 10 combined prompt copies, saves, and newsletter CTA clicks. A human must also confirm at least one attributed newsletter subscription and no technical SEO regression.

## Additional locales through General Translation

Spanish (Latin American, `es-419`), French (`fr`) and German (`de`) are prepared with the General Translation CLI, which is a build-time tool only: the site never calls General Translation at runtime. The ranking came from the 90-day demand check on 2026-09-25: French and Spanish each had about 1.3K to 1.4K Search Console impressions, with Mexico the largest Spanish market, and German had the best click-through rate and a native query ("datenanalyse prompts") that already ranks. German is therefore a single-collection test on `/best/data-analysis-prompts/` rather than the full pilot set.

The pipeline keeps machine translation away from page structure:

1. `node scripts/localization/build-pilot-source.mjs` writes the English source files in `src/data/i18n/en/`: `pilot-content.json` (the eight pilot pages), `data-analysis.json` (the German test collection) and `common.json` (UI strings). Only translatable text goes in; `pilot-content.metadata.json` carries translator context such as keeping `[PLACEHOLDERS]` intact.
2. `npx gt translate` (es-419 and fr, from `gt.config.json`) and `npx gt translate --config gt.de.config.json` (de) send those files and download `src/data/i18n/<locale>/` copies. The CLI reads `GT_API_KEY` and `GT_PROJECT_ID` from the gitignored `.env.local`; the project is `AIPromptIndex` in the General Translation organization.
3. `node scripts/localization/assemble-pilot.mjs <locale>` (add `--source data-analysis` for de) rebuilds `pilot-pages.json` for that locale: page type, source slug, source fingerprint and variable names come from the English side, every placeholder is verified, and every page starts as `needs-human-review`.

The review and publishing gate above applies unchanged. A fluent reviewer must change each page to `approved` before it can be indexed, and the 42-day expansion rule still governs when any of these locales may go live.

All locales share one route, `src/pages/[locale]/[...slug].astro`. The locale list is not configured anywhere: every folder under `src/data/i18n/` that holds a `pilot-pages.json` is a locale (`src/lib/localization.ts`, `astro.config.mjs` and the guard all discover it the same way), and each locale's `common.json` carries every UI string, including the short header labels (`nav`), category and difficulty names, and the search and save copy. To add a locale: build the English sources, translate, assemble, then register its Open Graph code in `src/lib/localization.ts` if the default `xx_YY` form is wrong. The report and TypeSafe pre-review accept `--locale=<code>` and default to pt-BR.

Reviewing a translated locale:

1. Edit the General Translation output file, `src/data/i18n/<locale>/pilot-content.json` (or `data-analysis.json`), not `pilot-pages.json`. Titles and descriptions must fit the 60 and 155 character limits before a page can be approved; the guard lists the ones that do not as warnings.
2. Run `npm run localization:assemble -- <locale>` (add `--source data-analysis` for de) to carry the edits into `pilot-pages.json`, then change `reviewStatus` to `approved` there. Re-assembling keeps approved pages as they are unless `--force` is passed.
3. On the next `npx gt translate --save-local`, the CLI uploads the local edits so the translator does not undo them.

UI strings live in `common.json` and are edited in place; the assemble step only pins `locale` and `languageName`.
