import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const repoRoot = process.cwd();
export const seoOutputRoot = path.join(repoRoot, 'output', 'seo');
export const defaultSiteUrl = 'https://aipromptindex.io';
export const defaultHost = 'aipromptindex.io';

const tokenCache = new Map();
const dotenvFiles = ['.env', '.env.local'];

function loadDotenvFiles() {
  if (typeof process.loadEnvFile === 'function') {
    for (const fileName of dotenvFiles) {
      const filePath = path.join(repoRoot, fileName);
      if (!fs.existsSync(filePath)) continue;
      process.loadEnvFile(filePath);
    }
    return;
  }

  for (const fileName of dotenvFiles) {
    const filePath = path.join(repoRoot, fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key]) continue;

      const value = rawValue
        .trim()
        .replace(/^["']/, '')
        .replace(/["']$/, '');
      process.env[key] = value;
    }
  }
}

loadDotenvFiles();

export function parseCliArgs(argv = process.argv.slice(2)) {
  return argv.reduce((result, arg) => {
    if (!arg.startsWith('--')) return result;
    const [rawKey, ...rest] = arg.slice(2).split('=');
    result[rawKey] = rest.length > 0 ? rest.join('=') : 'true';
    return result;
  }, {});
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function toIsoDate(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

export function addDays(dateInput, days) {
  const date = new Date(`${toIsoDate(dateInput)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function buildDateWindow(label, days, offsetDays = 0) {
  const endDate = addDays(new Date(), -(1 + offsetDays));
  const startDate = addDays(endDate, -(days - 1));
  return {
    label,
    days,
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
  };
}

export function getSeoOutputDir(args = parseCliArgs()) {
  const dateLabel = args.date || toIsoDate(new Date());
  return ensureDir(path.join(seoOutputRoot, dateLabel));
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function readOptionalJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return readJson(filePath);
}

function appendSearchParam(url, key, value) {
  if (value === undefined || value === null || value === '') return;
  if (Array.isArray(value)) {
    value.forEach((item) => appendSearchParam(url, key, item));
    return;
  }
  url.searchParams.append(key, String(value));
}

export function normalizePathname(input) {
  if (!input) return '/';

  let pathname = input;
  if (/^https?:\/\//i.test(input)) {
    pathname = new URL(input).pathname;
  }

  pathname = pathname.replace(/\/+$/, '');
  return pathname || '/';
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-');
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }

  return payload;
}

function readGoogleServiceAccount() {
  const raw = requireEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  const candidatePath = path.isAbsolute(raw) ? raw : path.join(repoRoot, raw);
  const source = fs.existsSync(candidatePath) ? fs.readFileSync(candidatePath, 'utf8') : raw;
  const parsed = JSON.parse(source);

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must contain a valid Google service account payload.');
  }

  return parsed;
}

async function getGoogleAccessToken(scopes) {
  const scopeKey = scopes.slice().sort().join(' ');
  const cached = tokenCache.get(scopeKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const serviceAccount = readGoogleServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claimSet = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: scopeKey,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claimSet}`);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key).toString('base64url');
  const assertion = `${header}.${claimSet}.${signature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const tokenPayload = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(`Failed to mint Google access token: ${JSON.stringify(tokenPayload)}`);
  }

  tokenCache.set(scopeKey, {
    accessToken: tokenPayload.access_token,
    expiresAt: Date.now() + Number(tokenPayload.expires_in || 3600) * 1000,
  });

  return tokenPayload.access_token;
}

export async function fetchGoogleJson(url, { method = 'POST', body, scopes }) {
  const accessToken = await getGoogleAccessToken(scopes);
  return fetchJson(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function fetchAhrefsJson(endpointPath, params = {}) {
  const apiToken = requireEnv('AHREFS_API_TOKEN');
  const url = new URL(`https://api.ahrefs.com/v3/${endpointPath.replace(/^\/+/, '')}`);
  Object.entries(params).forEach(([key, value]) => appendSearchParam(url, key, value));

  return fetchJson(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
    },
  });
}

export async function fetchAhrefsPost(endpointPath, body = {}) {
  const apiToken = requireEnv('AHREFS_API_TOKEN');
  const url = `https://api.ahrefs.com/v3/${endpointPath.replace(/^\/+/, '')}`;
  return fetchJson(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// Iterates a cursor-paginated Ahrefs endpoint until empty or maxPages reached.
// Returns flat array of rows across pages.
export async function fetchAhrefsPaginated(endpointPath, params = {}, { maxPages = 10, rowsKey = 'rows' } = {}) {
  const accumulated = [];
  let cursor = undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const pageParams = cursor ? { ...params, cursor } : params;
    const response = await fetchAhrefsJson(endpointPath, pageParams);
    const rows = Array.isArray(response?.[rowsKey]) ? response[rowsKey]
      : Array.isArray(response?.rows) ? response.rows
      : Array.isArray(response?.data) ? response.data
      : [];
    accumulated.push(...rows);
    cursor = response?.next_cursor || response?.cursor || response?.meta?.next_cursor;
    if (!cursor || rows.length === 0) break;
  }
  return accumulated;
}

export async function fetchSemrushRows(reportType, params = {}) {
  const apiKey = requireEnv('SEMRUSH_API_KEY');
  const url = new URL('https://api.semrush.com/');
  url.searchParams.set('type', reportType);
  url.searchParams.set('key', apiKey);
  Object.entries(params).forEach(([key, value]) => appendSearchParam(url, key, value));

  const response = await fetch(url.toString());
  const text = await response.text();

  if (!response.ok || text.startsWith('ERROR')) {
    throw new Error(`Semrush request failed (${response.status}) for ${reportType}: ${text.slice(0, 200)}`);
  }

  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(';');
  return lines.slice(1).map((line) => {
    const values = line.split(';');
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || '';
      return row;
    }, {});
  });
}

