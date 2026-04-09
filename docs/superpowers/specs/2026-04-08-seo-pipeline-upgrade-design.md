# SEO Pipeline Upgrade: Ahrefs + SEMRush Full Integration

**Date:** 2026-04-08
**Status:** Draft
**Scope:** AIPromptIndex.io

## Context

AIPromptIndex.io currently has basic Ahrefs Web Analytics tracking but zero SEMRush integration and no automated SEO data pipeline. Meanwhile, the sister site AIToolIndex.io has a mature, battle-tested SEO infrastructure with daily automated data pulls, cross-validation, Brand Radar AI visibility monitoring, and a synthesized brief generator. The goal is to port that proven infrastructure, fix the 10 site audit errors holding back rankings, and layer on new AI-powered features.

**Current state:**
- Domain Rating: 0.0 | Organic keywords ranking: 0 | 2 live backlinks
- Ahrefs project active (ID: 9646940, 15 keywords tracked, 96/100 site audit)
- SEMRush: completely absent
- 6 visitors in 5+ weeks

## Approach

**Port & Extend** — 3 phases:
1. Port proven SEO scripts from AIToolIndex.io
2. Fix technical SEO issues from site audit
3. Build new AI-powered content intelligence features

---

## Phase 1: Infrastructure Port

### 1.1 Create `scripts/seo/_shared.mjs`

Port from `aitoolindex-deploy/scripts/seo/_shared.mjs`. Key adaptation: rewrite `loadSiteInventory()` for AIPromptIndex.io's content model:

| Content Type | Source | URL Pattern |
|-------------|--------|-------------|
| Prompts | `src/data/prompts/*.json` (154 files) | `/prompts/<slug>` |
| Categories | `src/data/categories/` | `/categories/<slug>` |
| Audience pages | `src/data/seo/audience-pages.json` | `/prompts/for/<slug>` |
| Best-of pages | `src/data/seo/bestof-pages.json` | `/best/<slug>` |
| Tool-category combos | `src/data/seo/tool-category-pages.json` | `/prompts/<tool>/<category>` |
| Blog | `src/data/blog/*.md` | `/blog/<slug>` |
| Guides | `src/data/guides/*.md` | `/guides/<slug>` |

Also adapt `classifySurface()` and `inferOpportunitySurface()` for prompt-specific patterns. All domain-agnostic utilities (parseCliArgs, fetchJson, fetchAhrefsJson, fetchSemrushRows, etc.) stay unchanged.

### 1.2 Port `scripts/seo/pull-ahrefs.mjs`

Change default target: `aitoolindex.io` → `aipromptindex.io`. Everything else identical.

Pulls: domain rating, backlinks stats, organic keywords (top 250), top pages (top 200), referring domains (top 100), organic competitors (top 25).

Output: `output/seo/<date>/ahrefs-{overview,keywords,top-pages,competitors}.json`

### 1.3 Port `scripts/seo/pull-semrush.mjs`

Change default target: `aitoolindex.io` → `aipromptindex.io`. Everything else identical.

Pulls: domain_ranks, domain_organic (top 250), organic competitors (top 25), rank history, keyword enrichment (AI Overview detection via feature code 52).

Output: `output/seo/<date>/semrush-{overview,keywords,competitors,rank-history,keyword-details}.json`

### 1.4 Port `scripts/seo/cross-validate.mjs`

No changes needed — entirely domain-agnostic. Reads ahrefs-keywords.json and semrush-keywords.json, cross-validates position/volume.

Output: `output/seo/<date>/cross-validation.json`

### 1.5 Port `scripts/seo/pull-brand-radar.mjs`

Adapt brand parameters:
- Brand: `aipromptindex`
- Market: `ai prompts`
- Competitors: `prompthero,flowgpt,snackprompt,promptbase` (validate against Ahrefs organic competitors data during implementation)

Output: `output/seo/<date>/brand-radar.json`

### 1.6 Port `scripts/seo/pull-gsc.mjs` and `pull-ga4.mjs`

- GSC: Change `siteProperty` to `sc-domain:aipromptindex.io`
- GA4: Change `keyEventNames` to `['prompt_copied', 'prompt_viewed']`

Output: `output/seo/<date>/gsc-{pages,queries}.json`, `ga4-landing-pages.json`

**Dependency:** Requires Google Service Account provisioning (see Step 1.9b).

### 1.7 Port `scripts/seo/build-brief.mjs`

Adapt domain references and use the modified `loadSiteInventory()`. Make GSC/GA4 data reads optional (`readOptional` pattern) so the brief works even without Google data.

Output: `output/seo/<date>/brief.md`

### 1.8 Add npm scripts to `package.json`

