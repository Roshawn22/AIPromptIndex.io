# Programmatic SEO Pages — Design Spec

## Context

AIPromptIndex.io is a curated AI prompt directory with 104 prompts, 149 pages, and 0 organic keywords (brand new domain). Ahrefs keyword research reveals 12+ easy-win keywords (KD 0-10) in the "chatgpt prompts for X" and "best Y prompts" space. The goal is to generate 50+ new programmatic landing pages targeting these keywords, plus ~50 new niche prompts to fill content gaps — taking the site from 149 to ~250 indexable pages.

## Ahrefs Data Summary

| Keyword | Volume | KD | Traffic Potential |
|---------|--------|-----|-------------------|
| prompt templates | 200 | 1 | 350 |
| best midjourney prompts | 150 | 2 | 600 |
| chatgpt prompts for business | 200 | 3 | 350 |
| dall-e prompts | 150 | 3 | 96,000 |
| ai prompts for teachers | 150 | 3 | 800 |
| chatgpt prompts for students | 60 | 4 | 15,000 |
| chatgpt prompts for seo | 100 | 5 | 200 |
| chatgpt prompts for marketing | 200 | 6 | 250 |
| chatgpt prompt examples | 300 | 8 | 2,200 |
| best ai prompts | 700 | 11 | 150 |
| best chatgpt prompts for writing | 200 | 25 | 450 |
| best chatgpt prompts | 1,400 | 45 | 3,300 |
| chatgpt prompt for cover letter | 70 | 0 | 700 |
| chatgpt prompts for real estate | 20 | 0 | 10 |

## Architecture

### Three Page Tiers

**Tier 1 — Tool x Category Pages (~25 pages)**
Route: `/prompts/[tool]/[category]/`
Example: `/prompts/chatgpt/marketing/`
Filter: Prompts matching both the tool AND category.
Target keywords: "chatgpt prompts for marketing", "claude writing prompts", etc.

**Tier 2 — Industry/Audience Pages (~15 pages)**
Route: `/prompts/for/[audience]/`
Example: `/prompts/for/teachers/`
Filter: Prompts matching tags or categories relevant to the audience.
Target keywords: "ai prompts for teachers", "chatgpt prompts for students", etc.

**Tier 3 — Expanded Best-of Pages (~10 pages)**
Route: `/best/[slug]/` (extends existing best-of system)
Example: `/best/prompt-templates/`, `/best/chatgpt-prompt-examples/`
Filter: Various — by tool, category, tags, or curated lists.
Target keywords: "prompt templates" (KD 1), "chatgpt prompt examples" (KD 8), etc.

### Routing Constraints

**Critical:** No prompt slug may collide with a tool name. The Tier 1 route `/prompts/[tool]/[category]/` sits alongside `/prompts/[slug]/`. Astro resolves these correctly (one-segment vs two-segment), but if a prompt ever had slug `chatgpt`, it would conflict with the `/prompts/chatgpt/` directory. Current prompts are safe (all slugs are multi-word kebab-case). Add a build-time validation check: assert no prompt slug matches any tool id.

### Minimum Prompt Threshold

A keyword page is only generated if **3+ prompts** match its filters. Pages with fewer prompts are too thin for Google and should be skipped. The config files include all potential pages, but `getStaticPaths()` filters out entries with <3 matching prompts at build time.

### Data-Driven Config

All pages are generated from config files — no hardcoded page definitions in Astro templates.

**`src/data/seo/tool-category-pages.json`** — Tier 1 configs:
```json
[
  {
    "tool": "chatgpt",
    "category": "marketing",
    "title": "Best ChatGPT Prompts for Marketing",
    "metaTitle": "15 Best ChatGPT Prompts for Marketing (2026) — Copy & Paste",
    "metaDescription": "Curated ChatGPT marketing prompts for social media, SEO, email campaigns, and ad copy. Ready to copy and paste.",
    "keyword": "chatgpt prompts for marketing",
    "intro": "ChatGPT has become an essential marketing tool...",
    "tips": [
      "Include your brand voice guidelines in the prompt for consistent messaging",
      "Specify your target audience demographics for more relevant output",
      "Ask for multiple variations to A/B test different approaches"
    ],
    "faqs": [
      {
        "q": "What are the best ChatGPT prompts for marketing?",
        "a": "The best ChatGPT marketing prompts include..."
      },
      {
        "q": "How do I use ChatGPT for SEO content?",
        "a": "To use ChatGPT for SEO, structure your prompt with..."
      },
      {
        "q": "Can ChatGPT write social media captions?",
        "a": "Yes — provide your brand voice, target platform, and key message..."
      }
    ]
  }
]
```