// Semrush Analytics API v1 — separate base URL for Backlinks + Trends query types.
// Report types: backlinks_overview, backlinks_refdomains, backlinks_anchors, backlinks_pages,
// backlinks_competitors, traffic_summary, traffic_sources, audience_overlap, trending_websites.
// "ERROR 50 :: NOTHING FOUND" means empty dataset (not auth failure) — treated as ok, returns [].
export async function fetchSemrushAnalyticsRows(reportType, params = {}) {
  const apiKey = requireEnv('SEMRUSH_API_KEY');
  const url = new URL('https://api.semrush.com/analytics/v1/');
  url.searchParams.set('type', reportType);
  url.searchParams.set('key', apiKey);
  Object.entries(params).forEach(([key, value]) => appendSearchParam(url, key, value));

  const response = await fetch(url.toString());
  const text = await response.text();

  if (text.startsWith('ERROR 50')) return []; // NOTHING FOUND — empty, not error
  if (!response.ok || text.startsWith('ERROR')) {
    throw new Error(`Semrush analytics request failed (${response.status}) for ${reportType}: ${text.slice(0, 200)}`);
  }

  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(';');
  return lines.slice(1).map((line) => {
    const values = line.split(';');
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || '';
      return row;
    }, {});
  });
}

// Semrush Projects API (v3) — separate base URL, JSON payload, key via query.
// Docs: https://developer.semrush.com/api/v3/projects/
export async function fetchSemrushProjectJson(pathSuffix, params = {}) {
  const apiKey = requireEnv('SEMRUSH_API_KEY');
  const url = new URL(`https://api.semrush.com/reports/v1/projects/${pathSuffix.replace(/^\/+/, '')}`);
  url.searchParams.set('key', apiKey);
  Object.entries(params).forEach(([key, value]) => appendSearchParam(url, key, value));

  return fetchJson(url.toString(), {
    headers: { Accept: 'application/json' },
  });
}

