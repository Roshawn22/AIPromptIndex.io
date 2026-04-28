import path from 'node:path';

import {
  defaultSiteUrl,
  getSeoOutputDir,
  parseCliArgs,
  writeJson,
  writeText,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const siteUrl = (args.site || process.env.PUBLIC_SITE_URL || defaultSiteUrl).replace(/\/$/, '');

const samplePages = [
  { label: 'homepage', pathname: '/' },
  { label: 'prompt', pathname: '/prompts/business-plan-executive-summary/' },
  { label: 'guide', pathname: '/guides/prompt-engineering-101/' },
  { label: 'blog', pathname: '/blog/how-to-write-ai-prompts-beginners-guide/' },
  { label: 'programmatic', pathname: '/prompts/for/teachers/' },
];

function extractAll(pattern, input) {
  return [...input.matchAll(pattern)].map((match) => match[1] || match[0]);
}

function extractOne(pattern, input) {
  const match = input.match(pattern);
  return match?.[1] || null;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Codex SEO verifier',
    },
  });

  return {
    url,
    status: response.status,
    ok: response.ok,
    text: await response.text(),
  };
}

function inspectHtmlPage(label, pathname, response) {
  const html = response.text;
  const title = extractOne(/<title>([^<]+)<\/title>/i, html);
  const canonical = extractOne(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i, html);
  const robots = extractOne(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i, html);
  const description = extractOne(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, html);
  const ogImage = extractOne(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, html);
  const jsonLdCount = extractAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi, html).length;

  const checks = {
    canonical: Boolean(canonical),
    robots: Boolean(robots),
    description: Boolean(description),
    ogImage: Boolean(ogImage),
    jsonLd: jsonLdCount > 0,
    googleVerification: /<meta[^>]+name=["']google-site-verification["']/i.test(html),
    ahrefsVerification: /<meta[^>]+name=["']ahrefs-site-verification["']/i.test(html),
    semrushVerification: /<meta[^>]+name=["']semrush-site-verification["']/i.test(html),
    gaLoader: /www\.googletagmanager\.com\/gtag\/js/i.test(html),
    ahrefsAnalytics: /analytics\.ahrefs\.com\/analytics\.js/i.test(html),
  };

  const issues = [];
  if (!response.ok) issues.push(`HTTP ${response.status}`);
  if (!checks.canonical) issues.push('missing canonical');
  if (!checks.robots) issues.push('missing robots meta');
  if (!checks.description) issues.push('missing meta description');
  if (!checks.ogImage) issues.push('missing og:image');
  if (!checks.jsonLd) issues.push('missing JSON-LD');
  if (label === 'homepage' && !checks.googleVerification) issues.push('missing Google verification');
  if (label === 'homepage' && !checks.ahrefsVerification) issues.push('missing Ahrefs verification');
  if (label === 'homepage' && !checks.gaLoader) issues.push('missing GA loader');
  if (label === 'homepage' && !checks.ahrefsAnalytics) issues.push('missing Ahrefs analytics loader');

  return {
    label,
    pathname,
    url: response.url,
    status: response.status,
    title,
    canonical,
    robots,
    description,
    ogImage,
    jsonLdCount,
    checks,
    issues,
  };
}

function inspectRobots(response) {
  const body = response.text;
  return {
    url: response.url,
    status: response.status,
    hasSitemap: /Sitemap:\s+https:\/\/aipromptindex\.io\/sitemap-index\.xml/i.test(body),
    allowsAll: /User-agent:\s+\*\s+Allow:\s+\//is.test(body),
    disallowsApi: /Disallow:\s+\/api\//i.test(body),
  };
}

function inspectSitemapIndex(response) {
  return {
    url: response.url,
    status: response.status,
    sitemaps: extractAll(/<loc>([^<]+)<\/loc>/gi, response.text),
  };
}

function inspectSitemap(response) {
  const locs = extractAll(/<loc>([^<]+)<\/loc>/gi, response.text);
  return {
    url: response.url,
    status: response.status,
    urlCount: locs.length,
    sample: locs.slice(0, 10),
  };
}

function renderMarkdown(report) {
  const lines = [
    '# SEO Live Verification',
    '',
    `Generated: ${report.generatedAt}`,
    `Site: ${report.siteUrl}`,
    '',
    '## Core Checks',
    '',
    `- Robots reachable: ${report.robots.status === 200 ? 'yes' : `no (${report.robots.status})`}`,
    `- Sitemap index reachable: ${report.sitemapIndex.status === 200 ? 'yes' : `no (${report.sitemapIndex.status})`}`,
    `- Sitemap URL count: ${report.sitemap.urlCount}`,
    `- Homepage missing checks: ${report.homepage.issues.join(', ') || 'none'}`,
    '',
    '## Sample Pages',
    '',
  ];

  for (const page of report.pages) {
    lines.push(`- ${page.label} ${page.pathname}: ${page.issues.join(', ') || 'ok'}`);
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  const generatedAt = new Date().toISOString();
  const robotsResponse = await fetchText(`${siteUrl}/robots.txt`);
  const sitemapIndexResponse = await fetchText(`${siteUrl}/sitemap-index.xml`);
  const sitemapResponse = await fetchText(`${siteUrl}/sitemap-0.xml`);
  const pageResponses = await Promise.all(samplePages.map((page) => fetchText(`${siteUrl}${page.pathname}`)));

  const pages = pageResponses.map((response, index) => (
    inspectHtmlPage(samplePages[index].label, samplePages[index].pathname, response)
  ));
  const homepage = pages.find((page) => page.label === 'homepage');

  const report = {
    generatedAt,
    siteUrl,
    homepage,
    pages,
    robots: inspectRobots(robotsResponse),
    sitemapIndex: inspectSitemapIndex(sitemapIndexResponse),
    sitemap: inspectSitemap(sitemapResponse),
  };

  writeJson(path.join(outputDir, 'live-verification.json'), report);
  writeText(path.join(outputDir, 'live-verification.md'), renderMarkdown(report));

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    siteUrl,
    homepageIssues: homepage.issues,
    sitemapUrlCount: report.sitemap.urlCount,
    samplePageIssues: Object.fromEntries(pages.map((page) => [page.label, page.issues])),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