```json
"seo:pull:ahrefs": "node scripts/seo/pull-ahrefs.mjs",
"seo:pull:semrush": "node scripts/seo/pull-semrush.mjs",
"seo:pull:gsc": "node scripts/seo/pull-gsc.mjs",
"seo:pull:ga4": "node scripts/seo/pull-ga4.mjs",
"seo:cross-validate": "node scripts/seo/cross-validate.mjs",
"seo:pull:brand-radar": "node scripts/seo/pull-brand-radar.mjs",
"seo:brief": "node scripts/seo/build-brief.mjs",
"seo:pull:all": "npm run seo:pull:ahrefs && npm run seo:pull:semrush -- --enrich=true --budget=standard && npm run seo:cross-validate && npm run seo:pull:brand-radar && npm run seo:pull:gsc && npm run seo:pull:ga4 && npm run seo:brief"
```

### 1.9a Add environment variables

Add to `.env` and `.env.example`:

```
AHREFS_API_TOKEN=<same token used by project 9646940>
SEMRUSH_API_KEY=<same key as AIToolIndex.io — copy from aitoolindex-deploy/.env>
AHREFS_TARGET=aipromptindex.io
SEMRUSH_TARGET=aipromptindex.io
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SEARCH_CONSOLE_PROPERTY=sc-domain:aipromptindex.io
GOOGLE_ANALYTICS_PROPERTY_ID=
BRAND_RADAR_BRAND=aipromptindex
BRAND_RADAR_MARKET=ai prompts
BRAND_RADAR_COMPETITORS=prompthero,flowgpt,snackprompt,promptbase
```

Also set as Vercel env vars and GitHub Actions secrets.

### 1.9b Provision Google Service Account

1. Go to Google Cloud Console → Create service account for `aipromptindex-seo`
2. Enable Search Console API and Google Analytics Data API
3. Grant service account email read access in Google Search Console (Settings → Users)
4. Grant service account email Viewer access in GA4 (Admin → Property Access Management)
5. Download JSON key and store as `GOOGLE_SERVICE_ACCOUNT_JSON` env var

### 1.10 Create `.github/workflows/seo-data-pull.yml`

Port from AIToolIndex.io. Daily cron at 2PM UTC (7AM Pacific). Steps:
1. Checkout + setup Node
2. Install dependencies
3. Pull Ahrefs data
4. Pull SEMRush data (enriched, standard budget)
5. Cross-validate keywords
6. Pull Brand Radar
7. Pull GSC + GA4 (optional, skipped if env vars missing)
8. Generate brief
9. Upload artifacts
10. Auto-manage failure issues (open on fail, close on success)

---

## Phase 2: Technical SEO Fixes

### 2.1 Fix site audit errors

**10 errors identified from Ahrefs Site Audit (project 9646940):**

| Error | Category | Fix Strategy |
|-------|----------|-------------|
| Duplicate pages without canonical | Duplicates | Identify duplicate page pairs via `site-audit-page-explorer`, add proper canonical tags |
| 3XX page receives organic traffic | Redirects | Convert temporary redirects to 301 permanent in `vercel.json` |
| 403 page receives organic traffic | Access | Make page public or add `noindex` to protected pages |
| 4XX page receives organic traffic | Broken | Add 301 redirects for removed URLs in `vercel.json` |

**Files to modify:** `vercel.json` (add redirects), possibly `BaseLayout.astro` (canonical logic), specific page templates (noindex flags).

### 2.2 Fix CSS warnings (7 items)

- Audit CSS output from Astro build for broken/oversized files
- Fix any `http://` references in CSS to `https://`
- Verify `build.inlineStylesheets: 'auto'` in `astro.config.mjs` is behaving correctly
- Check that www→non-www redirect doesn't affect CSS asset requests

### 2.3 Add HowTo schema to prompt pages

**File:** `src/pages/prompts/[slug].astro`

Generate HowTo JSON-LD for each prompt page using existing data:
- `data.variables` → HowToStep entries for customization
- `data.promptText` → Main step (copy and paste)
- `data.tool` → HowToTool
- `data.tips` → HowToTip entries

Pass via existing `jsonLd` prop to `BaseLayout`.

### 2.4 Add FAQPage schema to prompt pages

**File:** `src/pages/prompts/[slug].astro`

For prompts with tips and exampleOutput, generate FAQPage schema:
- "How do I use this prompt?" → Description + first tip
- "What variables need to be customized?" → Variable names and descriptions
- "What output does this prompt produce?" → First 200 chars of exampleOutput

Pattern already proven on audience pages (`/prompts/for/[slug].astro:68-81`) and best-of pages (`/best/[slug].astro:75-88`).

