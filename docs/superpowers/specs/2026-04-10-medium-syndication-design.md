# Medium Syndication Pipeline — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Scope:** AIPromptIndex.io → Medium content syndication with AI-powered rewrites

## Overview

Automated pipeline that syndicates blog posts and guides from AIPromptIndex.io to Medium. Each post is rewritten by Claude Opus 4.6 for Medium's audience, published via the Medium API with canonical links pointing back to AIPromptIndex.io, and tracked in frontmatter to prevent re-publishing. Runs daily in the existing SEO GitHub Actions pipeline.

## 1. Content Schema Changes

**File:** `src/content.config.ts`

Add two optional fields to both `blog` and `guides` Zod schemas:

```typescript
syndicate: z.array(z.string()).default([]),
mediumUrl: z.string().optional(),
```

- **`syndicate`** — String array. Include `"medium"` to mark a post for Medium syndication. Extensible for future platforms (e.g., `"dev.to"`, `"hashnode"`).
- **`mediumUrl`** — Auto-populated by the script after successful publish. Posts with a non-empty `mediumUrl` are skipped on subsequent runs.

**Example frontmatter after the change:**

```yaml
---
title: "25 Best ChatGPT Prompts for 2026"
description: "Discover the 25 best ChatGPT prompts..."
author: "Roshawn Franklin"
pubDate: 2026-04-02
category: "prompts"
tags: ["chatgpt", "prompts", "productivity", "ai-tools"]
draft: false
syndicate:
  - medium
mediumUrl: ""
---
```

## 2. Syndication Script

**New file:** `scripts/seo/syndicate-medium.mjs`

### Pipeline per post

1. **Load** — Scan `src/data/blog/*.md` and `src/data/guides/*.md`. Parse frontmatter with a lightweight parser (gray-matter style regex, no external dependency needed — follow `_shared.mjs` patterns).
2. **Filter** — Select posts where `syndicate` includes `"medium"`, `draft` is not `true`, and `mediumUrl` is empty or absent.
3. **AI Rewrite** — Send the original markdown to Claude Opus 4.6 via the Anthropic API (model: `claude-opus-4-20250514` or latest available opus model) with a system prompt that:
   - Rewrites for Medium's audience (conversational tone, stronger opening hook)
   - Adds an engaging Medium-specific intro paragraph
   - Adds an outro with CTA linking back to AIPromptIndex.io
   - Embeds at least 2 contextual backlinks to AIPromptIndex.io within the body
   - Formats for Medium (shorter paragraphs, subheadings, pull quotes)
   - Preserves all technical accuracy and keyword targeting from the original
   - Never removes or weakens the canonical relationship
