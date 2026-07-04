import path from 'node:path';

import Anthropic from '@anthropic-ai/sdk';

import {
  defaultSiteUrl,
  getArtifactEnvelope,
  getLatestSeoDate,
  getSeoOutputDir,
  loadSiteInventory,
  normalizePathname,
  numberValue,
  optionalEnv,
  parseCliArgs,
  readOptionalJson,
  requireEnv,
  scoreKeywordMatch,
  writeJson,
  writeText,
} from './_shared.mjs';

const args = parseCliArgs();
const inputDate = args.date || getLatestSeoDate();

if (!inputDate) {
  throw new Error('No SEO output directory found. Run the SEO data pull first or pass --date=YYYY-MM-DD.');
}

const outputDir = getSeoOutputDir({ date: inputDate });
const siteUrl = optionalEnv('PUBLIC_SITE_URL', defaultSiteUrl).replace(/\/$/, '');
const mockAi = args['mock-ai'] === 'true' || process.env.ANTHROPIC_MOCK === 'true';
const model = optionalEnv('ANTHROPIC_SEO_MODEL', 'claude-opus-4-8');
const candidateLimit = Math.max(4, numberValue(optionalEnv('ANTHROPIC_SEO_MAX_PAGES', '10'), 10));
const rewriteLimit = Math.min(candidateLimit, 6);
const linkLimit = Math.min(candidateLimit, 8);
const qaLimit = Math.min(candidateLimit, 8);
const pageSampleChars = Math.max(1200, numberValue(optionalEnv('ANTHROPIC_SEO_PAGE_SAMPLE_CHARS', '2500'), 2500));

const anthropic = mockAi ? null : new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });

const surfaceOrder = [
  'blog',
  'guide',
  'best-of roundup',
  'prompt page',
  'audience page',
  'tool-category page',
  'category hub',
];

function readOutputJson(fileName, fallback = null) {
  return readOptionalJson(path.join(outputDir, fileName), fallback);
}

function mapByPath(rows = [], selector = (row) => row, keySelector = (row) => row.key || row.landingPage || row.url) {
  return rows.reduce((map, row) => {
    const key = normalizePathname(keySelector(row));
    map.set(key, selector(row));
    return map;
  }, new Map());
}

function expectedCtr(position) {
  if (position <= 3) return 0.12;
  if (position <= 5) return 0.08;
  if (position <= 10) return 0.04;
  if (position <= 20) return 0.02;
  return 0.01;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractOne(pattern, input) {
  const match = String(input || '').match(pattern);
  return match?.[1]?.trim() || null;
}

function extractAll(pattern, input) {
  return [...String(input || '').matchAll(pattern)]
    .map((match) => match[1]?.trim() || '')
    .filter(Boolean);
}

function summarizeEvidence(candidate) {
  const parts = [];
  if (candidate.gsc) {
    parts.push(
      `${Math.round(candidate.gsc.impressions).toLocaleString()} impressions`,
      `${Math.round(candidate.gsc.clicks).toLocaleString()} clicks`,
      `position ${candidate.gsc.position.toFixed(1)}`,
      `CTR ${(candidate.gsc.ctr * 100).toFixed(1)}%`
    );
  }
  if (candidate.ga4) parts.push(`${Math.round(candidate.ga4.sessions).toLocaleString()} GA4 sessions`);
  if (candidate.ahrefs) parts.push(`${Math.round(candidate.ahrefs.traffic).toLocaleString()} Ahrefs traffic`);
  if (candidate.ahrefs?.topKeyword) parts.push(`top keyword "${candidate.ahrefs.topKeyword}"`);
  return parts.join(' | ');
}

function normalizePriority(value, fallback = 'medium') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['high', 'medium', 'low'].includes(normalized)) return normalized;
  if (normalized === 'p1') return 'high';
  if (normalized === 'p2') return 'medium';
  if (normalized === 'p3') return 'low';
  return fallback;
}

function clampConfidence(value, fallback = 0.65) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function parseJsonResponse(taskName, text) {
  const trimmed = String(text || '').trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next extraction candidate.
    }
  }

  throw new Error(`Unable to parse JSON response for ${taskName}.`);
}

