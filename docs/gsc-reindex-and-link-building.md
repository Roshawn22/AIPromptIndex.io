# GSC Reindex And Link-Building Sheet

Use this file for the immediate post-deploy operational work on `aipromptindex.io`.

## GSC Reindex List

Submit these URLs in Google Search Console in this order.

### Tier 1

```text
https://aipromptindex.io/
https://aipromptindex.io/best/
https://aipromptindex.io/best/best-ai-prompts/
https://aipromptindex.io/best/free-ai-prompts/
https://aipromptindex.io/guides/prompt-engineering-101/
https://aipromptindex.io/blog/best-chatgpt-prompts-2026/
https://aipromptindex.io/blog/how-to-write-ai-prompts-beginners-guide/
```

### Tier 2

```text
https://aipromptindex.io/tools/chatgpt/
https://aipromptindex.io/tools/claude/
https://aipromptindex.io/categories/writing/
https://aipromptindex.io/categories/marketing/
https://aipromptindex.io/best/stable-diffusion-prompts/
https://aipromptindex.io/best/prompt-templates/
```

### Tier 3

```text
https://aipromptindex.io/best/chatgpt-prompt-examples/
https://aipromptindex.io/blog/chatgpt-vs-claude-prompting-differences/
https://aipromptindex.io/guides/chatgpt-for-business/
https://aipromptindex.io/guides/midjourney-prompt-guide/
https://aipromptindex.io/prompts/business-plan-executive-summary/
https://aipromptindex.io/prompts/press-release-generator/
https://aipromptindex.io/prompts/cinematic-portrait-generator/
```

## GSC Submission Notes

- Submit Tier 1 first because those are the strongest broad pages and the main beneficiaries of the internal-linking cleanup.
- Submit Tier 2 next because they were updated in the latest landing-page pass and now point into more editorial resources.
- Submit Tier 3 only after Tier 1 and Tier 2 are requested.
- Do not resubmit the same URL repeatedly on the same day.
- Do not request indexing for `https://aipromptindex.io/compare/` or `https://aipromptindex.io/prompt-of-the-day/`. They are intentionally `noindex` after the cleanup pass.

## Post-Deploy Verification

Run these checks immediately after deploy and before requesting indexing.

### 1. Live Technical Check

- Run `npm run seo:verify:live`
- Confirm homepage issues are `[]`
- Confirm sample page issues are empty
- Confirm `sitemapUrlCount` remains stable

### 2. Utility Page Indexing Check

- Open `https://aipromptindex.io/compare/`
- Open `https://aipromptindex.io/prompt-of-the-day/`
- Confirm both pages render
- Confirm both pages return `noindex, nofollow`
- Confirm neither page appears in `sitemap-0.xml`

### 3. Broad Page Spot Check

- Open `https://aipromptindex.io/`
- Open `https://aipromptindex.io/best/`
- Open `https://aipromptindex.io/tools/chatgpt/`
- Open `https://aipromptindex.io/categories/writing/`
- Confirm broad pages include links to blog/guides or featured collections added in the cleanup pass

### 4. Search Console Request Order

1. Submit Tier 1 URLs
2. Wait until all Tier 1 requests are accepted
3. Submit Tier 2 URLs
4. Submit Tier 3 URLs only if there is no GSC throttling friction

## Link-Building Target Sheet

Goal: get a small number of real, relevant links into the pages most likely to compound search visibility.

### 1. Homepage

- URL: `https://aipromptindex.io/`
- Why this page matters:
  This is the main target for `ai prompt library`, `free prompt library`, and similar broad discovery terms already appearing in GSC.
- Best anchor themes:
  `AI prompt library`
  `free AI prompt library`
  `AI prompt catalog`
  `prompt library`
- Good source types:
  AI tools directories
  productivity resource roundups
  newsletters that share AI resources
  founder tool-stack pages
- Outreach angle:
  Position it as a curated library of copy-ready prompts across ChatGPT, Claude, Midjourney, Gemini, and Cursor.

### 2. Prompt Engineering 101

- URL: `https://aipromptindex.io/guides/prompt-engineering-101/`
- Why this page matters:
  It is already the strongest informational page in GSC and one of the clearest early query winners to reinforce through internal links and backlinks.
- Best anchor themes:
  `prompt engineering for beginners`
  `prompt engineering 101`
  `beginner prompt engineering guide`
  `how to learn prompt engineering`
- Good source types:
  AI education roundups
  beginner AI tutorials
  learning resource pages
  newsletters for marketers, creators, and operators adopting AI
- Outreach angle:
  Position it as an accessible beginner guide that links directly into templates and prompt examples.

### 3. Best ChatGPT Prompts For 2026

- URL: `https://aipromptindex.io/blog/best-chatgpt-prompts-2026/`
- Why this page matters:
  It already has impressions and is an easy page for newsletters and roundups to cite because it is list-based and current-year framed.
- Best anchor themes:
  `best ChatGPT prompts`
  `ChatGPT prompts for 2026`
  `free ChatGPT prompts`
  `ChatGPT prompt list`
- Good source types:
  AI newsletter link sections
  prompt-sharing communities
  productivity blogs
  “best AI resources” roundups
- Outreach angle:
  Position it as a tested list with direct links into reusable prompt pages rather than a generic opinion post.

### 4. Best Stable Diffusion Prompts

- URL: `https://aipromptindex.io/best/stable-diffusion-prompts/`
- Why this page matters:
  It is already showing strong impression-to-position signal in GSC and is one of the clearest non-text-search opportunities on the site.
- Best anchor themes:
  `stable diffusion prompts`
  `best Stable Diffusion prompts`
  `Stable Diffusion prompt ideas`
  `AI image prompts for Stable Diffusion`
- Good source types:
  AI art blogs
  image-generation communities
  model and workflow roundups
  creator resource pages
- Outreach angle:
  Position it as a curated prompt page with practical prompt structures, not just inspiration screenshots.

### 5. Prompt Templates

- URL: `https://aipromptindex.io/best/prompt-templates/`
- Why this page matters:
  It supports the broadest reusable-intent query set and is tightly connected to the beginner guide and prompt-example pages.
- Best anchor themes:
  `AI prompt templates`
  `prompt templates`
  `copy-and-paste AI prompt templates`
  `fill-in-the-blank prompts`
- Good source types:
  prompt engineering roundups
  AI workflow posts
  operations and marketing resource lists
  educational toolkits
- Outreach angle:
  Position it as a reusable systems page for people who want frameworks instead of one-off prompts.

## Small Outreach List To Build First

Do not try to build links to every page at once. Start with this order:

1. Homepage
2. Prompt Engineering 101
3. Best ChatGPT Prompts For 2026
4. Best Stable Diffusion Prompts
5. Prompt Templates

## Suggested Weekly Goal

- 3 to 5 real outreach attempts
- 1 to 2 actual links or mentions
- Bias toward relevant small sites and newsletters over generic bulk outreach

## Tracking Template

```md
## Link Outreach YYYY-MM-DD

### Target Pages
- 

### Sites Contacted
- 

### Anchor Themes Used
- 

### Wins
- 

### Follow-Ups
- 
```
