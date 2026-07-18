# SEO Execution Checklist: April 22 to May 5, 2026

Use this file as the working plan for the next 14 days on `aipromptindex.io`.

This checklist is based on:

- the current Ahrefs-first workflow setup in `.github/workflows/`
- the current review docs in [`seo-review-checklist.md`](/Users/roshawnfranklin/AIPromptIndex.io/docs/seo-review-checklist.md), [`gsc-reindex-and-link-building.md`](/Users/roshawnfranklin/AIPromptIndex.io/docs/gsc-reindex-and-link-building.md), and [`seo-content-targets-post-april-21.md`](/Users/roshawnfranklin/AIPromptIndex.io/docs/seo-content-targets-post-april-21.md)
- live verification run on `2026-04-22`

## Current Facts

### Workflow And Secret Assumptions

- Scheduled workflows are now Ahrefs-first, not Semrush-first.
- Ahrefs Standard now provides `400,000` shared monthly API units and `250` rows/request.
- Ahrefs API v3, Ahrefs MCP, and Ahrefs Connect all spend from the same API unit pool.
- The April 28 full Ahrefs pass benchmark from `aitoolindex.io` was about `9,506` units for `96` files and `1,888` rows, so single-site full passes are affordable under the new pool but heavier backlink/keyword exports still need row/field budgeting.
- Manual workflow dispatch bypasses the Pacific-time schedule gate.
- Core scheduled workflows assume these GitHub secrets exist:
  - `AHREFS_API_TOKEN`
  - `AHREFS_SITE_AUDIT_PROJECT_ID`
  - `AHREFS_RANK_TRACKER_PROJECT_ID`
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_ANALYTICS_PROPERTY_ID`
  - `GOOGLE_SEARCH_CONSOLE_PROPERTY`
- The daily workflow syndicates to Medium only when both of these optional secrets exist:
  - `MEDIUM_API_TOKEN`
  - `ANTHROPIC_API_KEY`
- `MEDIUM_API_TOKEN` and `ANTHROPIC_API_KEY` are not required for the core SEO pull.
- Medium integration tokens are a legacy Medium feature. If the account does not expose an `Integration tokens` section, leave Medium syndication disabled.
- Semrush secrets are not part of the scheduled workflow critical path.

### Current Live Site State

- `npm run seo:verify:live` passed on `2026-04-22`
- `robots.txt` reachable: yes
- `sitemap-index.xml` reachable: yes
- Sitemap URL count: `239`
- Homepage issues: none
- Sample page issues: none
- `https://aipromptindex.io/compare/` returns `200` with `noindex, nofollow`
- `https://aipromptindex.io/prompt-of-the-day/` returns `200` with `noindex, nofollow`
- `/compare/` is absent from the sitemap
- `/prompt-of-the-day/` is absent from the sitemap

### Current Content Gap

- `/best/ai-business-plan-prompts/` exists in the repo but is `404` live and absent from the sitemap
- `/best/ai-press-release-prompts/` exists in the repo but is `404` live and absent from the sitemap
- `/best/ai-cinematic-portrait-prompts/` is not live and is not part of the immediate 2-week scope

## Priority Order

1. Deploy the SEO pages that already exist in the repo
2. Confirm GitHub Actions secrets and run a manual Ahrefs-first data pull
3. Push the GSC indexing queue in the documented order
4. Run one small link-building sprint against the strongest pages
5. Make only one additional content move in week 2

## Week 1

### P0: April 22 to April 24

- [ ] Deploy the current SEO content changes so the new best-of pages are live
- [ ] After deploy, run `npm run seo:verify:live`
- [ ] Confirm these URLs return `200` and enter the sitemap:
  - `https://aipromptindex.io/best/ai-business-plan-prompts/`
  - `https://aipromptindex.io/best/ai-press-release-prompts/`
- [ ] Confirm `/best/` links to the new roundup pages if that is part of the deploy
- [ ] Confirm the seed prompt pages still render cleanly after deploy:
  - `/prompts/business-plan-executive-summary/`
  - `/prompts/press-release-generator/`

### P0: GitHub Actions Readiness