async function requestJsonFromClaude(taskName, userPrompt, mockBuilder) {
  if (mockAi) return mockBuilder();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: [
      'You are an SEO operations analyst for aipromptindex.io.',
      'Return only valid JSON.',
      'Do not wrap the JSON in markdown fences.',
      'Do not include explanations outside the JSON payload.',
      'Keep recommendations specific, editorially safe, and anchored to the supplied evidence.',
    ].join(' '),
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseJsonResponse(taskName, text);
}

function buildCandidateRecords(inventory, artifacts) {
  const gscLast28 = artifacts.gscPages?.ranges?.last28?.rows || [];
  const gscPrev28 = artifacts.gscPages?.ranges?.previous28?.rows || [];
  const ga4Last28 = artifacts.ga4?.ranges?.last28?.summary || [];
  const ahrefsTopPages = artifacts.ahrefsTopPages?.rows || [];

  const gscByPath = mapByPath(gscLast28, (row) => ({
    clicks: numberValue(row.clicks),
    impressions: numberValue(row.impressions),
    ctr: numberValue(row.ctr),
    position: numberValue(row.position),
  }));
  const prevGscByPath = mapByPath(gscPrev28, (row) => ({
    clicks: numberValue(row.clicks),
    impressions: numberValue(row.impressions),
    ctr: numberValue(row.ctr),
    position: numberValue(row.position),
  }));
  const ga4ByPath = mapByPath(ga4Last28, (row) => ({
    sessions: numberValue(row.sessions),
    engagedSessions: numberValue(row.engagedSessions),
    totalKeyEvents: numberValue(row.totalKeyEvents),
  }), (row) => row.landingPage);
  const ahrefsByPath = mapByPath(ahrefsTopPages, (row) => ({
    traffic: numberValue(row.traffic),
    refdomains: row.refdomains === null || row.refdomains === undefined ? null : numberValue(row.refdomains),
    topKeyword: row.topKeyword || '',
    topKeywordVolume: numberValue(row.topKeywordVolume),
  }), (row) => row.url);

  return inventory.map((entry) => {
    const gsc = gscByPath.get(entry.pathname) || null;
    const prevGsc = prevGscByPath.get(entry.pathname) || null;
    const ga4 = ga4ByPath.get(entry.pathname) || null;
    const ahrefs = ahrefsByPath.get(entry.pathname) || null;
    const ctrGap = gsc ? Math.max(expectedCtr(gsc.position) - gsc.ctr, 0) : 0;
    const declinePct = gsc && prevGsc && prevGsc.clicks > 0
      ? ((prevGsc.clicks - gsc.clicks) / prevGsc.clicks) * 100
      : 0;
    const score = (
      (gsc?.impressions || 0) * 0.03 +
      (gsc?.clicks || 0) * 2 +
      (ga4?.sessions || 0) * 0.4 +
      (ahrefs?.traffic || 0) * 12 +
      ctrGap * 450 +
      Math.max(declinePct, 0) * 1.5 +
      (gsc?.position && gsc.position <= 25 ? (26 - gsc.position) * 4 : 0) +
      (ahrefs?.refdomains ? Math.min(ahrefs.refdomains, 10) * 2 : 0)
    );

    return {
      ...entry,
      gsc,
      prevGsc,
      ga4,
      ahrefs,
      ctrGap,
      declinePct,
      evidenceCount: [gsc, ga4, ahrefs].filter(Boolean).length,
      score,
      evidenceSummary: summarizeEvidence({ gsc, ga4, ahrefs }),
    };
  });
}

function selectCandidates(records) {
  const sorted = [...records].sort((left, right) => (
    right.evidenceCount - left.evidenceCount ||
    right.score - left.score ||
    left.pathname.localeCompare(right.pathname)
  ));

  const selected = [];
  const seen = new Set();

  for (const surface of surfaceOrder) {
    const candidate = sorted.find((record) => record.surface === surface && !seen.has(record.pathname));
    if (!candidate) continue;
    selected.push(candidate);
    seen.add(candidate.pathname);
  }

  for (const candidate of sorted) {
    if (selected.length >= candidateLimit) break;
    if (seen.has(candidate.pathname)) continue;
    selected.push(candidate);
    seen.add(candidate.pathname);
  }

  return selected.slice(0, candidateLimit);
}