export async function fetchSemrushManagementJson(pathSuffix, {
  method = 'GET',
  params = {},
  body = null,
} = {}) {
  const apiKey = requireEnv('SEMRUSH_API_KEY');
  const url = new URL(`https://api.semrush.com/management/v1/projects/${pathSuffix.replace(/^\/+/, '')}`);
  url.searchParams.set('key', apiKey);
  Object.entries(params).forEach(([key, value]) => appendSearchParam(url, key, value));

  return fetchJson(url.toString(), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function getArtifactEnvelope({
  source,
  generatedAt = new Date().toISOString(),
  status = 'ok',
  blockedReason = null,
  warnings = [],
  unitCostEstimate = null,
  ...rest
} = {}) {
  return {
    source,
    generatedAt,
    status,
    blockedReason,
    warnings,
    unitCostEstimate,
    ...rest,
  };
}

export function withSectionStatus(section = {}, fallbackStatus = 'unknown') {
  return {
    status: section.status || fallbackStatus,
    blockedReason: section.blockedReason || null,
    warnings: Array.isArray(section.warnings) ? section.warnings : [],
    ...section,
  };
}

export function normalizeStatus(status, fallback = 'unknown') {
  const allowed = new Set(['ok', 'skipped', 'blocked', 'misconfigured', 'unknown']);
  return allowed.has(status) ? status : fallback;
}

export function statusSeverity(status) {
  switch (normalizeStatus(status)) {
    case 'misconfigured':
      return 4;
    case 'blocked':
      return 3;
    case 'unknown':
      return 2;
    case 'skipped':
      return 1;
    case 'ok':
    default:
      return 0;
  }
}

export function rollupStatuses(...statuses) {
  const normalized = statuses
    .flat()
    .map((status) => normalizeStatus(status))
    .filter(Boolean);

  if (normalized.length === 0) return 'unknown';
  return normalized.reduce((current, candidate) => (
    statusSeverity(candidate) > statusSeverity(current) ? candidate : current
  ));
}

export function classifySemrushError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/API UNITS BALANCE IS ZERO|not enough api units|Api units balance is zero/i.test(message)) {
    return { status: 'blocked', blockedReason: 'semrush_api_units_zero', message };
  }
  if (/campaign not found|Access denied|project access/i.test(message)) {
    return { status: 'misconfigured', blockedReason: null, message };
  }
  if (/Missing required environment variable|not set/i.test(message)) {
    return { status: 'misconfigured', blockedReason: null, message };
  }
  return { status: 'unknown', blockedReason: null, message };
}

export function classifyAhrefsError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Missing required environment variable|not set/i.test(message)) {
    return { status: 'misconfigured', blockedReason: null, message };
  }
  if (/API units limit reached|API units left:\s*0|Expected usage:/i.test(message)) {
    return { status: 'blocked', blockedReason: 'ahrefs_api_units_exhausted', message };
  }
  if (/429|Too Many Requests|throttl/i.test(message)) {
    return { status: 'blocked', blockedReason: 'ahrefs_rate_limited', message };
  }
  return { status: 'unknown', blockedReason: null, message };
}

export function summarizeSeoWorkflowGates(liveProbes = {}) {
  const ahrefsBlocked = ['ahrefsApi', 'ahrefsSiteAudit', 'ahrefsRankTracker']
    .some((probeName) => liveProbes[probeName]?.status === 'blocked');

  return {
    blockedEndpoints: [
      ...(ahrefsBlocked ? ['ahrefs.api'] : []),
      ...(liveProbes.semrushAnalytics?.status === 'blocked' ? ['semrush.analytics'] : []),
      ...(liveProbes.semrushProjects?.status === 'blocked' ? ['semrush.projects'] : []),
      ...(liveProbes.semrushPositionTracking?.status === 'blocked' ? ['semrush.positionTracking'] : []),
    ],
    sources: {
      ahrefsApi: ahrefsBlocked ? 'blocked' : (normalizeStatus(liveProbes.ahrefsApi?.status) || 'unknown'),
      semrushAnalytics: normalizeStatus(liveProbes.semrushAnalytics?.status) || 'unknown',
      semrushProjects: normalizeStatus(liveProbes.semrushProjects?.status) || 'unknown',
    },
    workflowGates: {
      canRunAhrefs: liveProbes.ahrefsApi?.status === 'ok' && !ahrefsBlocked,
      canRunSemrushAnalytics: liveProbes.semrushAnalytics?.status === 'ok' && (liveProbes.semrushAnalytics?.unitsRemaining ?? 0) > 0,
      canRunSemrushProjects: ['ok', 'unknown'].includes(liveProbes.semrushProjects?.status),
      canRunSemrushPositionTracking: liveProbes.semrushPositionTracking?.status === 'ok',
    },
  };
}

export async function getSemrushApiUnitsBalance(apiKey = requireEnv('SEMRUSH_API_KEY')) {
  try {
    const response = await fetch(`https://www.semrush.com/users/countapiunits.html?key=${apiKey}`);
    const text = (await response.text()).trim();
    if (!response.ok || text.startsWith('ERROR')) {
      throw new Error(text || `HTTP ${response.status}`);
    }
    const unitsRemaining = Number(text);
    const normalizedUnits = Number.isFinite(unitsRemaining) ? unitsRemaining : null;
    return {
      status: normalizedUnits !== null && normalizedUnits <= 0 ? 'blocked' : 'ok',
      blockedReason: normalizedUnits !== null && normalizedUnits <= 0 ? 'semrush_api_units_zero' : null,
      unitsRemaining: normalizedUnits,
      raw: text,
    };
  } catch (error) {
    const classified = classifySemrushError(error);
    return {
      status: classified.status,
      blockedReason: classified.blockedReason,
      unitsRemaining: null,
      error: classified.message,
    };
  }
}