- [ ] In GitHub, confirm the required secrets are populated:
  - `AHREFS_API_TOKEN`
  - `AHREFS_SITE_AUDIT_PROJECT_ID`
  - `AHREFS_RANK_TRACKER_PROJECT_ID`
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_ANALYTICS_PROPERTY_ID`
  - `GOOGLE_SEARCH_CONSOLE_PROPERTY`
- [ ] Decide whether Medium syndication should stay enabled for now
- [ ] If yes, confirm the account already has legacy Medium token access and then set:
  - `MEDIUM_API_TOKEN`
  - `ANTHROPIC_API_KEY`
- [ ] Run `npm run seo:verify:setup` locally
- [ ] Manually dispatch `.github/workflows/seo-data-pull.yml`
- [ ] Confirm the run produces `setup-verification.json` and normal SEO output artifacts
- [ ] If a blocked endpoint issue opens, treat Ahrefs or Google failures as immediate blockers and ignore Semrush absence

### P1: GSC Reindex Queue

- [ ] Submit Tier 1 URLs from [`gsc-reindex-and-link-building.md`](/Users/roshawnfranklin/AIPromptIndex.io/docs/gsc-reindex-and-link-building.md)
- [ ] Add these newly deployed URLs to the request queue after they are live:
  - `https://aipromptindex.io/best/ai-business-plan-prompts/`
  - `https://aipromptindex.io/best/ai-press-release-prompts/`
- [ ] After Tier 1 requests are accepted, submit Tier 2
- [ ] Submit Tier 3 only if there is no GSC throttling friction
- [ ] Do not resubmit the same URL repeatedly on the same day

### P1: Live Spot Checks

- [ ] Re-check `/`
- [ ] Re-check `/best/`
- [ ] Re-check `/tools/chatgpt/`
- [ ] Re-check `/categories/writing/`
- [ ] Re-check `/guides/prompt-engineering-101/`
- [ ] Confirm homepage still links into `Best AI Prompts` and `Free AI Prompts`
- [ ] Confirm tool and category pages still expose editorial links after the latest deploy

## Week 2

### P1: April 25 to April 30

- [ ] Run one small outreach sprint using the target order from [`gsc-reindex-and-link-building.md`](/Users/roshawnfranklin/AIPromptIndex.io/docs/gsc-reindex-and-link-building.md)
- [ ] Make `3` to `5` real outreach attempts
- [ ] Focus only on these pages:
  - homepage
  - `/guides/prompt-engineering-101/`
  - `/blog/best-chatgpt-prompts-2026/`
  - `/best/stable-diffusion-prompts/`
  - `/best/prompt-templates/`
- [ ] Record outreach in the tracking template from the doc

### P1: May 1 Review Gate

- [ ] Review the latest daily and weekly SEO outputs after the workflows run
- [ ] Check whether Ahrefs is now returning non-zero page or keyword movement
- [ ] Check GSC last 7 days vs previous 7 days for:
  - `/`
  - `/guides/prompt-engineering-101/`
  - `/blog/best-chatgpt-prompts-2026/`
  - `/best/stable-diffusion-prompts/`
  - `/tools/chatgpt/`
  - `/categories/writing/`
- [ ] Check GA4 organic sessions and organic landing pages
- [ ] Decide whether the broad-page cluster or the single-prompt cluster is moving first

### P2: May 1 to May 5

- [ ] Build only one additional SEO content move in this window
- [ ] Default choice: `/guides/prompt-engineering-examples/`
- [ ] Use that default if the broad informational cluster is still the clearest opportunity
- [ ] Alternative choice: expand `/best/free-ai-prompts/`
- [ ] Use that alternative only if broad homepage and free-prompt impressions rise but CTR stays weak
- [ ] Do not start both projects in the same 2-week window
- [ ] Do not start `/best/ai-cinematic-portrait-prompts/` unless the existing cinematic portrait prompt shows sustained impressions after the deploy and reindex pass

## Success Criteria By May 5

- [ ] The two new best-of pages are live and indexed or at least submitted for indexing
- [ ] The daily SEO workflow runs successfully with Ahrefs and first-party data
- [ ] GSC has processed Tier 1 and at least part of Tier 2
- [ ] One small outreach sprint is complete
- [ ] One and only one new content decision is made for the next build cycle

## Explicit Non-Goals For This Window

- [ ] Do not make Semrush a blocker for the SEO workflow
- [ ] Do not add multiple speculative new pages at once
- [ ] Do not spend this window reconciling overlapping Ahrefs and Semrush datasets
- [ ] Do not treat API tooling as the main bottleneck before the current deploy, indexing, and outreach work is complete