async function fetchPageSnapshot(pathname) {
  const url = new URL(pathname, `${siteUrl}/`).toString();

  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'AIPromptIndex SEO AI Ops' },
    });
    const html = await response.text();
    const title = extractOne(/<title>([^<]+)<\/title>/i, html);
    const description = extractOne(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, html);
    const canonical = extractOne(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i, html);
    const robots = extractOne(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i, html);
    const h1 = extractOne(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html);
    const h2s = extractAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, html).slice(0, 8);
    const text = stripHtml(html);
    const sample = text.slice(0, pageSampleChars);
    const issues = [];

    if (!title) issues.push('missing title');
    if (!description) issues.push('missing meta description');
    if (!canonical) issues.push('missing canonical');
    if (!h1) issues.push('missing h1');
    if (response.status !== 200) issues.push(`http ${response.status}`);
    if (description && description.length < 120) issues.push('meta description likely too short');
    if (description && description.length > 170) issues.push('meta description likely too long');
    if (sample.split(/\s+/).filter(Boolean).length < 150) issues.push('page copy appears thin');

    return {
      ok: response.ok,
      status: response.status,
      url,
      title,
      description,
      canonical,
      robots,
      h1,
      h2s,
      sample,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      issues,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      url,
      title: null,
      description: null,
      canonical: null,
      robots: null,
      h1: null,
      h2s: [],
      sample: '',
      wordCount: 0,
      issues: [`fetch failed: ${message}`],
    };
  }
}

function findLinkOptions(candidate, inventory) {
  const query = [
    candidate.label,
    candidate.ahrefs?.topKeyword,
    candidate.page?.title,
    candidate.page?.description,
  ].filter(Boolean).join(' ');

  return inventory
    .filter((entry) => entry.pathname !== candidate.pathname)
    .map((entry) => ({
      pathname: entry.pathname,
      surface: entry.surface,
      label: entry.label,
      relevance: scoreKeywordMatch(query, entry),
    }))
    .filter((entry) => entry.relevance >= 0.25)
    .sort((left, right) => right.relevance - left.relevance || left.pathname.localeCompare(right.pathname))
    .slice(0, 6);
}

function buildSourceEvidence(candidate) {
  return {
    pathname: candidate.pathname,
    surface: candidate.surface,
    label: candidate.label,
    gsc: candidate.gsc,
    previousGsc: candidate.prevGsc,
    ga4: candidate.ga4,
    ahrefs: candidate.ahrefs,
    ctrGap: candidate.ctrGap,
    declinePct: candidate.declinePct,
    pageSnapshot: {
      status: candidate.page.status,
      title: candidate.page.title,
      description: candidate.page.description,
      canonical: candidate.page.canonical,
      h1: candidate.page.h1,
      h2s: candidate.page.h2s,
      issues: candidate.page.issues,
      wordCount: candidate.page.wordCount,
    },
  };
}

function buildAiBriefPrompt(artifacts, candidates) {
  const contentBriefs = artifacts.contentBriefs?.briefs || [];
  const keywordGaps = artifacts.keywordGaps?.gaps || artifacts.keywordGaps?.keywords || [];
  const liveVerification = artifacts.liveVerification || null;

  return [
    'Create an AI SEO operations brief for aipromptindex.io.',
    'Return JSON with this exact shape:',
    '{"summary":"string","priorities":[{"priority":"high|medium|low","title":"string","why":"string","evidence":["string"],"recommendedActions":["string"]}],"nextActions":["string"],"risks":["string"]}',
    'Limit priorities to 5 and nextActions to 8.',
    '',
    'Context:',
    JSON.stringify({
      inputDate,
      liveVerification: liveVerification ? {
        homepageIssues: liveVerification.homepage?.issues || [],
        sitemapUrlCount: liveVerification.sitemap?.urlCount || 0,
        samplePageIssues: Object.fromEntries((liveVerification.pages || []).map((page) => [page.pathname, page.issues])),
      } : null,
      topContentBriefs: contentBriefs.slice(0, 5).map((brief) => ({
        keyword: brief.keyword,
        surface: brief.suggestedSurface,
        suggestedTitle: brief.suggestedTitle,
        volume: brief.volume,
        difficulty: brief.difficulty,
      })),
      topKeywordGaps: keywordGaps.slice(0, 5),
      candidatePages: candidates.slice(0, 8).map((candidate) => ({
        pathname: candidate.pathname,
        surface: candidate.surface,
        evidenceSummary: candidate.evidenceSummary,
        liveIssues: candidate.page.issues,
      })),
    }, null, 2),
  ].join('\n');
}

