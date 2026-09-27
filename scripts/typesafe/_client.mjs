import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ensureDir, optionalEnv, repoRoot, requireEnv } from '../seo/_shared.mjs';

export const typesafeOutputRoot = path.join(repoRoot, 'output', 'typesafe');
export const promptsDir = path.join(repoRoot, 'src', 'data', 'prompts');

const endpoint = 'https://api.typesafe.ai/v1/systemone';
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504, 529]);

// Question builders mirror the HTTP API shapes documented at https://docs.typesafe.ai/api.md
export const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });
export const score = (instructions, criteria) => ({ type: 'score', instructions, criteria });
export const noul = (instructions, criteria) => (
  criteria ? { type: 'noul', instructions, criteria } : { type: 'noul', instructions }
);

/** Fail before any work starts, instead of recording one "missing key" error per item. */
export function requireApiKey() {
  try {
    return requireEnv('TYPESAFE_API_KEY');
  } catch {
    throw new Error('TYPESAFE_API_KEY is not set. Add it to .env.local (never commit it), or use --dry-run to preview the request.');
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One System One request: every question sees the same state and is answered independently.
 */
export async function systemOne({ state, questions, maxAttempts = 5 }) {
  const apiKey = requireEnv('TYPESAFE_API_KEY');
  const model = optionalEnv('TYPESAFE_MODEL', 'jev-latest');
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state, model, questions }),
      });
      if (response.ok) return await response.json();

      const body = await response.text();
      lastError = new Error(`TypeSafe request failed (${response.status}): ${body.slice(0, 500)}`);
      lastError.retryable = retryableStatuses.has(response.status);
    } catch (error) {
      // Network failures are worth retrying; they carry no status.
      lastError = error;
      lastError.retryable = true;
    }
    if (!lastError.retryable) throw lastError;
    if (attempt < maxAttempts) await sleep(Math.min(500 * 2 ** (attempt - 1), 8000));
  }
  throw lastError;
}

/** Run `worker` over `items` with at most `limit` requests in flight. */
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** Score answers are a probability-weighted level index; normalize to 0–1. */
export function normalizeScore(answer, levelCount) {
  if (!answer || typeof answer.score !== 'number' || levelCount < 2) return null;
  return Math.max(0, Math.min(1, answer.score / (levelCount - 1)));
}

export function contentHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

export function loadPrompts() {
  return fs.readdirSync(promptsDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => JSON.parse(fs.readFileSync(path.join(promptsDir, fileName), 'utf8')))
    .filter((prompt) => prompt && prompt.slug);
}

export function loadJson(relativePath, fallback = null) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

export function writeTextFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value);
  return filePath;
}

/**
 * Judgments are cached by a hash of the exact state + questions, so re-runs only pay for
 * prompts or rubrics that changed. Changing weights/thresholds never re-runs inference.
 */
export function openCache(name) {
  const filePath = path.join(typesafeOutputRoot, 'cache', `${name}.json`);
  const entries = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
  return {
    get: (key) => entries[key],
    set: (key, value) => { entries[key] = value; },
    save: () => writeJsonFile(filePath, entries),
  };
}

export async function cachedSystemOne(cache, request) {
  const key = contentHash({ state: request.state, questions: request.questions });
  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };
  const response = await systemOne(request);
  cache.set(key, { answers: response.answers, model: response.model, usage: response.usage });
  return { ...response, cached: false };
}

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or',
  'that', 'the', 'this', 'to', 'with', 'your', 'you', 'ai', 'prompt', 'prompts', 'best', 'free',
]);

export function tokenize(text, { keepStopWords = false } = {}) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((token) => token.length > 1 && (keepStopWords || !stopWords.has(token)));
}

/**
 * Cheap lexical retrieval. The model can only judge candidates it is shown, so this errs
 * toward recall: weighted token overlap across title, tags, description and prompt text.
 */
export function retrieveCandidates(queryText, documents, { limit = 8, exclude = () => false } = {}) {
  // Queries made only of site-wide words ("best ai prompts") still need candidates.
  const keepStopWords = tokenize(queryText).length === 0;
  const queryTokens = new Set(tokenize(queryText, { keepStopWords }));
  if (queryTokens.size === 0) return [];
  return documents
    .filter((doc) => !exclude(doc))
    .map((doc) => {
      const fields = [
        [doc.title, 4],
        [(doc.tags || []).join(' '), 3],
        [`${doc.category || ''} ${doc.tool || ''}`, 2],
        [doc.description, 2],
        [doc.promptText, 1],
      ];
      let overlap = 0;
      for (const [text, weight] of fields) {
        const fieldTokens = new Set(tokenize(text, { keepStopWords }));
        for (const token of queryTokens) if (fieldTokens.has(token)) overlap += weight;
      }
      return { doc, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.doc.slug.localeCompare(b.doc.slug))
    .slice(0, limit)
    .map((entry) => entry.doc);
}

export function summarizeUsage(responses) {
  return responses.reduce((total, response) => {
    if (!response || response.cached) return { ...total, cachedRequests: total.cachedRequests + (response ? 1 : 0) };
    return {
      ...total,
      requests: total.requests + 1,
      inputTokens: total.inputTokens + (response.usage?.input_tokens || 0),
      outputTokens: total.outputTokens + (response.usage?.output_tokens || 0),
    };
  }, { requests: 0, cachedRequests: 0, inputTokens: 0, outputTokens: 0 });
}