export async function getAhrefsLimitsAndUsage(apiToken = requireEnv('AHREFS_API_TOKEN')) {
  try {
    const response = await fetch('https://api.ahrefs.com/v3/subscription-info/limits-and-usage', {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(payload));
    }
    return {
      status: 'ok',
      subscription: payload.limits_and_usage?.subscription || null,
      unitsLimit: payload.limits_and_usage?.units_limit_workspace ?? null,
      unitsUsed: payload.limits_and_usage?.units_usage_workspace ?? null,
      keyExpires: payload.limits_and_usage?.api_key_expiration_date ?? null,
    };
  } catch (error) {
    const classified = classifyAhrefsError(error);
    return {
      status: classified.status,
      blockedReason: classified.blockedReason,
      error: classified.message,
    };
  }
}

export function listSeoOutputDates() {
  if (!fs.existsSync(seoOutputRoot)) return [];
  return fs.readdirSync(seoOutputRoot)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry))
    .sort();
}

export function getPreviousSeoDate(dateLabel) {
  const dates = listSeoOutputDates();
  const index = dates.indexOf(dateLabel);
  if (index <= 0) return null;
  return dates[index - 1] || null;
}

export function getPreviousSeoOutputDir(dateLabel) {
  const previousDate = getPreviousSeoDate(dateLabel);
  return previousDate ? path.join(seoOutputRoot, previousDate) : null;
}