function buildRewritePrompt(candidates) {
  return [
    'Generate rewrite and polish suggestions for these aipromptindex.io pages.',
    'Return JSON with this exact shape:',
    '{"suggestions":[{"pathname":"string","priority":"high|medium|low","confidence":0.0,"suggestedTitle":"string","suggestedMetaDescription":"string","openingRewrite":"string","sectionSuggestions":["string"],"faqSuggestions":["string"],"rationale":"string"}]}',
    'Use only the provided pathnames. Limit sectionSuggestions and faqSuggestions to 4 each.',
    'Do not suggest changing canonical URLs or publishing off-site.',
    '',
    'Pages:',
    JSON.stringify(candidates.map((candidate) => ({
      pathname: candidate.pathname,
      surface: candidate.surface,
      sourceEvidence: buildSourceEvidence(candidate),
      sample: candidate.page.sample,
    })), null, 2),
  ].join('\n');
}

function buildInternalLinksPrompt(candidates) {
  return [
    'Generate internal link plans for these aipromptindex.io pages.',
    'Return JSON with this exact shape:',
    '{"suggestions":[{"pathname":"string","priority":"high|medium|low","confidence":0.0,"links":[{"targetPathname":"string","suggestedAnchor":"string","rationale":"string"}]}]}',
    'Use only targetPathname values from each page\'s provided linkOptions list.',
    'Choose up to 3 links per page.',
    '',
    'Pages:',
    JSON.stringify(candidates.map((candidate) => ({
      pathname: candidate.pathname,
      surface: candidate.surface,
      sourceEvidence: buildSourceEvidence(candidate),
      linkOptions: candidate.linkOptions,
    })), null, 2),
  ].join('\n');
}

function buildQaPrompt(candidates) {
  return [
    'Audit these aipromptindex.io pages for on-site SEO and content quality.',
    'Return JSON with this exact shape:',
    '{"audits":[{"pathname":"string","priority":"high|medium|low","confidence":0.0,"strengths":["string"],"issues":[{"severity":"high|medium|low","type":"string","description":"string"}],"opportunities":["string"],"snippetOpportunity":"string","faqOpportunity":"string"}]}',
    'Use only the supplied pathnames. Limit strengths and opportunities to 4 each and issues to 5 each.',
    '',
    'Pages:',
    JSON.stringify(candidates.map((candidate) => ({
      pathname: candidate.pathname,
      surface: candidate.surface,
      sourceEvidence: buildSourceEvidence(candidate),
      sample: candidate.page.sample,
    })), null, 2),
  ].join('\n');
}

function buildMockAiBrief(candidates) {
  return {
    summary: `Reviewed ${candidates.length} candidate pages across ${new Set(candidates.map((candidate) => candidate.surface)).size} surfaces using current Ahrefs, GSC, GA4, and live-page signals.`,
    priorities: candidates.slice(0, 5).map((candidate, index) => ({
      priority: index < 2 ? 'high' : 'medium',
      title: `Improve ${candidate.pathname}`,
      why: `This page shows a strong optimization signal: ${candidate.evidenceSummary || 'current on-site visibility evidence'}.`,
      evidence: [candidate.evidenceSummary || 'No performance evidence available yet.', ...candidate.page.issues.slice(0, 2)],
      recommendedActions: [
        'Tighten the opening section around the primary search intent.',
        'Refresh metadata and add clearer internal-link pathways.',
      ],
    })),
    nextActions: candidates.slice(0, 6).map((candidate) => `Review ${candidate.pathname} for rewrite, QA, and internal-link follow-up.`),
    risks: [
      'Pages with thin copy may need manual editorial expansion before expecting ranking gains.',
      'Programmatic surfaces should keep copy changes constrained to avoid duplicate-content drift.',
    ],
  };
}

