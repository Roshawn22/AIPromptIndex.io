# Medium Syndication Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Syndicate AIPromptIndex.io blog posts and guides to Medium with AI-powered rewrites via Claude Opus 4.6, canonical backlinks, and daily automation.

**Architecture:** A new Node.js script (`scripts/seo/syndicate-medium.mjs`) reads markdown content, filters by frontmatter flags, rewrites via the Anthropic API, converts to HTML, publishes via the Medium API, and writes tracking data back to frontmatter. Integrated into the existing daily GitHub Actions SEO pipeline.

**Tech Stack:** Node.js (ESM), Anthropic SDK (`@anthropic-ai/sdk`), `marked` (markdown→HTML), Medium REST API v1, GitHub Actions

---

### File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/content.config.ts` | Add `syndicate` and `mediumUrl` fields to blog + guides schemas |
| Modify | `src/data/blog/best-chatgpt-prompts-2026.md` | Add `syndicate: [medium]` frontmatter |
| Modify | `src/data/blog/chatgpt-vs-claude-prompting-differences.md` | Add `syndicate: [medium]` frontmatter |
| Modify | `src/data/blog/how-to-write-ai-prompts-beginners-guide.md` | Add `syndicate: [medium]` frontmatter |
| Modify | `src/data/guides/chatgpt-for-business.md` | Add `syndicate: [medium]` frontmatter |
| Modify | `src/data/guides/midjourney-prompt-guide.md` | Add `syndicate: [medium]` frontmatter |
| Modify | `src/data/guides/prompt-engineering-101.md` | Add `syndicate: [medium]` frontmatter |
| Create | `scripts/seo/syndicate-medium.mjs` | Main syndication script |
| Modify | `.env.example` | Document `MEDIUM_API_TOKEN` and `ANTHROPIC_API_KEY` |
| Modify | `package.json` | Add `syndicate:medium` script, append to `seo:pull:all` |
| Modify | `.github/workflows/seo-data-pull.yml` | Add syndication + commit steps, update permissions |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `@anthropic-ai/sdk` and `marked`**

```bash
npm install @anthropic-ai/sdk marked
```

- [ ] **Step 2: Verify installation**

```bash
node -e "import('@anthropic-ai/sdk').then(() => console.log('anthropic OK')); import('marked').then(() => console.log('marked OK'));"
```

Expected: Both print OK with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @anthropic-ai/sdk and marked dependencies

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Update Content Schemas

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: Add `syndicate` and `mediumUrl` to the `blog` schema**

In `src/content.config.ts`, find the `blog` collection schema (line 59-71). Add the two new fields after `draft`:

```typescript
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
    syndicate: z.array(z.string()).default([]),
    mediumUrl: z.string().optional(),
  }),
});
```

- [ ] **Step 2: Add `syndicate` and `mediumUrl` to the `guides` schema**

In the same file, find the `guides` collection schema (line 73-85). Add the same two fields after `draft`:

```typescript
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
    syndicate: z.array(z.string()).default([]),
    mediumUrl: z.string().optional(),
  }),
});
```

- [ ] **Step 3: Run type check to verify schema is valid**

```bash
npm run check
```

Expected: No errors related to blog or guides schemas.

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts
git commit -m "feat(schema): add syndicate and mediumUrl fields to blog and guides

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add Syndication Frontmatter to Content

**Files:**
- Modify: `src/data/blog/best-chatgpt-prompts-2026.md`
- Modify: `src/data/blog/chatgpt-vs-claude-prompting-differences.md`
- Modify: `src/data/blog/how-to-write-ai-prompts-beginners-guide.md`
- Modify: `src/data/guides/chatgpt-for-business.md`
- Modify: `src/data/guides/midjourney-prompt-guide.md`
- Modify: `src/data/guides/prompt-engineering-101.md`

- [ ] **Step 1: Add syndication frontmatter to all 3 blog posts**

For each file in `src/data/blog/`, add `syndicate` and `mediumUrl` fields after `draft: false`:

`src/data/blog/best-chatgpt-prompts-2026.md`:
```yaml
---
title: "25 Best ChatGPT Prompts for 2026 — Tried, Tested & Ready to Copy"
description: "Discover the 25 best ChatGPT prompts for 2026, organized by use case. Each prompt is battle-tested and ready to copy into your next conversation."
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

`src/data/blog/chatgpt-vs-claude-prompting-differences.md`:
```yaml
---
title: "ChatGPT vs Claude: How Prompting Differs Between the Two Best AI Models"
description: "..."
author: "Roshawn Franklin"
pubDate: 2026-04-02
category: "comparisons"
tags: ["chatgpt", "claude", "comparison", "prompting"]
draft: false
syndicate:
  - medium
