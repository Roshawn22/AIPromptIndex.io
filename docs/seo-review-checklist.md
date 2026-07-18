# SEO Review Checklist

Use this file for post-deploy SEO and analytics reviews on `aipromptindex.io`.

Automation:

- Run `npm run seo:verify:ga4-live` for a live browser-based GA4 verification on a prompt page.
- Content candidates for the next build cycle are tracked in [seo-content-targets-post-april-21.md](/Users/roshawnfranklin/AIPromptIndex.io/docs/seo-content-targets-post-april-21.md).
- The current execution plan for the next two weeks is tracked in [seo-execution-checklist-2026-04-22-to-2026-05-05.md](/Users/roshawnfranklin/AIPromptIndex.io/docs/seo-execution-checklist-2026-04-22-to-2026-05-05.md).

## Current Baseline

Baseline date: April 14, 2026

- Production deploy with analytics fixes: `dpl_6GLzaWVcdjd3nrdrvGFbFtvePSW4`
- Production deploy with landing-page/internal-linking pass: `dpl_Gt8h4NxPhNVACFCuLY7K8dvtFmdh`
- Latest local cleanup pass status: broad-page metadata tightened, `compare` and `prompt-of-the-day` moved to `noindex`, editorial links added to homepage, tool pages, and category pages
- GSC pages with impressions: `11`
- GSC clicks: `0`
- GA4 organic sessions: `4`
- Optional Semrush organic keywords: `1`
- Ahrefs organic keywords: `0`
- Ahrefs live refdomains: `4`

## Immediate Post-Deploy Pass

Goal: verify the targeted April 15 cleanup is live before requesting indexing.

### 1. Reindex Queue

- [ ] `/`
- [ ] `/best/`
- [ ] `/best/best-ai-prompts/`
- [ ] `/best/free-ai-prompts/`
- [ ] `/guides/prompt-engineering-101/`
- [ ] `/blog/best-chatgpt-prompts-2026/`
- [ ] `/blog/how-to-write-ai-prompts-beginners-guide/`
- [ ] `/tools/chatgpt/`
- [ ] `/tools/claude/`
- [ ] `/categories/writing/`
- [ ] `/categories/marketing/`

### 2. Utility Page Exclusion Check

- [ ] `/compare/` returns `noindex, nofollow`
- [ ] `/prompt-of-the-day/` returns `noindex, nofollow`
- [ ] `/compare/` is absent from sitemap
- [ ] `/prompt-of-the-day/` is absent from sitemap

### 3. Internal-Linking Check

- [ ] Homepage links to `Best AI Prompts`
- [ ] Homepage links to `Free AI Prompts`
- [ ] Homepage links to guide/blog editorial resources
- [ ] Tool pages link to guide/blog editorial resources
- [ ] Category pages link to guide/blog editorial resources
- [ ] `/best/` links to `Best AI Prompts`
- [ ] `/best/` links to `Free AI Prompts`

## April 21, 2026 Review

Goal: verify crawlability, confirm analytics instrumentation, and look for the first post-deploy search movement.

### 1. Live Page Check

- [ ] Check `/`
- [ ] Check `/tools/chatgpt/`
- [ ] Check `/tools/claude/`
- [ ] Check `/tools/midjourney/`
- [ ] Check `/categories/writing/`
- [ ] Check `/categories/marketing/`
- [ ] Check `/guides/prompt-engineering-101/`
- [ ] Check `/blog/best-chatgpt-prompts-2026/`
- [ ] Check `/best/stable-diffusion-prompts/`

### 2. On-Page Change Check

- [ ] Homepage shows the `Start Here` section
- [ ] Homepage shows the `Learn Prompting Faster` section
- [ ] Tool pages show links to collections, audience pages, and best-of pages
- [ ] Tool pages show links to related guides and blog posts
- [ ] Category pages show links to tool collections, audience pages, and best-of pages
- [ ] Category pages show links to related guides and blog posts

### 3. Crawl and Index Signals

- [ ] `robots.txt` loads
- [ ] `sitemap-index.xml` loads
- [ ] Updated pages return `200`
- [ ] Canonical tags point to production URLs

### 4. Analytics Event Check