function buildMockRewriteSuggestions(candidates) {
  return {
    suggestions: candidates.map((candidate) => ({
      pathname: candidate.pathname,
      priority: candidate.ctrGap > 0.02 || candidate.page.issues.length > 0 ? 'high' : 'medium',
      confidence: 0.72,
      suggestedTitle: candidate.page.title || candidate.label,
      suggestedMetaDescription: candidate.page.description || `Improve ${candidate.label} with clearer search-intent coverage and stronger internal links on AI Prompt Index.`,
      openingRewrite: `Lead with a tighter explanation of what the page helps the reader do, then show the fastest path to the most useful prompt or resource.`,
      sectionSuggestions: [
        'Add a stronger above-the-fold answer to the core query.',
        'Introduce one scannable comparison or checklist section.',
        'Tie at least one section heading directly to the current top keyword.',
      ],
      faqSuggestions: [
        `What is the fastest way to use ${candidate.label}?`,
        `How does ${candidate.label} compare to adjacent prompt options?`,
      ],
      rationale: candidate.evidenceSummary || 'Selected as a candidate for on-site SEO refinement.',
    })),
  };
}

function buildMockInternalLinkSuggestions(candidates) {
  return {
    suggestions: candidates.map((candidate) => ({
      pathname: candidate.pathname,
      priority: 'medium',
      confidence: 0.7,
      links: candidate.linkOptions.slice(0, 3).map((option) => ({
        targetPathname: option.pathname,
        suggestedAnchor: option.label,
        rationale: `High topical relevance (${Math.round(option.relevance * 100)}%) based on the current page theme.`,
      })),
    })),
  };
}

function buildMockQaAudits(candidates) {
  return {
    audits: candidates.map((candidate) => ({
      pathname: candidate.pathname,
      priority: candidate.page.issues.length > 0 ? 'high' : 'medium',
      confidence: 0.71,
      strengths: [
        candidate.page.title ? 'Page has a defined title tag.' : 'Page exists in the site inventory.',
        candidate.ahrefs?.topKeyword ? `Already maps to the keyword "${candidate.ahrefs.topKeyword}".` : 'Fits an indexed site surface.',
      ],
      issues: candidate.page.issues.slice(0, 5).map((issue) => ({
        severity: issue.includes('missing') || issue.includes('http') ? 'high' : 'medium',
        type: issue,
        description: issue,
      })),
      opportunities: [
        'Strengthen the intro so the primary intent is answered in the first screenful.',
        'Add more explicit internal links to adjacent pages in the same topic cluster.',
      ],
      snippetOpportunity: 'Convert one high-value section into a direct answer or step list for snippet eligibility.',
      faqOpportunity: 'Add 2-3 concise FAQs that target adjacent long-tail questions.',
    })),
  };
}

function renderAiBriefMarkdown(artifact) {
  const lines = [
    '# AI SEO Brief',
    '',
    `Generated: ${artifact.generatedAt}`,
    `Input date: ${artifact.inputDate}`,
    `Model: ${artifact.model}`,
    '',
    artifact.summary,
    '',
    '## Priorities',
    '',
  ];

  for (const item of artifact.priorities) {
    lines.push(`- [${item.priority}] ${item.title}: ${item.why}`);
    item.evidence.forEach((evidence) => lines.push(`  - Evidence: ${evidence}`));
    item.recommendedActions.forEach((action) => lines.push(`  - Action: ${action}`));
  }

  lines.push('', '## Next Actions', '');
  artifact.nextActions.forEach((action) => lines.push(`- ${action}`));
  lines.push('', '## Risks', '');
  artifact.risks.forEach((risk) => lines.push(`- ${risk}`));
  lines.push('');

  return lines.join('\n');
}