Note: Tier 1 URL is derived from `tool` + `category` fields (e.g., `/prompts/chatgpt/marketing/`). No separate `slug` field needed.

**`src/data/seo/audience-pages.json`** — Tier 2 configs:
```json
[
  {
    "audience": "teachers",
    "slug": "teachers",
    "title": "AI Prompts for Teachers",
    "metaTitle": "Best AI Prompts for Teachers (2026) — Lesson Plans, Quizzes & More",
    "metaDescription": "Curated AI prompts designed for educators. Create lesson plans, quizzes, rubrics, and learning activities with ChatGPT and Claude.",
    "keyword": "ai prompts for teachers",
    "filterTags": ["education", "lesson-plan", "quiz", "teaching", "tutoring"],
    "filterCategories": ["education"],
    "intro": "AI is transforming the classroom...",
    "tips": ["..."],
    "faqs": [{"q": "...", "a": "..."}]
  }
]
```

**Tier 2 filtering logic:** A prompt matches an audience page if its `category` is in `filterCategories` **OR** any of its `tags` intersect with `filterTags`. This is an OR between categories and tags, and ANY-match within each list. This broad matching ensures enough prompts per page.

**Tier 3 integration:** The existing `src/pages/best/[slug].astro` has a hardcoded roundups array. Refactor this: extract the roundup definitions into `src/data/seo/bestof-pages.json`, then import it in `getStaticPaths()`. Add the new Tier 3 entries (prompt-templates, chatgpt-prompt-examples, etc.) to this same JSON file. The existing 8 entries keep their current format; new Tier 3 entries include the richer format (intro, FAQs, tips). The template renders FAQs/tips sections conditionally — only when present in the config entry.

### TypeScript Types

Add to `src/lib/types.ts`:
```typescript
interface SEOPageConfig {
  title: string;
  metaTitle: string;
  metaDescription: string;
  keyword: string;
  intro: string;
  tips: string[];
  faqs: Array<{ q: string; a: string }>;
}

interface ToolCategoryPage extends SEOPageConfig {
  tool: string;
  category: string;
}

interface AudiencePage extends SEOPageConfig {
  audience: string;
  slug: string;
  filterTags: string[];
  filterCategories: string[];
}

interface BestOfPage extends SEOPageConfig {
  slug: string;
  filter: { tool?: string; category?: string; tags?: string[] };
}
```

### Related Collections Logic

Each page auto-generates its "Related Collections" links using this logic:
- **Tier 1 (tool x category):** Show other pages with the same tool + other pages with the same category (up to 4 total).
- **Tier 2 (audience):** Show the Tier 1 pages whose tool/category overlap with the audience's filterCategories (up to 4).
- **Tier 3 (best-of):** Show 2 related Tier 1 pages + 2 related Tier 2 pages based on filter overlap.

No `relatedSlugs` field needed — relations are computed at build time from the config data.

### Canonical URLs

Every page self-canonicalizes: `<link rel="canonical" href="https://aipromptindex.io{currentPath}" />`. The existing `BaseLayout.astro` already handles this via the `Astro.url` pattern. No duplicate content risk since each page has a unique URL and unique intro/FAQ content.

### Page Template Structure

Every programmatic page renders this layout (shared template, unique content):

```
[BaseLayout with SEO meta]
  [Header]
  [Breadcrumb: Home > Prompts > {Title}]

  [Hero Section]
    <h1>{title}</h1>
    <p class="stats">{count} curated prompts</p>
    <p class="intro">{intro paragraph — unique per page}</p>

  [Prompt Grid]
    Filtered PromptCard components, featured first, then by date
    — NewsletterSignup inserted after 5th prompt

  [Tips Section]
    "How to get the best results" — 3-4 tips, contextual per page

  [FAQ Section]
    3-4 Q&A pairs targeting related long-tail queries
    — FAQPage JSON-LD structured data

  [Related Collections]
    Links to 3-4 related keyword pages

  [NewsletterSignup]

  [Footer]

[JSON-LD: ItemList + FAQPage]
```

### Content Uniqueness Strategy

