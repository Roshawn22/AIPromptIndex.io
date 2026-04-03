# Programmatic SEO Pages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 50+ keyword-targeted landing pages and ~50 niche prompts to take the site from 149 to ~250 indexable pages, targeting easy-win SEO keywords (KD 0-10).

**Architecture:** Data-driven config files (JSON) drive page generation via Astro's `getStaticPaths()`. Three tiers: tool×category combos, industry/audience pages, and expanded best-of pages. Each page has unique intro, FAQs, tips, and filtered prompts.

**Tech Stack:** Astro 5 static site generation, existing PromptCard/Breadcrumb/NewsletterSignup components, JSON config files, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-02-programmatic-seo-pages-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/data/seo/tool-category-pages.json` | Tier 1 config: ~25 tool×category combos with intros, FAQs, tips |
| `src/data/seo/audience-pages.json` | Tier 2 config: ~15 industry/audience pages with intros, FAQs, tips |
| `src/data/seo/bestof-pages.json` | Tier 3 config: migrated 8 existing + ~10 new best-of entries |
| `src/pages/prompts/[tool]/[category].astro` | Tier 1 page template |
| `src/pages/prompts/for/[slug].astro` | Tier 2 page template |
| ~50 files in `src/data/prompts/*.json` | Niche gap-filling prompts |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/types.ts` | Add SEO page config interfaces |
| `src/pages/best/[slug].astro` | Read from bestof-pages.json; add conditional FAQ/tips sections |
| `src/pages/prompts/[slug].astro` | Add "Also featured in:" cross-links |
| `src/pages/index.astro` | Add "Popular Collections" section |
| `src/components/global/Footer.astro` | Add keyword page links |
| `src/pages/search-index.json.ts` | Include new collection pages |

---

## Chunk 1: Foundation (Types + Config Data)

### Task 1: Add TypeScript interfaces for SEO page configs

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add SEO page interfaces to types.ts**

Add after the existing `SearchItem` interface at the bottom of the file:

```typescript
export interface SEOPageConfig {
  title: string;
  metaTitle: string;
  metaDescription: string;
  keyword: string;
  intro: string;
  tips: string[];
  faqs: Array<{ q: string; a: string }>;
}

export interface ToolCategoryPage extends SEOPageConfig {
  tool: string;
  category: string;
}

export interface AudiencePage extends SEOPageConfig {
  audience: string;
  slug: string;
  filterTags: string[];
  filterCategories: string[];
}

export interface BestOfPage {
  slug: string;
  title: string;
  description: string;
  filter: { tool?: string; category?: string; tags?: string[] };
  metaTitle?: string;
  metaDescription?: string;
  keyword?: string;
  intro?: string;
  tips?: string[];
  faqs?: Array<{ q: string; a: string }>;
}
```

Also update the `SearchItem` type to include `'collection'`:
```typescript
export interface SearchItem {
  name: string;
  description: string;
  url: string;
  type: 'prompt' | 'guide' | 'blog' | 'collection';
  category?: string;
  tags?: string[];
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: passes (type-only changes, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add SEO page config TypeScript interfaces"
```

### Task 2: Create Tier 1 config — tool-category-pages.json

**Files:**
- Create: `src/data/seo/tool-category-pages.json`

This is the largest content generation task. Each entry needs a unique intro (80-120 words), 3 tips, and 3 FAQs.

- [ ] **Step 1: Create the directory and config file**

Create `src/data/seo/tool-category-pages.json` with ~25 entries. Generate entries for every tool×category combination where 3+ prompts currently exist. Each entry must have:
- `tool`: tool slug (chatgpt, claude, gemini, midjourney, dall-e, stable-diffusion, cursor, github-copilot)
- `category`: category slug (writing, coding, marketing, image-generation, business, data-analysis, education, creative)
- `title`: "Best {Tool} Prompts for {Category}"
- `metaTitle`: "{N} Best {Tool} {Category} Prompts (2026) — Copy & Paste"
- `metaDescription`: ~150 chars, keyword-rich, unique per page
- `keyword`: the target search term
- `intro`: 80-120 words, unique, keyword-rich
- `tips`: 3 actionable tips contextual to this tool+category combo
- `faqs`: 3 Q&A pairs targeting related long-tail queries

Check prompt counts first by reading `src/data/prompts/` and counting by tool+category. Only include combos with 3+ prompts.

**Parallelizable:** This content generation can be done by a subagent. Provide it the list of tool IDs, category IDs, and the template above.

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "require('./src/data/seo/tool-category-pages.json'); console.log('Valid JSON')"`

- [ ] **Step 3: Commit**

```bash
git add src/data/seo/tool-category-pages.json
git commit -m "feat: add Tier 1 tool-category SEO page configs"
```

### Task 3: Create Tier 2 config — audience-pages.json

**Files:**
- Create: `src/data/seo/audience-pages.json`

- [ ] **Step 1: Create the config file**

Create `src/data/seo/audience-pages.json` with ~15 entries for these audiences:
teachers, students, real-estate, small-business, content-creators, seo, developers, freelancers, marketers, entrepreneurs, designers, data-analysts, product-managers, hr-professionals, sales-professionals

Each entry must have: audience, slug, title, metaTitle, metaDescription, keyword, filterTags (array of prompt tags to match), filterCategories (array of categories to match), intro (80-120 words), tips (3), faqs (3 Q&A pairs).

**Parallelizable:** Subagent can generate this.

- [ ] **Step 2: Verify JSON is valid**
- [ ] **Step 3: Commit**

```bash
git add src/data/seo/audience-pages.json
git commit -m "feat: add Tier 2 audience SEO page configs"
```

### Task 4: Create Tier 3 config — bestof-pages.json (migrate existing + add new)

**Files:**
- Create: `src/data/seo/bestof-pages.json`

- [ ] **Step 1: Create the config file**

Migrate the 8 existing roundup entries from the hardcoded array in `src/pages/best/[slug].astro` (lines 12-21) into this JSON file. Keep their existing format (slug, title, description, filter). Then add ~10 new entries with the richer format (metaTitle, metaDescription, keyword, intro, tips, faqs):

New entries to add:
- `prompt-templates` — keyword: "prompt templates" (KD 1, vol 200)
- `chatgpt-prompt-examples` — keyword: "chatgpt prompt examples" (KD 8, vol 300)
- `chatgpt-cover-letter-prompts` — keyword: "chatgpt prompt for cover letter" (KD 0, vol 70)
- `best-ai-prompts` — keyword: "best ai prompts" (KD 11, vol 700)
- `free-ai-prompts` — keyword: "free ai prompts" (KD 48, vol 200)
- `stable-diffusion-prompts` — keyword: "stable diffusion prompts" (KD ~10)
- `dall-e-art-prompts` — keyword: "dall-e prompts" (KD 3, vol 150, 96K traffic potential!)
- `gemini-prompts` — keyword: "gemini prompts"
- `cursor-ai-prompts` — keyword: "cursor ai prompts" (vol 60)
- `copilot-prompts` — keyword: "github copilot prompts" (KD 27, vol 150)

- [ ] **Step 2: Verify JSON is valid**
- [ ] **Step 3: Commit**

```bash
git add src/data/seo/bestof-pages.json
git commit -m "feat: add Tier 3 best-of SEO page configs"
```

---

## Chunk 2: Niche Prompts (~50 new prompt JSON files)

### Task 5: Generate ~50 niche prompts to fill content gaps

**Files:**
- Create: ~50 files in `src/data/prompts/`

**Parallelizable:** Split into 5 subagents, ~10 prompts each, targeting different niches.

Batch 1 (~10): Real estate (4) + SEO/content marketing (4) + cover letter/resume (2)
Batch 2 (~10): Teachers/education niche (4) + students/study (3) + freelancers (3)
Batch 3 (~10): Small business (4) + content creators (3) + entrepreneurs (3)
Batch 4 (~10): Stable Diffusion (4) + DALL-E (4) + Midjourney (2)
Batch 5 (~10): Cursor (4) + GitHub Copilot (4) + data viz (2)

Each prompt must follow the exact JSON schema in `src/data/prompts/react-component-generator.json`:
- All required fields: title, slug, promptText (100-300 words with [VARIABLE] placeholders), description (100-200 words), tool, category, tags (3-5), difficulty, promptType, variables (2-4), tips (3+), isFeatured (false for all), dateAdded ("2026-04-02"), metaTitle, metaDescription
- Include exampleOutput for each
- Slugs must be unique and not match any tool id (chatgpt, claude, gemini, midjourney, dall-e, stable-diffusion, cursor, github-copilot)

- [ ] **Step 1: Generate all 5 batches (parallel)**
- [ ] **Step 2: Verify all JSON files are valid**

Run: `node -e "const fs=require('fs');const d='src/data/prompts';const f=fs.readdirSync(d).filter(x=>x.endsWith('.json'));console.log(f.length+' prompts');f.forEach(x=>JSON.parse(fs.readFileSync(d+'/'+x)))"`

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: ~200+ pages built

- [ ] **Step 4: Commit**

```bash
git add src/data/prompts/
git commit -m "feat: add 50 niche prompts for SEO keyword coverage"
```

---

## Chunk 3: Page Templates (Tier 1 + Tier 2 + Tier 3 refactor)

### Task 6: Create Tier 1 page template — [tool]/[category].astro

**Files:**
- Create: `src/pages/prompts/[tool]/[category].astro`

- [ ] **Step 1: Create the template**

Read `src/pages/best/[slug].astro` for the existing pattern. The Tier 1 template follows the same structure but:
- Imports `toolCategoryPages` from `src/data/seo/tool-category-pages.json`
- `getStaticPaths()` filters entries to only include combos with 3+ matching prompts
- Filters prompts where `p.data.tool === tool AND p.data.category === category`
- Renders: Breadcrumb (Home > Prompts > {title}), hero with title + count + intro, prompt grid with PromptCards, tips section, FAQ section with JSON-LD FAQPage, related collections, newsletter CTA
- Includes JSON-LD ItemList structured data
- Uses `TOOL_DISPLAY_NAMES` and `CATEGORY_DISPLAY_NAMES` from `src/lib/constants.ts`
- Conditionally renders tips and FAQ sections (only when present in config)

Also add a build-time validation: assert no prompt slug matches any tool id.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: New pages at `/prompts/chatgpt/marketing/`, `/prompts/claude/writing/`, etc.

- [ ] **Step 3: Commit**

```bash
git add src/pages/prompts/[tool]/[category].astro
git commit -m "feat: add Tier 1 tool x category programmatic pages"
```

### Task 7: Create Tier 2 page template — for/[slug].astro

**Files:**
- Create: `src/pages/prompts/for/[slug].astro`

- [ ] **Step 1: Create the template**

Similar to Tier 1 but with audience-based filtering:
- Imports `audiencePages` from `src/data/seo/audience-pages.json`
- `getStaticPaths()` filters entries to only include audiences with 3+ matching prompts
- Filtering logic: prompt matches if `category in filterCategories OR any tag in filterTags` (OR logic, ANY match)
- Breadcrumb: Home > Prompts > For {Audience}
- Same template structure: hero, prompts, tips, FAQs, related, newsletter

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: New pages at `/prompts/for/teachers/`, `/prompts/for/students/`, etc.

- [ ] **Step 3: Commit**

```bash
git add src/pages/prompts/for/[slug].astro
git commit -m "feat: add Tier 2 audience programmatic pages"
```

### Task 8: Refactor Tier 3 — best/[slug].astro to use JSON config

**Files:**
- Modify: `src/pages/best/[slug].astro`

- [ ] **Step 1: Refactor to read from bestof-pages.json**

Replace the hardcoded `roundups` array (lines 12-21) with:
```javascript
import bestofPages from '../../data/seo/bestof-pages.json';
```

Update `getStaticPaths()` to use `bestofPages` instead of `roundups`. Filter out entries with <3 matching prompts.

Add conditional rendering for the new fields: if `intro` exists, render it. If `faqs` exists, render FAQ section with FAQPage JSON-LD. If `tips` exists, render tips section.

The existing 8 entries (which lack intro/faqs/tips) continue to work as before — the template gracefully handles missing optional fields.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Existing 8 best-of pages still work + new Tier 3 pages appear

- [ ] **Step 3: Commit**

```bash
git add src/pages/best/[slug].astro src/data/seo/bestof-pages.json
git commit -m "refactor: migrate best-of config to JSON, add Tier 3 entries"
```

---

## Chunk 4: Internal Linking + Homepage + Footer

### Task 9: Add "Also featured in:" cross-links to prompt detail pages

**Files:**
- Modify: `src/pages/prompts/[slug].astro`

- [ ] **Step 1: Add cross-links section**

Import all three config files. For the current prompt, find all keyword pages that would include it (by matching tool+category for Tier 1, tags/categories for Tier 2, filter for Tier 3). Render a section after related prompts:

```html
<!-- Also featured in -->
{collections.length > 0 && (
  <div class="mt-8">
    <h3>Also featured in</h3>
    <div class="flex flex-wrap gap-2">
      {collections.map(c => <a href={c.url}><Badge>{c.title}</Badge></a>)}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify build + check a prompt page**
- [ ] **Step 3: Commit**

```bash
git add src/pages/prompts/[slug].astro
git commit -m "feat: add 'Also featured in' cross-links on prompt pages"
```

### Task 10: Add "Popular Collections" to homepage

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Add section between Latest Prompts and cross-promo**

Import `toolCategoryPages` and `audiencePages`. Pick the top 6 entries by keyword volume (hardcode the selection since we know the data). Render as a grid of linked cards.

- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add Popular Collections section to homepage"
```

### Task 11: Add keyword page links to footer

**Files:**
- Modify: `src/components/global/Footer.astro`

- [ ] **Step 1: Add links to the Best Prompts column**

Add links to the top keyword pages: ChatGPT Marketing Prompts, AI Prompts for Teachers, DALL-E Prompts, Prompt Templates, etc.

- [ ] **Step 2: Commit**

```bash
git add src/components/global/Footer.astro
git commit -m "feat: add keyword page links to footer"
```

### Task 12: Update search index to include collection pages

**Files:**
- Modify: `src/pages/search-index.json.ts`

- [ ] **Step 1: Add collection pages to search index**

Import all three config files. Add entries with type `'collection'` for each keyword page (title, description/metaDescription, url, type).

- [ ] **Step 2: Verify build + check /search-index.json**
- [ ] **Step 3: Commit**

```bash
git add src/pages/search-index.json.ts
git commit -m "feat: include collection pages in search index"
```

---

## Chunk 5: Final Verification + Deploy

### Task 13: Full build verification

- [ ] **Step 1: Run build and count pages**

Run: `npm run build`
Expected: ~250 pages in <3s

- [ ] **Step 2: Verify page counts by tier**

```bash
# Count Tier 1 pages
ls dist/prompts/chatgpt/ dist/prompts/claude/ dist/prompts/gemini/ 2>/dev/null | wc -l

# Count Tier 2 pages
ls dist/prompts/for/ 2>/dev/null | wc -l

# Count Tier 3 pages (best-of)
ls dist/best/ 2>/dev/null | wc -l
```

- [ ] **Step 3: Spot-check unique content**

Read 3 random pages and verify each has unique title, meta description, intro paragraph, and FAQs:
```bash
head -30 dist/prompts/chatgpt/marketing/index.html
head -30 dist/prompts/for/teachers/index.html
head -30 dist/best/prompt-templates/index.html
```

- [ ] **Step 4: Verify JSON-LD**

Check that ItemList and FAQPage structured data appear in the HTML:
```bash
grep -c 'FAQPage' dist/prompts/chatgpt/marketing/index.html
grep -c 'ItemList' dist/prompts/chatgpt/marketing/index.html
```

- [ ] **Step 5: Verify sitemap includes new pages**

```bash
grep -c 'prompts/chatgpt/marketing' dist/sitemap-0.xml
grep -c 'prompts/for/teachers' dist/sitemap-0.xml
grep -c 'best/prompt-templates' dist/sitemap-0.xml
```

### Task 14: Deploy and push

- [ ] **Step 1: Deploy to Vercel**

Run: `npx vercel --prod --yes`

- [ ] **Step 2: Push to GitHub**

Run: `git push origin main`

- [ ] **Step 3: Verify live site**

Check: `https://aipromptindex.io/prompts/chatgpt/marketing/` loads correctly
Check: `https://aipromptindex.io/prompts/for/teachers/` loads correctly
Check: `https://aipromptindex.io/best/prompt-templates/` loads correctly

---

## Parallelization Map

| Task | Depends On | Parallelizable With |
|------|-----------|-------------------|
| Task 1 (types) | — | — |
| Task 2 (Tier 1 config) | — | Tasks 3, 4, 5 |
| Task 3 (Tier 2 config) | — | Tasks 2, 4, 5 |
| Task 4 (Tier 3 config) | — | Tasks 2, 3, 5 |
| Task 5 (50 prompts) | — | Tasks 2, 3, 4 |
| Task 6 (Tier 1 template) | Tasks 1, 2, 5 | Task 7 |
| Task 7 (Tier 2 template) | Tasks 1, 3, 5 | Task 6 |
| Task 8 (Tier 3 refactor) | Task 4 | — |
| Task 9 (cross-links) | Tasks 2, 3, 4 | Tasks 10, 11, 12 |
| Task 10 (homepage) | Tasks 2, 3 | Tasks 9, 11, 12 |
| Task 11 (footer) | — | Tasks 9, 10, 12 |
| Task 12 (search index) | Tasks 2, 3, 4 | Tasks 9, 10, 11 |
| Task 13 (verify) | All above | — |
| Task 14 (deploy) | Task 13 | — |

**Optimal execution:** Tasks 1-5 in parallel → Tasks 6-8 in parallel → Tasks 9-12 in parallel → Task 13 → Task 14
