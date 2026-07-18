# Content Brief — GSC Queries Stuck on Page 5+

**Generated:** 2026-04-16
**Source:** GSC pull (last 28d) + site inventory
**Goal:** Move queries getting impressions but ranking 48-95 into the top 20

---

## The numbers

- 20 queries tracked / 48 impressions / 0 clicks (28d)
- 14 queries sit at position 48-95 (page 5-10)
- 4 queries already on page 1 (branded + one long-tail)
- Every stuck query maps to an existing page — this is an **optimization problem, not a greenfield problem**

---

## Priority 1 — The "Prompt Engineering 101" cluster (biggest aggregate opportunity)

**Target page:** `src/data/guides/prompt-engineering-101.md`

| GSC Query | Current Pos | Impressions |
|---|---|---|
| prompt engineering 101 | 75.6 | 7 |
| prompt engineering for beginners | 66.3 | 7 |
| prompt engineering for dummies | 62 | 8 |
| ai prompt engineering for beginners | 61 | 3 |
| prompting 101 | 73 | 1 |
| prompt 101 | 61 | 1 |
| prompt engineering guide | 27 | 1 |
| prompt engineering for content creation | 94 | 1 |

**Why it's underperforming:** the page ranks for its own title at position 75. That's a ranking-signal / authority problem, not a content problem. Google sees the page as relevant but doesn't trust it yet.

**Actions (in order of impact):**

1. **Add H2 sections that exactly match the query variants** — Google's passage indexing rewards literal H2 matches:
   - `## Prompt Engineering 101: What It Means`
   - `## Prompt Engineering for Beginners: Where to Start`
   - `## Prompt Engineering for Dummies (Plain-English Version)`
   - `## Prompting 101: The Basics`
   - `## Prompt Engineering for Content Creation` ← **net-new section** (covers the pos-94 query)

2. **Expand to 3,500+ words** (currently ~2,200). Top-ranking competitors for "prompt engineering 101" average 3,000-4,500 words.

3. **Add a TL;DR box at the top** + a jump-to-section nav. Improves CTR from SERP and time-on-page.

4. **Add FAQ schema** with these exact questions:
   - "What is prompt engineering for beginners?"
   - "How do I start with prompt engineering 101?"
   - "Is prompt engineering the same as prompting 101?"
   - "Can I use prompt engineering for content creation?"

5. **Internal linking hub:** link this guide from every `/blog/*` post and every `/best/*` page that mentions prompts. You currently have 3 blog posts and 18 best-of pages — that's 21+ internal links you can add.

6. **Refresh pub date** to something recent and add an "Updated 2026" signal in metaTitle. Google weights freshness heavily for "101" / guide queries.

---

## Priority 2 — The "Prompt Library" cluster (homepage opportunity)

**Target page:** `/` (homepage) — currently ranking pos 42 for these

| GSC Query | Current Pos | Impressions |
|---|---|---|
| free prompt library | 73.3 | 6 |
| ai prompt library | 83 | 1 |
| ai prompts library | 83 | 1 |
| prompt library ai | 83 | 1 |
| ai prompt catalog | 83 | 2 |
| ai prompt repository | 48 | 1 |

**Why it's underperforming:** the homepage optimizes for "AI prompt library" in title + description but has generic body content. Google can't tell if the homepage is the definitive library page.

**Actions:**

1. **Create a dedicated `/prompt-library` landing page** that 301s don't — leave the homepage alone. Instead, build a keyword-specific landing at `src/pages/prompt-library.astro` that:
   - H1: "The Free AI Prompt Library — 500+ Templates"
   - Lists every prompt grouped by tool (ChatGPT, Claude, Midjourney, etc.)
   - Uses the exact phrases: "free prompt library", "AI prompt repository", "AI prompt catalog" in the first 300 words
   - Pulls from the same prompt JSON data as the homepage

2. **Add a "Library" section to the homepage** with a clear H2 that says "Free AI Prompt Library" and a link to `/prompt-library`. This gives Google a disambiguation signal.

3. **Update `src/data/seo/bestof-pages.json`** to add `free-ai-prompt-library` as a new best-of slug if you prefer to keep everything in the `/best/` namespace.

**Expected impact:** these queries have low individual volume but aggregate to ~12 impressions/month — pushing the cluster to page 1-2 should unlock steady branded-adjacent traffic.

---

## Priority 3 — Cinematic Portrait (easy optimization win)

**Target page:** `/prompts/cinematic-portrait-generator/`

| GSC Query | Current Pos | Impressions |
|---|---|---|
| ai cinematic portrait | 56 | 1 |

The prompt page already ranks pos 11.8 for its exact title but only pos 56 for "ai cinematic portrait" (the query Google actually sees).

**Actions:**
1. Add "AI Cinematic Portrait" as an H2 or alt-title in the prompt JSON description
2. Add use cases: "cinematic portrait photography prompts", "AI-generated cinematic portraits"
3. Cross-link from `/best/midjourney-prompts/`, `/best/image-generation-prompts/`, `/best/dall-e-art-prompts/`

---

## Priority 4 — The Claude Business Plan near-miss

**Target page:** `/prompts/business-plan-executive-summary/`

| GSC Query | Current Pos | Impressions |
|---|---|---|
| prompt claude business plan | 10 | 2 |
| claude business plan prompt | 10 | 1 |

Already at position 10. One nudge and it's on page 1.

**Actions:**
1. Add "Claude Business Plan Prompt" as an explicit H2
2. Add a Claude-specific variant of the prompt (your PromptBuilder supports tool selection)
3. Add internal link from `/prompts/claude/business/` category page and `/best/business-prompts/`

---

## Net-new content (one piece)

**"Prompt Engineering for Content Creation"** — pos 94, 1 imp.
Not covered by any existing page. Write a dedicated piece under `src/data/blog/` or `src/data/guides/`:
- Title: "Prompt Engineering for Content Creation: The 2026 Playbook"
- 2,000+ words
- Covers: blog posts, social copy, email, video scripts, SEO briefs
- Links to relevant existing `/best/writing-prompts/`, `/best/marketing-prompts/`, and the 101 guide

---

## Tracking checklist

After shipping these changes, re-pull GSC in 14 days and watch:

- [ ] Does `prompt engineering 101` cross position 30?
- [ ] Does any "prompt library" variant enter top 50?
- [ ] Does the new "prompt engineering for content creation" page get indexed?
- [ ] Do total 28-day impressions grow past 150? (currently 48)

Next pull: **2026-04-30** (`npm run seo:pull:all`)
