import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { marked } from 'marked';

import {
  requireEnv,
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
    console.log(JSON.stringify({
      ok: true,
      message: 'No new posts to syndicate.',
      published: [],
      skipped: [],
      errors: [],
    }, null, 2));
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
