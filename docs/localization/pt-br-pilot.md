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

Translations live in `src/data/i18n/pt-BR/`. Every page currently has `reviewStatus: needs-human-review`.

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

The code requires both conditions. If either is missing, the localized pages cannot be indexed. Once approved, English and pt-BR pages emit reciprocal `hreflang` values plus `x-default`.

## Measurement

Run fresh collectors and the pilot report on a consistent date:

```sh
npm run seo:pull:gsc -- --date=YYYY-MM-DD
npm run seo:pull:ga4 -- --date=YYYY-MM-DD
npm run localization:report -- --date=YYYY-MM-DD --launch-date=YYYY-MM-DD
```

GA4 events now include `site_locale` and `localization_pilot`. The report tracks localized sessions, engaged sessions, prompt copies, prompt saves, and newsletter CTA clicks. The pt-BR newsletter URL also carries `utm_campaign=pt-br-pilot`; completed subscriptions must be confirmed in Beehiiv.

Do not expand before 42 days. After six to eight weeks, expansion is eligible for review only if the pilot has at least 100 localized organic impressions, 5 localized organic clicks, and 10 combined prompt copies, saves, and newsletter CTA clicks. A human must also confirm at least one attributed newsletter subscription and no technical SEO regression.
