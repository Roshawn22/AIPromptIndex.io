# OpenSEO + first-party SEO stack

AIPromptIndex scheduled SEO jobs treat **Google Search Console and GA4 as first-party truth** and **OpenSEO (DataForSEO Labs)** as the third-party research source.

Ahrefs is **opt-in only**. The free Ahrefs plan cannot power these jobs. Leave `SEO_ENABLE_AHREFS=false` unless you are back on a paid Ahrefs API plan.

Semrush remains a **manual** helper. It is not part of the default daily path.

## Current decision

- Primary stack: **GSC + GA4 + OpenSEO/DataForSEO**
- Default scheduled automation: first-party pulls every day; OpenSEO when `DATAFORSEO_API_KEY` is set
- Ahrefs: off unless `SEO_ENABLE_AHREFS=true`
- Semrush: optional `seo:pull:hybrid` / `seo:pull:semrush-manual`

## Status snapshot

| System | Status | Notes |
|---|---|---|
| GSC | Required | Query and page truth; briefs are gated on a successful GSC pull |
| GA4 | Required locally, continue-on-error in CI | Traffic and events |
| OpenSEO / DataForSEO | Default third-party | Domain rank, ranked keywords, relevant pages, competitors, weekly keyword ideas |
| Ahrefs Site Explorer / Keywords Explorer / Site Audit / Rank Tracker | Opt-in | Ignored by scheduled jobs unless `SEO_ENABLE_AHREFS=true` |
| Semrush | Optional | Manual comparison only |

## Required GitHub secret

Add **`DATAFORSEO_API_KEY`** to the repo secrets. Use the DataForSEO API Access value (Base64 `login:password`) or the raw `login:password` string. Scripts also accept `OPENSEO_DATAFORSEO_API_KEY` or `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD`.

Without this secret:

- Daily GSC / GA4 / brief still run
- OpenSEO steps skip with `ok: true`
- Keyword research falls back to GSC rows

## Default automation

```bash
npm run seo:pull:daily
npm run seo:pull:weekly
npm run seo:pull:monthly
npm run seo:pull:all
```

- `seo:pull:daily` — GSC + GA4 + OpenSEO (no-op without a key) + brief
- `seo:pull:weekly` — OpenSEO baseline + weekly keyword ideas, backlinks summary, competitor keywords
- `seo:pull:monthly` — OpenSEO snapshot (Ahrefs batch analysis only if opt-in)
- `seo:pull:all` — same as daily

## GitHub Actions

| Workflow | Schedule | Purpose |
|---|---|---|
| `.github/workflows/seo-data-pull.yml` | Daily 7 AM PT | GSC + GA4 + OpenSEO + briefs |
| `.github/workflows/seo-weekly.yml` | Mondays 7 AM PT | OpenSEO keyword ideas and competitor keywords |
| `.github/workflows/seo-monthly.yml` | 1st of month 7 AM PT | OpenSEO snapshot + archive |

Issue **#5** (`ahrefs.api` blocked) is leftover from the Ahrefs-first path. Daily jobs ignore Ahrefs-only blocks and close that issue when the body is Ahrefs-only. A new blocked-endpoint issue is opened only for OpenSEO/DataForSEO or other remaining APIs.

Manual trigger:

```bash
gh workflow run seo-data-pull.yml
gh workflow run seo-weekly.yml
gh workflow run seo-monthly.yml
```

## Optional Semrush

```bash
npm run seo:pull:semrush-manual
npm run seo:pull:hybrid
```

Use these only for a temporary side-by-side comparison.

## Local env

See `.env.example`. Required for first-party pulls:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SEARCH_CONSOLE_PROPERTY=sc-domain:aipromptindex.io
GOOGLE_ANALYTICS_PROPERTY_ID=
PUBLIC_GOOGLE_SITE_VERIFICATION=
PUBLIC_GA_MEASUREMENT_ID=
PUBLIC_SITE_URL=https://aipromptindex.io
DATAFORSEO_API_KEY=
```

## Verification

```bash
npm run seo:verify:setup
npm run seo:verify:live
```

Interpretation:

- GSC missing: fix immediately
- GA4 missing: fix immediately for local setup; CI continues if GA4 fails
- OpenSEO / DataForSEO missing: jobs still run; research rows fall back to GSC until the secret is set
- Ahrefs missing: expected
- Semrush missing: expected
