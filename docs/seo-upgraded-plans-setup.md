# Ahrefs-First SEO Stack Setup

This repo now treats **Ahrefs as the system of record** for third-party SEO automation on `aipromptindex.io`.

Semrush remains supported only as an **optional manual or temporary workflow**. It is no longer part of the default scheduled automation path because the Semrush API and MCP model require separate unit spend that does not fit the current single-site budget.

## Current Decision

- Primary stack: **Ahrefs + Google Search Console + GA4**
- Default scheduled automation: **Ahrefs-first only**
- Semrush role: **manual-only or temporary until renewal**
- Renewal rule:
  Keep Semrush only if there is one Semrush-only workflow you use every week and would genuinely miss. Otherwise, let it expire and stay consolidated on Ahrefs.

## Status Snapshot

| System | Status | Notes |
|---|---|---|
| Ahrefs Site Audit | ✅ Active | Main crawl health source |
| Ahrefs Rank Tracker | ✅ Active | Main rank monitoring source |
| Ahrefs Site Explorer / Keywords Explorer / Backlinks | ✅ Active | Main research source |
| GSC | ✅ Active | First-party index and query truth |
| GA4 | ✅ Active | First-party traffic and event truth |
| Semrush Projects | Optional | Keep only if a manual UI workflow still earns its keep |
| Semrush API / MCP | De-prioritized | Not part of the default automation path |

## Ahrefs Budget Snapshot

- Current Standard plan budget: `400,000` shared monthly API units.
- Current Standard row cap: `250` rows/request.
- Shared pool rule: Ahrefs API v3, Ahrefs MCP, and Ahrefs Connect all spend from the same API unit pool.
- April 28 reference benchmark: a full `aitoolindex.io` Ahrefs pass generated `96` files and `1,888` rows for about `9,506` units based on before/after usage.
- Practical default: use fuller Ahrefs pulls when they answer a concrete SEO question, but keep backlink and keyword exports budgeted because Ahrefs charges by row and field cost.

## Default Automation

These are now the repo’s default commands:

```bash
npm run seo:pull:daily
npm run seo:pull:weekly
npm run seo:pull:monthly
npm run seo:pull:all
```

What they do now:

- `seo:pull:daily`
  Ahrefs baseline + Ahrefs Site Audit overview + Ahrefs Rank Tracker + GSC + GA4 + brief + Medium syndication
- `seo:pull:weekly`
  Ahrefs deep pull: Keywords Explorer, Backlinks Deep, full Site Audit, Brand Radar. Keep larger keyword/backlink exports explicit with CLI limits rather than raising heavy defaults automatically.
- `seo:pull:monthly`
  Ahrefs Batch Analysis only
- `seo:pull:all`
  Ahrefs + Brand Radar + GSC + GA4 + brief + Medium syndication

## Optional Semrush Commands

Semrush helpers still exist for manual use:

```bash
npm run seo:pull:semrush
npm run seo:pull:semrush-supplemental
npm run seo:pull:semrush-projects
npm run seo:cross-validate
```

Convenience wrappers:

```bash
npm run seo:pull:semrush-manual
npm run seo:pull:hybrid
```

Use them only if you intentionally keep Semrush for a narrow workflow.

- `seo:pull:semrush-manual`
  Runs the Semrush domain/project pulls and keyword cross-validation on demand
- `seo:pull:hybrid`
  Runs the old mixed Ahrefs + Semrush path when you explicitly want a temporary side-by-side comparison

## Required Environment

Required for the default stack:

```bash
AHREFS_API_TOKEN=
AHREFS_SITE_AUDIT_PROJECT_ID=
AHREFS_RANK_TRACKER_PROJECT_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SEARCH_CONSOLE_PROPERTY=
GOOGLE_ANALYTICS_PROPERTY_ID=
PUBLIC_GOOGLE_SITE_VERIFICATION=
PUBLIC_AHREFS_SITE_VERIFICATION=
PUBLIC_GA_MEASUREMENT_ID=
PUBLIC_SITE_URL=https://aipromptindex.io
```

Optional only if you keep Semrush:

```bash
SEMRUSH_API_KEY=
SEMRUSH_PROJECT_ID=
SEMRUSH_POSITION_TRACKING_CAMPAIGN_ID=
SEMRUSH_SITE_AUDIT_CAMPAIGN_ID=
SEMRUSH_ONPAGE_CAMPAIGN_ID=
```

## GitHub Actions

Three workflows remain scheduled, but they now follow the Ahrefs-first decision:

| Workflow | Schedule | Purpose |
|---|---|---|
| `.github/workflows/seo-data-pull.yml` | Daily 7 AM PT | Ahrefs + first-party data + brief + Medium |
| `.github/workflows/seo-weekly.yml` | Mondays 7 AM PT | Ahrefs deep research |
| `.github/workflows/seo-monthly.yml` | 1st of month 7 AM PT | Ahrefs batch analysis + archive |

Manual trigger:

```bash
gh workflow run seo-data-pull.yml
gh workflow run seo-weekly.yml
gh workflow run seo-monthly.yml
```

## What To Keep Using Semrush For, If Anything

Only keep it for one specific manual job, such as:

- a manual **On-Page SEO Checker** review in the UI
- a manual **Site Audit** view you prefer over Ahrefs for specific diagnostics
- a manual reporting screen you actually open every week

If you cannot name a recurring weekly workflow like that, Semrush should not be renewed for this project.

## Verification

Run this after env changes or before relying on automation:

```bash
npm run seo:verify:setup
npm run seo:verify:live
```

Interpretation:

- Ahrefs missing or blocked: fix immediately
- GSC / GA4 missing: fix immediately
- Semrush missing: acceptable, because it is now optional
- Semrush blocked by units: acceptable for the default stack, because Semrush is no longer in the critical path