// Load seed keywords from SEO_SEED_KEYWORDS_PATH (JSON array of strings or objects with .keyword).
export function loadSeedKeywords(fallback = []) {
  const configPath = optionalEnv('SEO_SEED_KEYWORDS_PATH', 'scripts/config/seed-keywords.json');
  const absPath = path.isAbsolute(configPath) ? configPath : path.join(repoRoot, configPath);
  if (!fs.existsSync(absPath)) return fallback;
  const data = readJson(absPath);
  const list = Array.isArray(data) ? data : data?.keywords || [];
  return list
    .map((entry) => (typeof entry === 'string' ? entry : entry?.keyword || ''))
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

// Load competitor domains from SEO_COMPETITOR_DOMAINS_PATH (JSON array of strings or objects with .domain).
export function loadCompetitorDomains(fallback = []) {
  const configPath = optionalEnv('SEO_COMPETITOR_DOMAINS_PATH', 'scripts/config/competitor-domains.json');
  const absPath = path.isAbsolute(configPath) ? configPath : path.join(repoRoot, configPath);
  if (!fs.existsSync(absPath)) return fallback;
  const data = readJson(absPath);
  const list = Array.isArray(data) ? data : data?.domains || [];
  return list
    .map((entry) => (typeof entry === 'string' ? entry : entry?.domain || ''))
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

export function loadSiteInventory() {
  const inventory = [];
  const addEntry = (pathname, surface, label, aliases = []) => {
    inventory.push({
      pathname: normalizePathname(pathname),
      surface,
      label,
      tokens: uniqueBy(
        [label, pathname, ...aliases]
          .map((value) => normalizeText(value))
          .filter(Boolean),
        (value) => value
      ),
    });
  };

  const readDir = (dirPath, extension) => {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath)
      .filter((fileName) => fileName.endsWith(extension))
      .sort((left, right) => left.localeCompare(right));
  };
  const readJsonDir = (dirPath) => readDir(dirPath, '.json').map((fileName) => readJson(path.join(dirPath, fileName)));

  // Prompts (src/data/prompts/*.json)
  const prompts = readJsonDir(path.join(repoRoot, 'src', 'data', 'prompts'));
  prompts.forEach((prompt) => addEntry(
    `/prompts/${prompt.slug}`,
    'prompt page',
    prompt.title || prompt.slug,
    [prompt.slug, prompt.category, prompt.tool, ...(prompt.tags || [])].filter(Boolean)
  ));

  // Categories (src/data/categories/categories.json)
  const categoriesPath = path.join(repoRoot, 'src', 'data', 'categories', 'categories.json');
  if (fs.existsSync(categoriesPath)) {
    const categories = readJson(categoriesPath);
    categories.forEach((category) => addEntry(
      `/categories/${category.slug}`,
      'category hub',
      category.name,
      [category.slug, category.description]
    ));
  }

  // Audience pages (src/data/seo/audience-pages.json)
  const audiencePath = path.join(repoRoot, 'src', 'data', 'seo', 'audience-pages.json');
  if (fs.existsSync(audiencePath)) {
    const audiencePages = readJson(audiencePath);
    audiencePages.forEach((page) => addEntry(
      `/prompts/for/${page.slug}`,
      'audience page',
      page.title || `AI Prompts for ${page.audience}`,
      [page.slug, page.keyword, page.audience].filter(Boolean)
    ));
  }

  // Best-of pages (src/data/seo/bestof-pages.json)
  const bestofPath = path.join(repoRoot, 'src', 'data', 'seo', 'bestof-pages.json');
  if (fs.existsSync(bestofPath)) {
    const bestofPages = readJson(bestofPath);
    bestofPages.forEach((page) => addEntry(
      `/best/${page.slug}`,
      'best-of roundup',
      page.title || page.slug,
      [page.slug, page.keyword].filter(Boolean)
    ));
  }

  // Tool-category pages (src/data/seo/tool-category-pages.json)
  const toolCatPath = path.join(repoRoot, 'src', 'data', 'seo', 'tool-category-pages.json');
  if (fs.existsSync(toolCatPath)) {
    const toolCatPages = readJson(toolCatPath);
    toolCatPages.forEach((page) => addEntry(
      `/prompts/${page.tool}/${page.category}`,
      'tool-category page',
      page.title || `${page.tool} ${page.category} Prompts`,
      [page.tool, page.category, page.keyword].filter(Boolean)
    ));
  }

  // Guides (src/data/guides/*.md)
  const guidesDir = path.join(repoRoot, 'src', 'data', 'guides');
  readDir(guidesDir, '.md').forEach((fileName) => {
    const filePath = path.join(guidesDir, fileName);
    const text = fs.readFileSync(filePath, 'utf8');
    const slug = fileName.replace(/\.md$/, '');
    const title = text.match(/^title:\s*["']?(.+?)["']?$/m)?.[1] || slug;
    addEntry(`/guides/${slug}`, 'guide', title, [slug]);
  });

  // Blog (src/data/blog/*.md)
  const blogDir = path.join(repoRoot, 'src', 'data', 'blog');
  readDir(blogDir, '.md').forEach((fileName) => {
    const filePath = path.join(blogDir, fileName);
    const text = fs.readFileSync(filePath, 'utf8');
    const slug = fileName.replace(/\.md$/, '');
    const title = text.match(/^title:\s*["']?(.+?)["']?$/m)?.[1] || slug;
    addEntry(`/blog/${slug}`, 'blog', title, [slug]);
  });

  return inventory;
}

export function classifySurface(pathname) {
  const normalized = normalizePathname(pathname);
  if (/^\/prompts\/for\//.test(normalized)) return 'audience page';
  if (/^\/prompts\/[^/]+\/[^/]+/.test(normalized)) return 'tool-category page';
  if (normalized.startsWith('/prompts/')) return 'prompt page';
  if (normalized.startsWith('/categories/')) return 'category hub';
  if (normalized.startsWith('/best/')) return 'best-of roundup';
  if (normalized.startsWith('/guides/')) return 'guide';
  if (normalized.startsWith('/blog/')) return 'blog';
  return 'guide';
}

export function inferOpportunitySurface(keyword) {
  const value = normalizeText(keyword);
  if (/\b(best|top|list)\b/.test(value)) return 'best-of roundup';
  if (/\b(for|teachers?|students?|developers?|marketers?|beginners?)\b/.test(value)) return 'audience page';
  if (/\b(how|what|why|guide|tips|examples?|tutorial)\b/.test(value)) return 'guide';
  if (/\b(prompt|prompts|template|templates)\b/.test(value)) return 'prompt page';
  if (/\b(category|directory|index)\b/.test(value)) return 'category hub';
  return 'blog';
}

export function scoreKeywordMatch(keyword, inventoryEntry) {
  const keywordText = normalizeText(keyword);
  if (!keywordText) return 0;

  let bestScore = 0;
  for (const token of inventoryEntry.tokens) {
    if (!token) continue;
    if (keywordText === token) bestScore = Math.max(bestScore, 1);
    else if (keywordText.includes(token) || token.includes(keywordText)) bestScore = Math.max(bestScore, 0.8);
    else {
      const tokenParts = token.split(' ').filter(Boolean);
      const overlap = tokenParts.filter((part) => keywordText.includes(part)).length;
      if (tokenParts.length > 0) {
        bestScore = Math.max(bestScore, overlap / tokenParts.length);
      }
    }
  }

  return bestScore;
}

export function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
