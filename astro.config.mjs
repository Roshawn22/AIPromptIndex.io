// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

const repoRoot = process.cwd();
const promptsDirPath = path.join(repoRoot, 'src/data/prompts');
const blogDirPath = path.join(repoRoot, 'src/data/blog');
const guidesDirPath = path.join(repoRoot, 'src/data/guides');

/**
 * @template T
 * @param {string} filePath
 * @param {T} fallback
 * @returns {T | any}
 */
function loadJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

/**
 * @param {string} pathname
 */
function normalizePathname(pathname) {
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withLeadingSlash.replace(/\/$/, '') || '/';
}

/**
 * @param {string | number | Date | undefined | null} value
 * @returns {Date | null}
 */
function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

/**
 * @param {Date | null | undefined} value
 * @returns {string | null}
 */
function toSitemapDate(value) {
  return value ? value.toISOString() : null;
}

/**
 * @param {(Date | null | undefined)[]} dates
 */
function maxDate(dates) {
  return dates.reduce((latest, current) => {
    if (!current) return latest;
    return !latest || current > latest ? current : latest;
  }, /** @type {Date | null} */ (null));
}

/**
 * @param {string} dirPath
 * @param {string} extension
 */
function listFiles(dirPath, extension) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((fileName) => fileName.endsWith(extension))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} filePath
 */
function readFrontmatter(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/**
 * @param {string} frontmatter
 * @param {string} key
 */
function readFrontmatterValue(frontmatter, key) {
  const patterns = [
    new RegExp(`^${key}:\\s*"([^"]*)"`, 'm'),
    new RegExp(`^${key}:\\s*'([^']*)'`, 'm'),
    new RegExp(`^${key}:\\s*([^\\n]+)`, 'm'),
  ];
  for (const pattern of patterns) {
    const match = frontmatter.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

const publishedPrompts = listFiles(promptsDirPath, '.json')
  .map((fileName) => loadJsonFile(path.join(promptsDirPath, fileName), null))
  .filter((prompt) => prompt && prompt.slug)
  .map((prompt) => ({
    ...prompt,
    lastUpdatedDate: parseDate(prompt.lastUpdated || prompt.dateAdded),
  }));

const blogPosts = listFiles(blogDirPath, '.md').map((fileName) => {
  const filePath = path.join(blogDirPath, fileName);
  const frontmatter = readFrontmatter(filePath);
  return {
    slug: fileName.replace(/\.md$/, ''),
    lastUpdatedDate: parseDate(
      readFrontmatterValue(frontmatter, 'updatedDate') ||
      readFrontmatterValue(frontmatter, 'pubDate')
    ),
  };
});

const guides = listFiles(guidesDirPath, '.md').map((fileName) => {
  const filePath = path.join(guidesDirPath, fileName);
  const frontmatter = readFrontmatter(filePath);
  return {
    slug: fileName.replace(/\.md$/, ''),
    lastUpdatedDate: parseDate(
      readFrontmatterValue(frontmatter, 'updatedDate') ||
      readFrontmatterValue(frontmatter, 'pubDate')
    ),
  };
});

const staticNoindexPaths = new Set(['/404', '/contact', '/privacy', '/submit']);

function buildRouteLastmodMap() {
  /** @type {Map<string, string>} */
  const routeDates = new Map();
  /**
   * @param {string} pathname
   * @param {Date | null | undefined} date
   */
  const addRouteDate = (pathname, date) => {
    const sitemapDate = toSitemapDate(date);
    if (!sitemapDate) return;
    routeDates.set(normalizePathname(pathname), sitemapDate);
  };

  const latestPromptDate = maxDate(publishedPrompts.map((p) => p.lastUpdatedDate));
  const latestBlogDate = maxDate(blogPosts.map((p) => p.lastUpdatedDate));
  const latestGuideDate = maxDate(guides.map((g) => g.lastUpdatedDate));

  addRouteDate('/', latestPromptDate);
  addRouteDate('/prompts', latestPromptDate);
  addRouteDate('/blog', latestBlogDate);
  addRouteDate('/guides', latestGuideDate);

  for (const prompt of publishedPrompts) {
    addRouteDate(`/prompts/${prompt.slug}`, prompt.lastUpdatedDate);
  }
  for (const post of blogPosts) {
    addRouteDate(`/blog/${post.slug}`, post.lastUpdatedDate);
  }
  for (const guide of guides) {
    addRouteDate(`/guides/${guide.slug}`, guide.lastUpdatedDate);
  }

  return routeDates;
}

const routeLastmodMap = buildRouteLastmodMap();

export default defineConfig({
  site: 'https://aipromptindex.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const pathname = normalizePathname(new URL(page).pathname);
        return !staticNoindexPaths.has(pathname);
      },
      serialize: (item) => {
        const pathname = normalizePathname(new URL(item.url, 'https://aipromptindex.io').pathname);
        const lastmod = routeLastmodMap.get(pathname);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      target: 'es2019',
      rollupOptions: {
        output: {
          manualChunks: {
            fuse: ['fuse.js'],
            convex: ['convex/browser'],
            radix: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          },
        },
      },
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