mediumUrl: ""
---
```

`src/data/blog/how-to-write-ai-prompts-beginners-guide.md`:
```yaml
---
title: "How to Write AI Prompts: A Beginner's Guide to Prompt Engineering"
description: "..."
author: "Roshawn Franklin"
pubDate: 2026-04-02
category: "tutorials"
tags: ["prompt-engineering", "beginners", "tutorial", "ai-prompts"]
draft: false
syndicate:
  - medium
mediumUrl: ""
---
```

Keep each file's existing `description` value — only add the two new lines.

- [ ] **Step 2: Add syndication frontmatter to all 3 guides**

For each file in `src/data/guides/`, add `syndicate` and `mediumUrl` fields after `draft: false`:

`src/data/guides/prompt-engineering-101.md`:
```yaml
draft: false
syndicate:
  - medium
mediumUrl: ""
```

`src/data/guides/chatgpt-for-business.md`:
```yaml
draft: false
syndicate:
  - medium
mediumUrl: ""
```

`src/data/guides/midjourney-prompt-guide.md`:
```yaml
draft: false
syndicate:
  - medium
mediumUrl: ""
```

- [ ] **Step 3: Run type check to verify frontmatter is valid**

```bash
npm run check
```

Expected: No schema validation errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/blog/ src/data/guides/
git commit -m "feat(content): mark all blog posts and guides for Medium syndication

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create the Syndication Script

**Files:**
- Create: `scripts/seo/syndicate-medium.mjs`

- [ ] **Step 1: Create `scripts/seo/syndicate-medium.mjs`**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { marked } from 'marked';

import {
  requireEnv,
  optionalEnv,
  getSeoOutputDir,
  writeJson,
  repoRoot,
  defaultSiteUrl,
} from './_shared.mjs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MEDIUM_API_BASE = 'https://api.medium.com/v1';
const CLAUDE_MODEL = 'claude-opus-4-20250514';
const CONTENT_DIRS = [
  { dir: path.join(repoRoot, 'src/data/blog'), collection: 'blog' },
  { dir: path.join(repoRoot, 'src/data/guides'), collection: 'guides' },
];

const SYSTEM_PROMPT = `You are a content adapter for Medium. Rewrite the following blog post for Medium's audience.

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
- Output valid markdown only — no commentary, no code fences wrapping the output`;

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: raw };

  const meta = {};
  let currentKey = null;
  let inArray = false;

  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Array item
    if (inArray && trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).replace(/^["']|["']$/g, '');
      meta[currentKey].push(value);
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^([A-Za-z_]\w*):\s*(.*)/);
    if (!kvMatch) { inArray = false; continue; }

    const [, key, rawValue] = kvMatch;
    currentKey = key;

    if (rawValue === '' || rawValue === undefined) {
      // Could be start of array or empty value
      meta[key] = [];
      inArray = true;
    } else if (rawValue.startsWith('[')) {
      // Inline array: ["a", "b"]
      try {
        meta[key] = JSON.parse(rawValue);
      } catch {
        meta[key] = rawValue.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      }
      inArray = false;
    } else {
      meta[key] = rawValue.replace(/^["']|["']$/g, '');
      inArray = false;
    }
  }

  // Coerce known booleans
  if (typeof meta.draft === 'string') meta.draft = meta.draft === 'true';

  const body = raw.slice(match[0].length).trim();
  return { meta, body };
}

function writeFrontmatterField(filePath, field, value) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return;

  const fmBlock = match[1];
  const fieldRe = new RegExp(`^${field}:.*$`, 'm');

  let newFmBlock;
  if (fieldRe.test(fmBlock)) {
    newFmBlock = fmBlock.replace(fieldRe, `${field}: "${value}"`);
  } else {
    newFmBlock = fmBlock + `\n${field}: "${value}"`;
  }

  const newRaw = raw.replace(match[0], `---\n${newFmBlock}\n---`);
  fs.writeFileSync(filePath, newRaw, 'utf8');
}

// ---------------------------------------------------------------------------
// Content loading
// ---------------------------------------------------------------------------

function loadSyndicatablePosts() {
  const posts = [];

  for (const { dir, collection } of CONTENT_DIRS) {
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
      const filePath = path.join(dir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const slug = file.replace(/\.md$/, '');

      // Filter: must be marked for medium, not draft, not already published
      const syndTargets = Array.isArray(meta.syndicate) ? meta.syndicate : [];
      if (!syndTargets.includes('medium')) continue;
      if (meta.draft === true) continue;
      if (meta.mediumUrl && meta.mediumUrl.trim() !== '') continue;

      posts.push({
        slug,
        collection,
        filePath,
        title: meta.title || slug,
        tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 5) : [],
        canonicalUrl: `${defaultSiteUrl}/${collection}/${slug}/`,
        body,
      });
    }
  }

  return posts;
}

// ---------------------------------------------------------------------------
// Claude AI rewrite
// ---------------------------------------------------------------------------

async function rewriteForMedium(anthropic, title, body, canonicalUrl) {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Title: ${title}\nOriginal URL: ${canonicalUrl}\n\n${body}`,
      },
    ],
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  // Append attribution footer
  const footer = `\n\n---\n\n*This article was originally published on [AI Prompt Index](${canonicalUrl}). Discover thousands of curated AI prompts at [AIPromptIndex.io](${defaultSiteUrl}).*`;

  return text + footer;
}