- [ ] Trigger `prompt_viewed` in GA4 DebugView or Realtime
- [ ] Trigger `prompt_copied` in GA4 DebugView or Realtime
- [ ] Confirm `prompt_slug` param is present
- [ ] Confirm `tool` param is present where expected
- [ ] Confirm `category` param is present where expected

### 5. GSC Early Performance Check

Compare last 7 days vs previous 7 days for:

- [ ] `/`
- [ ] `/guides/prompt-engineering-101/`
- [ ] `/blog/best-chatgpt-prompts-2026/`
- [ ] `/best/stable-diffusion-prompts/`
- [ ] `/tools/chatgpt/`
- [ ] `/categories/writing/`

Metrics to record:

- [ ] Impressions
- [ ] Clicks
- [ ] CTR
- [ ] Average position

### 6. GSC Query Check

Look for movement on:

- [ ] `ai prompt library`
- [ ] `free prompt library`
- [ ] `prompt engineering for beginners`
- [ ] `chatgpt prompt examples`
- [ ] `ai prompt templates`
- [ ] `stable diffusion prompts`

### 7. April 21 Outcome

- [ ] At least one updated broad landing page is showing impressions
- [ ] GA4 events are recording
- [ ] If not, mark follow-up actions below

## May 12, 2026 Review

Goal: compare the live site against the April 14 baseline and decide whether the current SEO direction is working.

### 1. Baseline Comparison

- [ ] GSC pages with impressions vs `11`
- [ ] GSC clicks vs `0`
- [ ] GA4 organic sessions vs `4`
- [ ] Optional Semrush organic keywords vs `1`
- [ ] Ahrefs organic keywords vs `0`
- [ ] Ahrefs live refdomains vs `4`

### 2. GSC Page Review

Review last 28 days for:

- [ ] `/`
- [ ] `/guides/prompt-engineering-101/`
- [ ] `/blog/best-chatgpt-prompts-2026/`
- [ ] `/best/stable-diffusion-prompts/`
- [ ] `/tools/chatgpt/`
- [ ] `/tools/claude/`
- [ ] `/categories/writing/`
- [ ] `/categories/marketing/`

### 3. GSC Query Review

Check for growth or new entries on:

- [ ] `prompt engineering for beginners`
- [ ] `chatgpt prompt examples`
- [ ] `ai prompt templates`
- [ ] `stable diffusion prompts`
- [ ] `ai prompt library`
- [ ] `free ai prompts`
- [ ] New non-brand queries

### 4. GA4 Review

- [ ] Organic sessions for last 28 days
- [ ] Organic landing pages for last 28 days
- [ ] `prompt_viewed` event count
- [ ] `prompt_copied` event count
- [ ] Confirm updated broad landing pages appear among organic landing pages

### 5. Optional Semrush Review

- [ ] Organic keywords total
- [ ] Top pages
- [ ] Position change for `prompt engineering for beginners`
- [ ] Check whether `/tools/*` or `/categories/*` pages entered keyword tracking

### 6. Ahrefs Review

- [ ] Organic keywords total
- [ ] Top pages
- [ ] Top subfolders
- [ ] Refdomains
- [ ] Check whether updated landing pages appear as top pages

### 7. Decision Check

Keep current direction if one or more are true:

- [ ] GSC clicks are above `0`
- [ ] Updated broad landing pages are earning impressions
- [ ] GA4 shows real `prompt_viewed` and `prompt_copied` volume from organic traffic
- [ ] Ahrefs keywords increase above `0`
- [ ] Ahrefs starts showing non-zero top pages or keywords

Escalate to the next SEO pass if one or more are true:

- [ ] Broad pages still have little or no impressions
- [ ] CTR is weak despite impressions
- [ ] Individual prompt pages outperform category or tool pages by a wide margin
- [ ] Ahrefs and first-party signals still show near-zero discovery

## Review Notes Template

Copy this section for each review.

```md
## Review: YYYY-MM-DD

### Wins
- 

### Pages Up
- 

### Queries Up
- 

### Event Status
- 

### Tool Snapshots
- GSC:
- GA4:
- Semrush (optional):
- Ahrefs:

### Next Actions
- 
```
