# aitoolindex.io thin-content / scaled-page audit

- Live host: `https://aitoolindex.io`
- Checked: `2026-09-02`
- Scope: public sitemap + sampled HTML. This repo is AIPromptIndex.io and **cannot change** aitoolindex.io.
- Confidence: high for URL inventory and template overlap on sampled pages; medium for Google’s current classification (no Search Console for that property in this workspace).

## Finding

Google’s live risk on aitoolindex.io is **scaled / templated pages**, not cloaking, watermarks, or a 10k doorway mill.

The sitemap is small: **234 URLs** in `https://aitoolindex.io/sitemap-0.xml` (index lastmod `2026-09-02T23:34:08.923Z`). That is not an auto-generated city×keyword explosion. The problem is a handful of **page types that share chrome, section order, and reviewer boilerplate**, with industry nouns swapped.

July AIPromptIndex forensic constraint still applies to the sister site: impressions can grow from more URLs while authority does not, if Google treats the extra URLs as scaled helpful-content.

## Inventory (live sitemap)

| First segment | URL count | Sampled body size | Scaled-content risk |
|---|---:|---|---|
| `/tools` | 83 | Reviews ~1,170–1,370 words | Lower. Unique pricing tables and scores. Shared benchmark chrome. |
| `/blog` | 28 | Sample 723–1,246 words | Lower if posts stay editorial. |
| `/compare` | 27 | Hub 1,463 words; **leaf pages ~400–490 words** | **High.** Thin side-by-side widgets. |
| `/category` | 25 | ~644–954 words | Medium. Listing hubs with a snapshot blurb. |
| `/ai-for` | 21 | Hub 731; industry leaves **~950–1,250 words** | **Highest.** Trade pages share structure; HVAC/plumbing/roofing/landscaping token Jaccard **0.51–0.57**. |
| `/answers` | 13 | ~400 words | Medium. Short unique answers, same page shell. |
| `/alternatives` | 9 | Hub 212; leaves ~730–800 | Medium. Shared “how alternatives split the job” copy. |
| `/calculators` | 7 | not fully sampled | Watch. |
| `/guides` | 6 | ~400–470 | Lower volume, still short. |
| Other singles | about 15 | mixed | Low. |

`/category` hub URL `https://aitoolindex.io/category` returns **404** while `/category/ai-chatbots` etc. are indexed in the sitemap. That is a crawl/IA bug, not a content-quality bug.

## What looks scaled

### 1. `/ai-for/{industry}` (do this first)

Sampled HVAC, plumbing, roofing, landscaping, law firms, accounting, YouTubers.

Unique work exists: the first ~150–200 words are industry-specific (seasonal HVAC demand vs emergency plumbing vs YouTube production). That is not spin-the-noun garbage.

The scaled part is everything around it:

- Same reviewer block on every page: *“I build AI intake systems and cold outreach automation for service businesses — 38%+ reply rates…”* plus the same stack line (`n8n, Apollo, Apify, Instantly, HubSpot`).
- Same “next-step routes” sentences on trade pages (automation roundup, calculator, Zapier workflow guide).
- Same tool names repeated as the default stack: ChatGPT + Zapier + Notion/Jasper across unrelated trades.
- Titles still say **(2025)** on HVAC, plumbing, landscaping, law, accounting, YouTubers while roofing already says **(2026)**. Stale year tokens on a template family is a cheap quality signal.

YouTubers is the control: Jaccard vs HVAC is **0.28**, so the template *can* diverge. The trades cluster is the Google risk.

**Do not add more `/ai-for` trades until the existing 20 leaves have unique proof** (named workflows, different tool stacks, original quotes or screenshots, 2026 titles).

### 2. `/compare/{a}-vs-{b}` leaves

The compare **hub** is a real page. The leaves (`abridge-vs-suki`, `canva-vs-uizard`, `chatgpt-vs-claude`, `chatgpt-vs-gemini`) sit around **400 words** after chrome. Shared leftover FAQ/article chips appear across leaves.

These read as **feature-table doorways**. If they are not already sending clicks, they are the cleanest noindex / consolidate / merge-into-hub candidates.

### 3. `/answers/*`

About **400 words**, unique short answer, dated Apr 4, 2026 on the coding sample. Less dangerous than `/ai-for`, but the pattern is still “one URL per question” with a thin body. Cap growth. Do not generate an answers page for every tool FAQ.

### 4. `/alternatives/{tool}`

Leaves are longer (~750 words) and name real competing tools. Shared section headings are fine. The risk is only if more alternatives pages are generated from the same three sentences plus a tool list.

## What is not the problem

- Not a watermark / C2PA / hidden-text issue on the sampled HTML.
- Not a 10,000-URL affiliate doorway.
- `/tools/{slug}` reviews are the strongest unique pages (pricing rows differ; ChatGPT vs Claude are not the same article).
- Blog/guide volume is small.

## Highest-leverage moves (on aitoolindex.io, not this repo)

1. **Stop publishing new `/ai-for` and `/compare` leaves.**
2. **Rewrite or merge the trades cluster** (HVAC, plumbing, roofing, landscaping, general contracting). Give each a different primary workflow and tool stack. Strip identical “next-step route” paragraphs or make them one shared component that is not the majority of the extractable text.
3. **Update leftover 2025 titles** on `/ai-for/*`.
4. **Decide a rule for compare leaves:** keep only pairs that have a unique verdict and table; `noindex` or 301 the rest into `/compare/`.
5. **Fix `/category` 404** or remove it from internal links.
6. **Do not chase spam `.shop` backlinks** here either. Same as AIPromptIndex: a few real citations beat a larger junk graph.

## How this interacts with AIPromptIndex

Do not clone `/ai-for` or `/compare` patterns onto aipromptindex.io. The ranking work in this PR is the opposite: unique sections, related links, and on-page prompt excerpts on four pages that already rank near page one.

If both sites keep shipping templated leaves, Google can treat the brand as a scaled-content publisher even when AIPromptIndex itself is smaller.