### 2.5 Add verification meta tags

**File:** `src/layouts/BaseLayout.astro`

Add after existing Google verification tag:
```html
<meta name="ahrefs-site-verification" content={ahrefsVerification} />
<meta name="semrush-site-verification" content={semrushVerification} />
```

New env vars: `PUBLIC_AHREFS_SITE_VERIFICATION`, `PUBLIC_SEMRUSH_SITE_VERIFICATION`

### 2.6 Audit breadcrumb coverage

BreadcrumbList schema exists on prompt pages, audience pages, and best-of pages. Verify and add to:
- `/pages/blog/[slug].astro`
- `/pages/guides/[slug].astro`
- `/pages/categories/[slug].astro`

---

## Phase 3: AI-Powered Features

### 3.1 `scripts/seo/generate-content-briefs.mjs` (NEW)

Reads keyword data + site inventory, identifies keyword gaps (high volume + not ranking), calls Ahrefs API for difficulty/SERP features/related terms, generates Markdown briefs for new pages.

Output: `output/seo/<date>/content-briefs.{json,md}`

### 3.2 `scripts/seo/analyze-ai-visibility.mjs` (NEW)

Reads Brand Radar data, compares day-over-day trends, identifies which AI platforms cite the site, recommends pages to optimize for AI citation.

Output: `output/seo/<date>/ai-visibility-analysis.json`

### 3.3 `scripts/seo/keyword-gap-analysis.mjs` (NEW)

For top-5 organic competitors, pulls their keywords via Ahrefs API, cross-references against own keywords, surfaces missing opportunities filtered to prompt-related terms.

Output: `output/seo/<date>/keyword-gaps.json`

### 3.4 `scripts/seo/suggest-rank-tracker-keywords.mjs` (NEW)

Combines gap analysis + content briefs + current 15 tracked keywords, recommends new keywords to add to Rank Tracker based on volume, difficulty, and content coverage.

Output: `output/seo/<date>/rank-tracker-suggestions.json`

### 3.5 Extend `build-brief.mjs`

Add sections to daily brief: Content Briefs Summary, AI Visibility Report, Keyword Gaps Top 10, Rank Tracker Recommendations. Uses `readOptional` pattern for graceful degradation.

### 3.6 Integrate into CI

Add Phase 3 scripts to `package.json` and `.github/workflows/seo-data-pull.yml`.

---

## Files Summary

### New files (13):
1. `scripts/seo/_shared.mjs`
2. `scripts/seo/pull-ahrefs.mjs`
3. `scripts/seo/pull-semrush.mjs`
4. `scripts/seo/cross-validate.mjs`
5. `scripts/seo/pull-brand-radar.mjs`
6. `scripts/seo/pull-gsc.mjs`
7. `scripts/seo/pull-ga4.mjs`
8. `scripts/seo/build-brief.mjs`
9. `.github/workflows/seo-data-pull.yml`
10. `scripts/seo/generate-content-briefs.mjs`
11. `scripts/seo/analyze-ai-visibility.mjs`
12. `scripts/seo/keyword-gap-analysis.mjs`
13. `scripts/seo/suggest-rank-tracker-keywords.mjs`

### Modified files (5):
14. `package.json` — add npm scripts
15. `.env.example` — add env vars
16. `src/layouts/BaseLayout.astro` — verification meta tags
17. `src/pages/prompts/[slug].astro` — HowTo + FAQPage schema
18. `vercel.json` — redirects for 3XX/4XX fixes

---

## Verification Plan

### Phase 1 verification:
1. Run `npm run seo:pull:ahrefs` locally with token — check `output/seo/<date>/ahrefs-overview.json` exists and contains valid data
2. Run `npm run seo:pull:semrush` locally with key — check semrush output files
3. Run `npm run seo:cross-validate` — check cross-validation.json
4. Run `npm run seo:pull:all` — full pipeline end-to-end
5. Trigger GitHub Actions workflow via `workflow_dispatch` — verify artifacts uploaded

### Phase 2 verification:
1. Run Ahrefs site audit re-crawl after fixes — error count should drop to 0
2. Validate HowTo + FAQPage schema via Google Rich Results Test on a prompt page URL
3. Verify verification meta tags via `curl -s https://aipromptindex.io | grep "site-verification"`
4. Check breadcrumbs on blog/guide/category pages

### Phase 3 verification:
1. Run `npm run seo:content-briefs` — verify briefs contain actionable keyword gaps
2. Run `npm run seo:keyword-gaps` — verify competitor keyword data is populated
3. Run `npm run seo:brief` — verify new sections appear in brief.md
4. Full pipeline: `npm run seo:pull:all` + Phase 3 scripts in sequence
