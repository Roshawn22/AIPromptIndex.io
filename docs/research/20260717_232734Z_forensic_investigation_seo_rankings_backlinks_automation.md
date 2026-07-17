# AIPromptIndex SEO Rankings, Backlinks, And Automation Investigation

- Repo root: `/Users/roshawnfranklin/AIPromptIndex.io`
- Branch or revision under review: `codex/ahrefs-site-audit-url-fixes` at `b30dad640715e090d92a8294ef9a9196abd5efd5`; live `origin/main` at `1c109296b8bd1eaa5e374aaa681884e8dcb164a7`
- Checked timestamp: `2026-07-17T23:27:34Z`
- Investigation scope: organic-search rankings and traffic, referring domains and backlink quality, outreach status, technical SEO health, and scheduled SEO automation through July 17, 2026
- Confidence level: High for Search Console, Ahrefs, GitHub Actions, live HTML, and Gmail findings; medium for Google attribution of the SmartBizTools profile link because Search Console does not expose a links API

## Investigation Summary

AIPromptIndex is gaining Google visibility, but it has not established broad or durable organic-search authority. Search Console recorded `8,028` page impressions and `24` clicks in the 28 days ending July 16, up from `5,371` impressions and `21` clicks in the previous 28 days. The existing-query cohort improved by only `0.27` weighted positions, so most visibility growth came from additional low-ranking queries rather than a site-wide ranking breakthrough.

The strongest current page is `/best/gemini-prompts/`, with `152` impressions, `5` clicks, and average position `13.6`. `/best/stable-diffusion-prompts/` and the Cursor prompt cluster are the next closest to useful rankings. `/best/seo-prompts/` has the most page impressions (`987`) but its page-wide average position is `74.6`; only the specific query `best seo prompts` is near the opportunity band at position `32.5`.

The backlink profile is numerically larger but strategically weak. Ahrefs reported `65` live backlinks from `64` referring domains. Detailed backlink rows contained `62` `.shop` sources, `60` Ahrefs spam flags, `62` nofollow links, one sponsored SmartBizTools hub link, and one dofollow link from DR-0 `newsiteindex.com`. SmartBizTools also has a dedicated live profile whose outbound links use `rel="noopener noreferrer"`, not `nofollow` or `sponsored`, but Ahrefs has not credited that domain with a dofollow link.

The most urgent operational finding is that scheduled SEO automation was not running successfully through July 17 despite green GitHub checks. The July 13-17 daily jobs and the July 13 weekly job passed only the runtime gate step; preflight, data pulls, and artifact uploads were skipped. The last real daily data artifact was produced July 12. `SEO AI Ops` is absent from `main`, is not registered as an active repository workflow, and has never run there. PR #15 remains open and mergeable, but its dual-cron implementation retains an exact-hour runtime gate that is still vulnerable to delayed GitHub schedule starts.

## Question Under Investigation

The investigation tested four claims:

1. Is AIPromptIndex earning meaningful organic rankings and traffic?
2. Has the outreach campaign produced useful backlinks?
3. Are the daily, weekly, monthly, and AI-ops automations actually executing rather than merely concluding green?
4. Is technical SEO health blocking growth?

Confirmation required current first-party or provider data. A green workflow conclusion without executed pull steps or an uploaded artifact did not count as a successful data run. A backlink did not count as a useful ranking link solely because Ahrefs discovered it; source quality and link qualification were inspected separately.

## Evidence Analysis

### Organic rankings and traffic

Supporting evidence:

- Search Console page export generated `2026-07-17T22:58:15.864Z` covered June 19 through July 16 and reported `8,028` impressions, `24` clicks, `0.30%` CTR, and weighted average position `53.0` across `163` pages.
- The previous 28-day window reported `5,371` impressions, `21` clicks, `0.39%` CTR, and weighted average position `45.6` across `168` pages.
- The `197` queries present in both windows accounted for `3,715` current impressions and improved by a weighted `0.27` positions. This contradicts the interpretation that the whole site lost approximately seven positions; the worse aggregate position primarily reflects new long-tail query mix.
- `/best/gemini-prompts/` produced `5` clicks from `152` impressions at position `13.6`, making it the clearest current page-one opportunity.
- `/best/stable-diffusion-prompts/` recorded `189` impressions at position `22.7`; `best stable diffusion prompts` improved from `43.5` to `30.6`.
- `/prompts/cursor/coding/` recorded `115` impressions at position `31.2`; `cursor prompts` ranked `26.7` for that page and `cursor prompt templates` ranked `27.0`.
- `/prompts/for/small-business/` recorded `347` impressions, while `ai prompts for small business` improved from `44.1` to `36.5`.
- `/guides/midjourney-prompt-guide/` grew from `194` to `580` impressions and improved from position `63.1` to `49.9`.

Contradicting evidence:

- Ahrefs Site Explorer returned zero detected organic keywords on July 17.
- The Ahrefs Rank Tracker snapshot from July 12 contained `26` configured US desktop keywords, with `0` ranked, `0` visibility, and `0` estimated traffic.
- Search Console CTR declined despite higher impressions, and `4,169` of `4,449` visible query-level impressions were at positions worse than `40`.
- GA4 organic-search sessions for June 19 through July 16 were `62`, down from `79` in the prior window. Engaged organic sessions declined from `44` to `37`.

Evidence gaps:

- Search Console suppresses anonymized queries, so page-level clicks (`24`) are more complete than the query export (`4`). The exact queries responsible for the Gemini page's five clicks cannot be recovered from the API export.
- The earlier GA4 period contained a single outlier landing page, `/best/chatgpt-prompt-examples/`, with `59` copy events. That makes the apparent decline from `61` to `4` total prompt-copy events unsuitable as proof of a current product regression.

### Backlinks and outreach

Supporting evidence:

- Ahrefs `backlinks-stats` returned `65` live backlinks, `66` all-time backlinks, and `64` live/all-time referring domains on July 17.
- Detailed live rows showed `62` `.shop` sources, `62` nofollow links, `60` Ahrefs spam flags, one sponsored link, and one dofollow link.
- The only dofollow row was `https://newsiteindex.com/sites/aipromptindex-io`, with source DR `0`.
- SmartBizTools appeared in the referring-domain response with DR `4.7`, two links to the target, and zero Ahrefs-attributed dofollow links.
- The SmartBizTools directory hub links to AIPromptIndex with `rel="noopener sponsored"`.
- The dedicated SmartBizTools profile at `https://smartbiztools.io/ai-tools/ai-prompt-index/` is live and contains multiple outbound links using `rel="noopener noreferrer"`. These links are not explicitly nofollow or sponsored in the live HTML.
- Gmail searches in the connected `Roshawn@slightedge.ai` mailbox found no substantive replies from Applied AI Tools, AIToolSync, StructPrompt, or AI Directory. AI Directory produced only automated ticket acknowledgements. No SmartBizTools or FindAIDir notification was found.
- The repo outreach log records five direct sends, plus the SmartBizTools, AIToolSync, and FindAIDir submission paths. Only SmartBizTools is confirmed as a live relevant listing.

Contradicting evidence:

- Ahrefs has not classified SmartBizTools as a dofollow referring domain despite the profile HTML lacking `nofollow` and `sponsored` on its dedicated outbound links.
- Ahrefs' representative backlink row for SmartBizTools is the sponsored directory-hub link rather than the dedicated profile link.

Evidence gaps:

- Google Search Console has no public links-report API, so this investigation could not verify whether Google has discovered or credited the dedicated SmartBizTools profile link.
- AI Valley outreach occurred through X DM, and AI Tools Up used a contact form. Gmail can verify no email follow-up but cannot prove the absence of an X or form-platform response.
- The AI Directory status endpoint returned HTTP `429` during the audit. Its current UI state is unresolved, although no public backlink or substantive support reply was found.

### Scheduled automation

Supporting evidence:

- GitHub Actions run `29591195075` on July 17 concluded `success`, but its log shows `Local Pacific gate check: hour=08`, followed by `Gate blocked this run.` Every data and artifact step was skipped.
- Daily runs `29266875940`, `29345035508`, `29428030675`, `29512022536`, and `29591195075` all skipped preflight and artifact upload from July 13 through July 17.
- Weekly run `29267027185` on July 13 also skipped preflight and artifact upload.
- The newest daily artifact was `seo-data-pull-29197198985`, created by the July 12 run. That run executed preflight, Ahrefs, Search Console, GA4, briefs, analysis, and artifact upload successfully.
- `origin/main` schedules the daily pull only at `14:00 UTC` and still gates on exact Pacific hour `07`.
- PR #15 is open, clean, and green, and adds a second DST cron plus `.github/workflows/seo-ai-ops.yml`.
- The repository's active workflow list contains CI, SEO Data Pull, SEO Weekly Pull, and SEO Monthly Pull; it does not contain SEO AI Ops.

Contradicting evidence:

- GitHub's top-level run list shows daily green conclusions, which can be mistaken for successful data collection.
- The PR #15 comments state that its two crons target 7 AM Pacific year-round, but delayed schedule execution can start after the gate's accepted hour and still no-op. The added second cron handles DST, not arbitrary GitHub scheduler delay.

Evidence gaps:

- AI Ops cannot be production-tested until its workflow exists on the default branch and the required Anthropic secret is available to that workflow.

### Technical SEO and AI visibility

Supporting evidence:

- The Ahrefs Site Audit overview generated July 12 references a completed July 10 crawl with health score `100`, `0` URLs with errors, `3` URLs with warnings, `156` URLs with notices, and `259` total URLs.
- Live `robots.txt`, `sitemap-index.xml`, the homepage, `/best/gemini-prompts/`, and `/best/seo-prompts/` returned HTTP `200` with expected sitemap, canonical, and `index, follow` directives.

Contradicting evidence:

- Ahrefs Brand Radar reported zero AI mentions and zero share of voice across ChatGPT, Perplexity, Gemini, Copilot, Google AI Overviews, and Google AI Mode as of July 12.

Evidence gaps:

- The weekly full-crawl artifact did not refresh after July 13 because the workflow was gate-skipped, so the detailed warning/notice inventory is not current through July 17.

## Timeline Reconstruction

- `2026-04-16`: Applied AI Tools and AI Valley outreach sent; both follow-ups due April 23.
- `2026-05-28`: AITopTools, AI Tools Up, and StructPrompt outreach recorded; AI Directory follow-up sent.
- `2026-05-31`: Second AI Directory support ticket submitted; automated acknowledgement received.
- `2026-06-06`: SmartBizTools and FindAIDir submitted through public forms; AIToolSync submitted through email fallback.
- `2026-07-04`: PR #15 opened with SEO automation/model fixes, presentation fixes, AI Ops workflow, and CI wiring.
- `2026-07-10T04:40:54Z`: Latest Ahrefs Site Audit crawl in the July 12 artifact completed with health score `100`.
- `2026-07-12T14:56:02Z`: Last daily workflow that performed the real SEO pull and uploaded an artifact.
- `2026-07-13T16:33:09Z`: First daily run in the current five-day no-op sequence; preflight and upload skipped.
- `2026-07-13T16:35:24Z`: Weekly pull also gate-skipped.
- `2026-07-15T00:39:59Z`: Ahrefs first recorded the SmartBizTools referring domain.
- `2026-07-17T15:13:00Z`: Daily workflow started after the accepted Pacific hour, concluded green, and skipped every SEO data step.
- `2026-07-17T22:58:15Z`: Fresh Search Console export generated locally through July 16.
- `2026-07-17T23:17:46Z` to `2026-07-17T23:21:55Z`: Live Ahrefs, Search Console page-query, GA4, Gmail, GitHub, and public-page checks completed.

## Root Cause Hypotheses

### Confirmed causes