Each page must be genuinely unique to avoid thin content penalties:
- **Intro paragraph**: 80-120 words, keyword-rich, unique per page. Pre-generated and stored in config.
- **FAQ section**: 3-4 unique Q&A pairs per page. Targets related long-tail queries. FAQPage schema markup.
- **Tips section**: 3-4 contextual tips specific to the tool/category/audience.
- **Filtered prompts**: Different subset of prompts per page (natural uniqueness from filtering).
- **Meta title/description**: Unique, keyword-optimized, include year for freshness signals.

### New Prompts Needed (~50)

Gaps to fill for keyword pages that currently have <3 matching prompts:

| Niche | Prompts Needed | Target Tools |
|-------|---------------|--------------|
| Real estate | 4 | chatgpt, claude |
| SEO/content marketing | 4 | chatgpt, gemini |
| Teachers/education (niche) | 4 | chatgpt, claude, gemini |
| Students/study | 3 | chatgpt, gemini |
| Cover letter/resume | 3 | chatgpt, claude |
| Freelancers | 3 | chatgpt, claude |
| Small business | 4 | chatgpt, claude |
| Content creators | 3 | chatgpt, gemini |
| Entrepreneurs | 3 | chatgpt, claude |
| Data viz/dashboards | 3 | chatgpt, gemini |
| Stable Diffusion (expand) | 4 | stable-diffusion |
| DALL-E (expand) | 4 | dall-e |
| Midjourney (expand) | 4 | midjourney |
| Cursor/Copilot (expand) | 4 | cursor, github-copilot |

### Internal Linking Strategy

- **Keyword pages → Prompt detail pages**: Every prompt in the grid links to its `/prompts/[slug]/` page.
- **Prompt detail pages → Keyword pages**: Add "Also featured in:" section showing which keyword collections include this prompt.
- **Homepage**: Add "Popular Collections" section linking to top 6 keyword pages.
- **Footer**: Add links to highest-volume keyword pages.
- **Best-of index** (`/best/`): Links to all Tier 3 pages.
- **Cross-linking between tiers**: "ChatGPT Marketing Prompts" page links to "For Marketers" page and "Best ChatGPT Prompts" page.

### Files to Create

| File | Purpose |
|------|---------|
| `src/data/seo/tool-category-pages.json` | Tier 1 config (~25 entries with intros, FAQs, tips) |
| `src/data/seo/audience-pages.json` | Tier 2 config (~15 entries with intros, FAQs, tips) |
| `src/data/seo/bestof-pages.json` | Tier 3 config (existing 8 entries migrated + ~10 new) |
| `src/pages/prompts/[tool]/[category].astro` | Tier 1 template |
| `src/pages/prompts/for/[slug].astro` | Tier 2 template |
| ~50 new files in `src/data/prompts/` | Niche gap-filling prompts |

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/best/[slug].astro` | Refactor: read from `bestof-pages.json` instead of hardcoded array; add conditional FAQ/tips sections |
| `src/pages/prompts/[slug].astro` | Add "Also featured in:" cross-links section |
| `src/pages/index.astro` | Add "Popular Collections" section linking top keyword pages |
| `src/components/global/Footer.astro` | Add top keyword page links |
| `src/pages/search-index.json.ts` | Include Tier 1, 2, 3 pages (title, description, url, type: 'collection') |
| `src/lib/types.ts` | Add SEOPageConfig, ToolCategoryPage, AudiencePage, BestOfPage interfaces |
| `astro.config.mjs` | Update sitemap lastmod map to include new routes |
| `public/robots.txt` | Verify no Disallow rules block new routes (likely no changes needed) |

### Build Impact

- Current: 149 pages in 1.4s
- Target: ~250 pages in <3s
- All pages static (no SSR), no new dependencies needed

## Verification

1. `npm run build` passes with ~250 pages in <3s
2. Each Tier 1 page shows only prompts matching both tool AND category
3. Each Tier 2 page shows only prompts matching audience tags/categories
4. Every page has unique `<title>`, `<meta description>`, and intro content
5. JSON-LD ItemList + FAQPage validates on each page
6. "Also featured in:" links appear on prompt detail pages
7. Internal links flow correctly between all three tiers
8. New pages appear in sitemap.xml
9. Homepage "Popular Collections" section renders with real data
10. All new pages accessible via search (Cmd+K)