function renderRewriteMarkdown(artifact) {
  const lines = [
    '# Rewrite Suggestions',
    '',
    `Generated: ${artifact.generatedAt}`,
    `Input date: ${artifact.inputDate}`,
    `Model: ${artifact.model}`,
    '',
  ];

  for (const suggestion of artifact.suggestions) {
    lines.push(`## ${suggestion.pathname}`);
    lines.push('');
    lines.push(`- Surface: ${suggestion.surface}`);
    lines.push(`- Priority: ${suggestion.priority}`);
    lines.push(`- Confidence: ${suggestion.confidence}`);
    lines.push(`- Suggested title: ${suggestion.suggestedTitle}`);
    lines.push(`- Suggested meta description: ${suggestion.suggestedMetaDescription}`);
    lines.push(`- Rationale: ${suggestion.rationale}`);
    lines.push(`- Source evidence: ${suggestion.sourceEvidenceSummary}`);
    lines.push('');
    lines.push('### Opening Rewrite');
    lines.push('');
    lines.push(suggestion.openingRewrite);
    lines.push('');
    lines.push('### Section Suggestions');
    lines.push('');
    suggestion.sectionSuggestions.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
    lines.push('### FAQ Suggestions');
    lines.push('');
    suggestion.faqSuggestions.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  return lines.join('\n');
}

function renderInternalLinksMarkdown(artifact) {
  const lines = [
    '# Internal Link Suggestions',
    '',
    `Generated: ${artifact.generatedAt}`,
    `Input date: ${artifact.inputDate}`,
    `Model: ${artifact.model}`,
    '',
  ];

  for (const suggestion of artifact.suggestions) {
    lines.push(`## ${suggestion.pathname}`);
    lines.push('');
    lines.push(`- Surface: ${suggestion.surface}`);
    lines.push(`- Priority: ${suggestion.priority}`);
    lines.push(`- Confidence: ${suggestion.confidence}`);
    lines.push(`- Source evidence: ${suggestion.sourceEvidenceSummary}`);
    lines.push('');
    suggestion.links.forEach((link) => {
      lines.push(`- Link to \`${link.targetPathname}\` with anchor "${link.suggestedAnchor}": ${link.rationale}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

function renderQaMarkdown(artifact) {
  const lines = [
    '# Content QA',
    '',
    `Generated: ${artifact.generatedAt}`,
    `Input date: ${artifact.inputDate}`,
    `Model: ${artifact.model}`,
    '',
  ];

  for (const audit of artifact.audits) {
    lines.push(`## ${audit.pathname}`);
    lines.push('');
    lines.push(`- Surface: ${audit.surface}`);
    lines.push(`- Priority: ${audit.priority}`);
    lines.push(`- Confidence: ${audit.confidence}`);
    lines.push(`- Source evidence: ${audit.sourceEvidenceSummary}`);
    lines.push('');
    lines.push('### Strengths');
    lines.push('');
    audit.strengths.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
    lines.push('### Issues');
    lines.push('');
    audit.issues.forEach((item) => lines.push(`- [${item.severity}] ${item.type}: ${item.description}`));
    lines.push('');
    lines.push('### Opportunities');
    lines.push('');
    audit.opportunities.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
    lines.push(`- Snippet opportunity: ${audit.snippetOpportunity}`);
    lines.push(`- FAQ opportunity: ${audit.faqOpportunity}`);
    lines.push('');
  }

  return lines.join('\n');
}

function normalizeRewriteArtifact(raw, candidatesByPath) {
  const suggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
  return suggestions
    .map((item) => {
      const candidate = candidatesByPath.get(normalizePathname(item.pathname));
      if (!candidate) return null;
      return {
        pathname: candidate.pathname,
        surface: candidate.surface,
        priority: normalizePriority(item.priority),
        confidence: clampConfidence(item.confidence),
        suggestedTitle: String(item.suggestedTitle || candidate.page.title || candidate.label),
        suggestedMetaDescription: String(item.suggestedMetaDescription || candidate.page.description || ''),
        openingRewrite: String(item.openingRewrite || ''),
        sectionSuggestions: Array.isArray(item.sectionSuggestions) ? item.sectionSuggestions.map(String).slice(0, 4) : [],
        faqSuggestions: Array.isArray(item.faqSuggestions) ? item.faqSuggestions.map(String).slice(0, 4) : [],
        rationale: String(item.rationale || candidate.evidenceSummary || ''),
        sourceEvidence: buildSourceEvidence(candidate),
        sourceEvidenceSummary: candidate.evidenceSummary,
      };
    })
    .filter(Boolean);
}

function normalizeInternalLinkArtifact(raw, candidatesByPath) {
  const suggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
  return suggestions
    .map((item) => {
      const candidate = candidatesByPath.get(normalizePathname(item.pathname));
      if (!candidate) return null;
      const allowedTargets = new Set(candidate.linkOptions.map((option) => option.pathname));
      const links = Array.isArray(item.links) ? item.links : [];
      const normalizedLinks = links
        .map((link) => ({
          targetPathname: normalizePathname(link.targetPathname),
          suggestedAnchor: String(link.suggestedAnchor || ''),
          rationale: String(link.rationale || ''),
        }))
        .filter((link) => allowedTargets.has(link.targetPathname))
        .slice(0, 3);

      return {
        pathname: candidate.pathname,
        surface: candidate.surface,
        priority: normalizePriority(item.priority),
        confidence: clampConfidence(item.confidence),
        links: normalizedLinks,
        sourceEvidence: buildSourceEvidence(candidate),
        sourceEvidenceSummary: candidate.evidenceSummary,
      };
    })
    .filter((item) => item && item.links.length > 0);
}

function normalizeQaArtifact(raw, candidatesByPath) {
  const audits = Array.isArray(raw.audits) ? raw.audits : [];
  return audits
    .map((item) => {
      const candidate = candidatesByPath.get(normalizePathname(item.pathname));
      if (!candidate) return null;
      const issues = Array.isArray(item.issues) ? item.issues : [];
      return {
        pathname: candidate.pathname,
        surface: candidate.surface,
        priority: normalizePriority(item.priority),
        confidence: clampConfidence(item.confidence),
        strengths: Array.isArray(item.strengths) ? item.strengths.map(String).slice(0, 4) : [],
        issues: issues.map((issue) => ({
          severity: normalizePriority(issue.severity, 'medium'),
          type: String(issue.type || 'issue'),
          description: String(issue.description || ''),
        })).slice(0, 5),
        opportunities: Array.isArray(item.opportunities) ? item.opportunities.map(String).slice(0, 4) : [],
        snippetOpportunity: String(item.snippetOpportunity || ''),
        faqOpportunity: String(item.faqOpportunity || ''),
        sourceEvidence: buildSourceEvidence(candidate),
        sourceEvidenceSummary: candidate.evidenceSummary,
      };
    })
    .filter(Boolean);
}

async function main() {
  const warnings = [];
  const artifacts = {
    gscPages: readOutputJson('gsc-pages.json'),
    ga4: readOutputJson('ga4-landing-pages.json'),
    ahrefsTopPages: readOutputJson('ahrefs-top-pages.json'),
    contentBriefs: readOutputJson('content-briefs.json'),
    keywordGaps: readOutputJson('keyword-gaps.json'),
    liveVerification: readOutputJson('live-verification.json'),
  };

  const inventory = loadSiteInventory();
  const candidateRecords = buildCandidateRecords(inventory, artifacts);
  const selectedCandidates = selectCandidates(candidateRecords);

  for (const candidate of selectedCandidates) {
    candidate.page = await fetchPageSnapshot(candidate.pathname);
    candidate.linkOptions = findLinkOptions(candidate, inventory);
    if (!candidate.page.ok) {
      warnings.push(`Page snapshot degraded for ${candidate.pathname}: ${candidate.page.issues.join(', ')}`);
    }
  }

  const candidatesByPath = new Map(selectedCandidates.map((candidate) => [candidate.pathname, candidate]));
  const rewriteCandidates = selectedCandidates.slice(0, rewriteLimit);
  const linkCandidates = selectedCandidates.slice(0, linkLimit);
  const qaCandidates = selectedCandidates.slice(0, qaLimit);

  const rawAiBrief = await requestJsonFromClaude(
    'ai-brief',
    buildAiBriefPrompt(artifacts, selectedCandidates),
    () => buildMockAiBrief(selectedCandidates)
  );
  const rawRewrite = await requestJsonFromClaude(
    'rewrite-suggestions',
    buildRewritePrompt(rewriteCandidates),
    () => buildMockRewriteSuggestions(rewriteCandidates)
  );
  const rawInternalLinks = await requestJsonFromClaude(
    'internal-link-suggestions',
    buildInternalLinksPrompt(linkCandidates),
    () => buildMockInternalLinkSuggestions(linkCandidates)
  );
  const rawQa = await requestJsonFromClaude(
    'content-qa',
    buildQaPrompt(qaCandidates),
    () => buildMockQaAudits(qaCandidates)
  );

  const aiBriefArtifact = getArtifactEnvelope({
    source: 'anthropic-seo-ai-brief',
    generatedAt: new Date().toISOString(),
    status: 'ok',
    warnings,
    inputDate,
    siteUrl,
    model: mockAi ? 'mock-ai' : model,
    candidateCount: selectedCandidates.length,
    summary: String(rawAiBrief.summary || ''),
    priorities: Array.isArray(rawAiBrief.priorities)
      ? rawAiBrief.priorities.slice(0, 5).map((item) => ({
        priority: normalizePriority(item.priority),
        title: String(item.title || ''),
        why: String(item.why || ''),
        evidence: Array.isArray(item.evidence) ? item.evidence.map(String).slice(0, 5) : [],
        recommendedActions: Array.isArray(item.recommendedActions) ? item.recommendedActions.map(String).slice(0, 5) : [],
      }))
      : [],
    nextActions: Array.isArray(rawAiBrief.nextActions) ? rawAiBrief.nextActions.map(String).slice(0, 8) : [],
    risks: Array.isArray(rawAiBrief.risks) ? rawAiBrief.risks.map(String).slice(0, 6) : [],
  });

  const rewriteArtifact = getArtifactEnvelope({
    source: 'anthropic-seo-rewrite-suggestions',
    generatedAt: new Date().toISOString(),
    status: 'ok',
    warnings,
    inputDate,
    siteUrl,
    model: mockAi ? 'mock-ai' : model,
    suggestions: normalizeRewriteArtifact(rawRewrite, candidatesByPath),
  });

  const internalLinksArtifact = getArtifactEnvelope({
    source: 'anthropic-seo-internal-links',
    generatedAt: new Date().toISOString(),
    status: 'ok',
    warnings,
    inputDate,
    siteUrl,
    model: mockAi ? 'mock-ai' : model,
    suggestions: normalizeInternalLinkArtifact(rawInternalLinks, candidatesByPath),
  });

  const qaArtifact = getArtifactEnvelope({
    source: 'anthropic-seo-content-qa',
    generatedAt: new Date().toISOString(),
    status: 'ok',
    warnings,
    inputDate,
    siteUrl,
    model: mockAi ? 'mock-ai' : model,
    audits: normalizeQaArtifact(rawQa, candidatesByPath),
  });

  writeJson(path.join(outputDir, 'ai-brief.json'), aiBriefArtifact);
  writeText(path.join(outputDir, 'ai-brief.md'), renderAiBriefMarkdown(aiBriefArtifact));
  writeJson(path.join(outputDir, 'rewrite-suggestions.json'), rewriteArtifact);
  writeText(path.join(outputDir, 'rewrite-suggestions.md'), renderRewriteMarkdown(rewriteArtifact));
  writeJson(path.join(outputDir, 'internal-link-suggestions.json'), internalLinksArtifact);
  writeText(path.join(outputDir, 'internal-link-suggestions.md'), renderInternalLinksMarkdown(internalLinksArtifact));
  writeJson(path.join(outputDir, 'content-qa.json'), qaArtifact);
  writeText(path.join(outputDir, 'content-qa.md'), renderQaMarkdown(qaArtifact));

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    inputDate,
    model: mockAi ? 'mock-ai' : model,
    candidateCount: selectedCandidates.length,
    rewriteSuggestions: rewriteArtifact.suggestions.length,
    internalLinkSuggestions: internalLinksArtifact.suggestions.length,
    qaAudits: qaArtifact.audits.length,
    warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
