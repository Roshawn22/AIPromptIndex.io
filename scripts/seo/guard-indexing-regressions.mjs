import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const sourceRoots = [
  'src/components',
  'src/data',
  'src/layouts',
  'src/pages',
].map((relativePath) => path.join(repoRoot, relativePath));

const distRoot = path.join(repoRoot, 'dist');

const blockedSourcePatterns = [
  /\/prompts\/?\?type=/,
  /\/prompts\/?\?category=/,
  /https:\/\/aipromptindex\.io\/prompts\/?\?type=/,
  /https:\/\/aipromptindex\.io\/prompts\/?\?category=/,
];

const textExtensions = new Set([
  '.astro',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.xml',
]);

function walkFiles(startPath) {
  if (!fs.existsSync(startPath)) return [];
  const entries = fs.readdirSync(startPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(filePath) {
  return path.relative(repoRoot, filePath);
}

function findPatternIssues(files, patterns, label) {
  const issues = [];

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split('\n');

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          issues.push({
            label,
            file: relative(filePath),
            line: index + 1,
            text: line.trim(),
          });
        }
      }
    });
  }

  return issues;
}

function findSitemapQueryUrls() {
  const issues = [];
  const sitemapFiles = walkFiles(distRoot).filter((filePath) => /sitemap.*\.xml$/.test(path.basename(filePath)));

  for (const filePath of sitemapFiles) {
    const text = fs.readFileSync(filePath, 'utf8');
    for (const match of text.matchAll(/<loc>(.*?)<\/loc>/g)) {
      const url = match[1];
      if (url.includes('?')) {
        issues.push({
          label: 'sitemap query URL',
          file: relative(filePath),
          line: 1,
          text: url,
        });
      }
    }
  }

  return issues;
}

const sourceFiles = sourceRoots.flatMap(walkFiles);
const distFiles = walkFiles(distRoot);
const htmlFiles = distFiles.filter((filePath) => path.extname(filePath) === '.html');

const issues = [
  ...findPatternIssues(sourceFiles, blockedSourcePatterns, 'source prompt query link'),
  ...findPatternIssues(htmlFiles, blockedSourcePatterns, 'built prompt query link'),
  ...findSitemapQueryUrls(),
];

if (issues.length > 0) {
  console.error('Indexing regression guard failed:');
  for (const issue of issues) {
    console.error(`- ${issue.label}: ${issue.file}:${issue.line}`);
    console.error(`  ${issue.text}`);
  }
  process.exit(1);
}

console.log(`Indexing regression guard passed (${sourceFiles.length} source files, ${htmlFiles.length} built HTML files).`);