1. The green-without-data condition is caused by exact-hour runtime gates combined with delayed GitHub schedule starts. The workflows intentionally return success after setting their run output false.
2. SEO AI Ops has never run on `main` because its workflow file exists only in open PR #15's branch.
3. The backlink count is inflated by a coordinated low-quality `.shop` link cluster. The link attributes, domains, anchors, and Ahrefs spam flags independently support this classification.
4. Outreach produced a live SmartBizTools citation but no confirmed authoritative editorial link. The repo tracker, mailbox, live pages, and Ahrefs inventory agree.

### Plausible but unproven explanations

1. Ahrefs may not have crawled or selected the dedicated SmartBizTools profile as its representative link, which could explain the mismatch between live profile HTML and Ahrefs' zero dofollow count.
2. The aggregate Search Console average-position decline likely reflects query-mix expansion more than loss on established queries. The overlapping-query cohort supports this, but changing country/device mix may also contribute.
3. Multiple pages serving the same intent may be diluting rankings: `/best/seo-prompts/` and `/prompts/for/seo/` both appear for `best seo prompts`, while `/prompts/cursor/coding/` and `/tools/cursor/` both appear for Cursor prompt queries.

## Evidence Gaps

- Current Google-recognized external-link data requires manual Search Console Links-report inspection.
- Current AI Directory review state requires a successful authenticated or non-rate-limited status-page check.
- AI Valley X replies and AI Tools Up form-platform replies were outside the connected Gmail evidence surface.
- A new full Ahrefs Site Audit crawl is needed after the weekly workflow is repaired.
- The AI Ops workflow needs one real default-branch execution before its artifact selection and Anthropic generation path can be considered production-verified.

## Recommended Next Action

1. Replace strict Pacific-hour gates in daily, weekly, and monthly workflows with schedule-identity selection: manual dispatches always run, and scheduled jobs choose the PDT or PST cron from `github.event.schedule` without depending on the hour GitHub actually starts the job.
2. Merge the hardened PR #15 stack, then confirm a real daily artifact and a real AI Ops artifact rather than relying on top-level green conclusions.
3. Reprioritize SEO work toward `/best/gemini-prompts/`, then `/best/stable-diffusion-prompts/` and the Cursor prompt cluster. Clarify the intended query role and internal-link ownership of overlapping SEO and Cursor pages.
4. Update the outreach tracker with the verified SmartBizTools link attributes, the absent substantive replies, and overdue follow-ups. Add editorial prospect buckets for Gemini/Google AI, Stable Diffusion/AI art, Cursor/developer communities, and small-business/SEO publications.
5. Stop treating raw directory counts as campaign success. Measure new links by editorial relevance, explicit link qualification, source quality, and target-page fit.

## Sources Checked

- `output/seo/2026-07-17/gsc-pages.json`
- `output/seo/2026-07-17/gsc-queries.json`
- GitHub Actions runs `29197198985`, `29266875940`, `29267027185`, `29345035508`, `29428030675`, `29512022536`, and `29591195075`
- GitHub Actions artifact inventory and active workflow list for `Roshawn22/AIPromptIndex.io`
- GitHub PR #15 metadata, commit list, merge state, and CI status
- Live Ahrefs API v3 endpoints: `domain-rating`, `backlinks-stats`, `refdomains`, `all-backlinks`, and `organic-keywords`
- July 12 daily artifact: Ahrefs overview, Rank Tracker, Site Audit, Brand Radar, GA4, Search Console, and setup verification
- Live Search Console API page-query exports for June 19-July 16 and May 22-June 18
- Live GA4 Data API organic-search reports for the same windows
- Connected Gmail mailbox searches for Applied AI Tools, AIToolSync, AI Tools Up, StructPrompt, AI Directory, SmartBizTools, and FindAIDir
- `docs/link-building-prospect-list-and-drafts.md`
- Live SmartBizTools directory hub and dedicated AI Prompt Index profile HTML
- Live AIPromptIndex `robots.txt`, sitemap index, homepage, Gemini prompts page, and SEO prompts page
- `.github/workflows/seo-data-pull.yml`
- `.github/workflows/seo-weekly.yml`
- `.github/workflows/seo-monthly.yml`
- `.github/workflows/seo-ai-ops.yml`