4. **Convert** — Render the rewritten markdown to HTML using `marked` (add as a dependency).
5. **Resolve User ID** — Call `GET https://api.medium.com/v1/me` to get the authenticated user's ID (cache for the session).
6. **Publish** — Call `POST https://api.medium.com/v1/users/{userId}/posts` with:
   - `title` — from frontmatter
   - `contentFormat: "html"`
   - `content` — the rewritten HTML body
   - `canonicalUrl` — `https://aipromptindex.io/blog/{slug}/` or `https://aipromptindex.io/guides/{slug}/`
   - `tags` — first 5 from frontmatter (Medium's limit)
   - `publishStatus: "public"`
7. **Track** — On success:
   - Write the returned Medium URL back into the source markdown file's frontmatter (`mediumUrl` field)
   - Log the result to `output/seo/{date}/medium-syndication.json`
8. **Continue on error** — If a single post fails (API error, AI rewrite failure), log the error and move to the next post. Do not exit the script.

### AI Rewrite System Prompt

```
You are a content adapter for Medium. Rewrite the following blog post for Medium's audience.

Guidelines:
- Write a new, attention-grabbing opening hook (1-2 sentences) that draws readers in
- Use a conversational, first-person-friendly tone natural to Medium
- Break into shorter paragraphs (2-3 sentences max)
- Use subheadings (##) every 3-4 paragraphs
- Include at least 2 natural, contextual links to https://aipromptindex.io within the body
- Add a closing section with a CTA directing readers to AIPromptIndex.io
- Preserve all technical accuracy, examples, and code snippets from the original
- Preserve the original keyword targeting and SEO-relevant phrases
- Keep the title the same or very similar for brand recognition
- Output valid markdown
```

### Output File

`output/seo/{YYYY-MM-DD}/medium-syndication.json`:

```json
{
  "generatedAt": "2026-04-10T14:00:00.000Z",
  "published": [
    {
      "slug": "best-chatgpt-prompts-2026",
      "collection": "blog",
      "mediumUrl": "https://medium.com/@user/best-chatgpt-prompts-2026-abc123",
      "canonicalUrl": "https://aipromptindex.io/blog/best-chatgpt-prompts-2026/"
    }
  ],
  "skipped": ["chatgpt-vs-claude-prompting-differences"],
  "errors": []
}
```

## 3. Environment Variables

| Variable | Purpose | Location |
|----------|---------|----------|
| `MEDIUM_API_TOKEN` | Medium API integration token | `.env` locally, GitHub Secrets for CI |
| `ANTHROPIC_API_KEY` | Claude Opus 4.6 API for rewrites | `.env` locally, GitHub Secrets for CI |

Add both to `.env.example` with empty values as documentation.

## 4. npm Scripts

Add to `package.json`:

```json
"syndicate:medium": "node scripts/seo/syndicate-medium.mjs"
```

Append syndication to the existing `seo:pull:all` script by adding `&& npm run syndicate:medium` at the end of the chain.

## 5. GitHub Actions Integration

**File:** `.github/workflows/seo-data-pull.yml`

### Permission change

```yaml
permissions:
  contents: write   # was: read — needed for frontmatter commit-back
  issues: write
```

### New step (after "Generate SEO brief", before "Upload SEO output")

```yaml
- name: Syndicate new content to Medium
  if: steps.gate.outputs.run_pull == 'true'
  env:
    MEDIUM_API_TOKEN: ${{ secrets.MEDIUM_API_TOKEN }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npm run syndicate:medium
  continue-on-error: true

- name: Commit syndication updates
  if: steps.gate.outputs.run_pull == 'true'
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    if ! git diff --quiet -- src/data/; then
      git add src/data/
      git commit -m "chore: update mediumUrl after syndication"
      git push
    fi
  continue-on-error: true
```

### Why `continue-on-error`

Medium API failures or AI rewrite failures must not break the SEO data pull pipeline. The syndication step is additive — if it fails, all other SEO data is still collected and uploaded.

## 6. Backlink & SEO Strategy

### Canonical declaration

The `canonicalUrl` parameter in the Medium API request tells search engines that AIPromptIndex.io is the original source. This prevents duplicate content penalties and directs ranking signals to your site.

### In-content backlinks

Every AI-rewritten post includes:
- At least 2 contextual backlinks to AIPromptIndex.io pages within the body
- A footer block:

```markdown
---
*This article was originally published on [AI Prompt Index](https://aipromptindex.io/blog/{slug}/).
Discover thousands of curated AI prompts at [AIPromptIndex.io](https://aipromptindex.io).*
```

### SEO value

- Medium's high domain authority (~95 DR) gives weight to the canonical signal
- The contextual backlinks provide referral traffic even though Medium links are nofollow
- The canonical declaration ensures Google indexes AIPromptIndex.io as the original, not Medium

## 7. Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `@anthropic-ai/sdk` | Claude Opus 4.6 API for content rewrites | `npm install @anthropic-ai/sdk` |
| `marked` | Markdown → HTML conversion for Medium API | `npm install marked` |

## 8. Idempotency & Safety

- Posts with a non-empty `mediumUrl` in frontmatter are always skipped
- The script writes `mediumUrl` back to the source file immediately after successful publish
- If the script crashes mid-run, only unpublished posts (empty `mediumUrl`) will be retried on the next run
- The daily cron runs the script; if there's nothing new to syndicate, it exits cleanly with zero API calls
- Claude API failures for a single post don't block other posts from being processed

## 9. Future Extensibility

The `syndicate` array field supports adding more platforms later:

```yaml
syndicate:
  - medium
  - dev.to
  - hashnode
```

Each platform would get its own script (`syndicate-devto.mjs`, etc.) following the same pattern, or the existing script could be extended with a platform dispatcher. Not in scope for this spec.