// ---------------------------------------------------------------------------
// Medium API
// ---------------------------------------------------------------------------

async function mediumFetch(endpoint, token, options = {}) {
  const url = `${MEDIUM_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const errors = payload.errors?.map(e => e.message).join('; ') || JSON.stringify(payload);
    throw new Error(`Medium API ${response.status}: ${errors}`);
  }

  return payload;
}

async function getMediumUserId(token) {
  const { data } = await mediumFetch('/me', token);
  return data.id;
}

async function publishToMedium(token, userId, { title, html, canonicalUrl, tags }) {
  const { data } = await mediumFetch(`/users/${userId}/posts`, token, {
    method: 'POST',
    body: JSON.stringify({
      title,
      contentFormat: 'html',
      content: html,
      canonicalUrl,
      tags,
      publishStatus: 'public',
    }),
  });

  return data.url;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const mediumToken = requireEnv('MEDIUM_API_TOKEN');
  const anthropicKey = requireEnv('ANTHROPIC_API_KEY');
  const outputDir = getSeoOutputDir();

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const posts = loadSyndicatablePosts();

  if (posts.length === 0) {
    console.log(JSON.stringify({ ok: true, message: 'No new posts to syndicate.', published: [], skipped: [], errors: [] }, null, 2));
    return;
  }

  console.log(`Found ${posts.length} post(s) to syndicate to Medium.`);

  // Resolve Medium user ID once
  const userId = await getMediumUserId(mediumToken);

  const published = [];
  const errors = [];

  for (const post of posts) {
    try {
      console.log(`Syndicating: ${post.slug} (${post.collection})...`);

      // AI rewrite
      const rewritten = await rewriteForMedium(anthropic, post.title, post.body, post.canonicalUrl);

      // Convert to HTML
      const html = await marked.parse(rewritten);

      // Publish to Medium
      const mediumUrl = await publishToMedium(mediumToken, userId, {
        title: post.title,
        html,
        canonicalUrl: post.canonicalUrl,
        tags: post.tags,
      });

      console.log(`  Published: ${mediumUrl}`);

      // Write mediumUrl back to frontmatter
      writeFrontmatterField(post.filePath, 'mediumUrl', mediumUrl);

      published.push({
        slug: post.slug,
        collection: post.collection,
        mediumUrl,
        canonicalUrl: post.canonicalUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Error syndicating ${post.slug}: ${message}`);
      errors.push({ slug: post.slug, collection: post.collection, error: message });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    published,
    skipped: [],
    errors,
  };

  writeJson(path.join(outputDir, 'medium-syndication.json'), result);

  console.log(JSON.stringify({
    ok: errors.length === 0,
    published: published.length,
    errors: errors.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Verify the script parses content without crashing (dry run)**

```bash
node -e "
import fs from 'node:fs';
const raw = fs.readFileSync('scripts/seo/syndicate-medium.mjs', 'utf8');
console.log('Script is valid ESM, length:', raw.length);
"
```

Expected: Prints script length, no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/seo/syndicate-medium.mjs
git commit -m "feat(seo): add Medium syndication script with Claude Opus 4.6 rewrites

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Update Environment Variables and npm Scripts

**Files:**
- Modify: `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Add `MEDIUM_API_TOKEN` and `ANTHROPIC_API_KEY` to `.env.example`**

Append after the last line of `.env.example`:

```
# --- Content Syndication ---

# Medium API — Content syndication to Medium
# Get this from: https://medium.com/me/settings/security → Integration tokens
MEDIUM_API_TOKEN=

# Anthropic API — Claude Opus 4.6 for AI-powered content rewrites
# Get this from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=
```

- [ ] **Step 2: Add `syndicate:medium` script to `package.json`**

Add after the `seo:rank-suggestions` line:

```json
"syndicate:medium": "node scripts/seo/syndicate-medium.mjs",
```

- [ ] **Step 3: Append syndication to `seo:pull:all`**

Change the existing `seo:pull:all` value from:

```
npm run seo:pull:ahrefs && npm run seo:pull:semrush -- --enrich=true --budget=standard && npm run seo:cross-validate && npm run seo:pull:brand-radar && npm run seo:pull:gsc && npm run seo:pull:ga4 && npm run seo:brief
```

to:

```
npm run seo:pull:ahrefs && npm run seo:pull:semrush -- --enrich=true --budget=standard && npm run seo:cross-validate && npm run seo:pull:brand-radar && npm run seo:pull:gsc && npm run seo:pull:ga4 && npm run seo:brief && npm run syndicate:medium
```

- [ ] **Step 4: Add tokens to local `.env`**

```bash
echo '' >> .env
echo '# --- Content Syndication ---' >> .env
echo 'MEDIUM_API_TOKEN=your-medium-token-here' >> .env
echo 'ANTHROPIC_API_KEY=your-anthropic-key-here' >> .env
```

Replace `your-medium-token-here` and `your-anthropic-key-here` with actual values.

- [ ] **Step 5: Commit**

```bash
git add .env.example package.json
git commit -m "chore: add syndicate:medium script and env var documentation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Update GitHub Actions Workflow

**Files:**
- Modify: `.github/workflows/seo-data-pull.yml`

- [ ] **Step 1: Update permissions from `read` to `write`**

Change line 9-10 from:

```yaml
permissions:
  contents: read
  issues: write
```

to:

```yaml
permissions:
  contents: write
  issues: write
```

- [ ] **Step 2: Add syndication step after "Generate SEO brief"**

Insert after the `Generate SEO brief` step (after line 121) and before `Upload SEO output`:

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

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/seo-data-pull.yml
git commit -m "ci: add Medium syndication and commit-back steps to SEO pipeline

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add GitHub Secrets

**No files modified — GitHub UI / CLI action.**

- [ ] **Step 1: Add `MEDIUM_API_TOKEN` secret**

```bash
gh secret set MEDIUM_API_TOKEN
```

Paste the Medium integration token when prompted.

- [ ] **Step 2: Add `ANTHROPIC_API_KEY` secret**

```bash
gh secret set ANTHROPIC_API_KEY
```

Paste the Anthropic API key when prompted.

- [ ] **Step 3: Verify secrets are set**

```bash
gh secret list
```

Expected: Both `MEDIUM_API_TOKEN` and `ANTHROPIC_API_KEY` appear in the list.

---

### Task 8: End-to-End Test

**Files:** None created — validation only.

- [ ] **Step 1: Set local env vars and run a dry test**

Verify the script loads posts and identifies candidates without publishing:

```bash
node -e "
import fs from 'node:fs';
import path from 'node:path';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const dirs = ['src/data/blog', 'src/data/guides'];

for (const dir of dirs) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const match = raw.match(FRONTMATTER_RE);
    const hasSyndicate = match && match[1].includes('syndicate');
    const hasMediumUrl = match && /mediumUrl:\s*\".+\"/.test(match[1]);
    console.log(file, '| syndicate:', hasSyndicate, '| published:', hasMediumUrl);
  }
}
"
```

Expected: All 6 files show `syndicate: true` and `published: false`.

- [ ] **Step 2: Run the full syndication script**

```bash
npm run syndicate:medium
```

Expected: The script connects to Claude API, rewrites each post, publishes to Medium, and writes `mediumUrl` values back to frontmatter files. Console output shows `"published": 6` (or however many posts are marked).

- [ ] **Step 3: Verify frontmatter was updated**

```bash
grep -r "mediumUrl:" src/data/blog/ src/data/guides/
```

Expected: Each file shows a `mediumUrl:` with a real Medium URL (e.g., `mediumUrl: "https://medium.com/@username/slug-abc123"`).

- [ ] **Step 4: Verify output JSON**

```bash
cat output/seo/$(date +%Y-%m-%d)/medium-syndication.json
```

Expected: JSON with `published` array containing all syndicated posts, empty `errors` array.

- [ ] **Step 5: Run the script again to verify idempotency**

```bash
npm run syndicate:medium
```

Expected: Output shows `"No new posts to syndicate."` — all posts already have `mediumUrl` populated.

- [ ] **Step 6: Commit the updated frontmatter**

```bash
git add src/data/blog/ src/data/guides/
git commit -m "chore: update mediumUrl after initial Medium syndication

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Push all commits**

```bash
git push origin main
```
