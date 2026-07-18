import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  defaultSiteUrl,
  getSeoOutputDir,
  optionalEnv,
  parseCliArgs,
  writeJson,
  writeText,
} from './_shared.mjs';

const args = parseCliArgs();
const outputDir = getSeoOutputDir(args);
const siteUrl = (args.site || process.env.PUBLIC_SITE_URL || defaultSiteUrl).replace(/\/$/, '');
const promptPath = normalizePathname(args.path || '/prompts/business-plan-executive-summary/');
const promptUrl = `${siteUrl}${promptPath}`;
const expectedMeasurementId = args.measurementId || optionalEnv('PUBLIC_GA_MEASUREMENT_ID');
const waitMs = Number(args.waitMs || 1500);
const sessionName = args.session || `ga4-live-${Date.now().toString(36)}`;
const pwcliPath = resolvePwcliPath();

function normalizePathname(value) {
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
}

function resolvePwcliPath() {
  const candidates = [
    process.env.PWCLI,
    process.env.PLAYWRIGHT_CLI,
    path.join(os.homedir(), '.codex', 'skills', 'playwright', 'scripts', 'playwright_cli.sh'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    'Unable to find Playwright CLI wrapper. Set PWCLI or PLAYWRIGHT_CLI to ~/.codex/skills/playwright/scripts/playwright_cli.sh.'
  );
}

function runPwcli(commandArgs) {
  return execFileSync(pwcliPath, ['--session', sessionName, ...commandArgs], {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function extractResultBlock(raw) {
  const marker = '### Result';
  const start = raw.indexOf(marker);
  if (start === -1) return null;

  const afterMarker = raw.slice(start + marker.length).replace(/^\s*\n/, '');
  const nextHeadingIndex = afterMarker.indexOf('\n### ');
  return (nextHeadingIndex === -1 ? afterMarker : afterMarker.slice(0, nextHeadingIndex)).trim();
}

function parseJsonStringResult(raw) {
  const resultBlock = extractResultBlock(raw);
  if (!resultBlock) return null;

  const firstPass = JSON.parse(resultBlock);
  return typeof firstPass === 'string' ? JSON.parse(firstPass) : firstPass;
}

function parseStringResult(raw) {
  const resultBlock = extractResultBlock(raw);
  if (!resultBlock) return null;

  try {
    const parsed = JSON.parse(resultBlock);
    return typeof parsed === 'string' ? parsed : String(parsed);
  } catch {
    return resultBlock;
  }
}

function parseConsoleSummary(raw) {
  const resultBlock = extractResultBlock(raw);
  if (!resultBlock) return null;
  const match = resultBlock.match(/Total messages:\s+(\d+)\s+\(Errors:\s+(\d+), Warnings:\s+(\d+)\)/i);
  if (!match) return null;

  return {
    total: Number(match[1]),
    errors: Number(match[2]),
    warnings: Number(match[3]),
  };
}

function renderMarkdown(report) {
  const lines = [
    '# GA4 Live Verification',
    '',
    `Generated: ${report.generatedAt}`,
    `Site: ${report.siteUrl}`,
    `Prompt URL: ${report.promptUrl}`,
    `Session: ${report.sessionName}`,
    '',
    '## Summary',
    '',
    `- Measurement ID expected: ${report.expectedMeasurementId || 'not provided'}`,
    `- Measurement ID seen: ${report.pageState.configEntries[0]?.measurementId || 'none'}`,
    `- gtag present: ${report.pageState.hasGtag ? 'yes' : 'no'}`,
    `- dataLayer present: ${report.pageState.dataLayerIsArray ? 'yes' : 'no'}`,
    `- dataLayer length: ${report.pageState.dataLayerLength ?? 'n/a'}`,
    `- Copy button found: ${report.copyAction.found ? 'yes' : 'no'}`,
    `- Console errors: ${report.consoleSummary?.errors ?? 'n/a'}`,
    '',
    '## Event Checks',
    '',
    `- page_view seen: ${report.checks.pageView ? 'yes' : 'no'}`,
    `- prompt_viewed seen: ${report.checks.promptViewed ? 'yes' : 'no'}`,
    `- prompt_copied seen: ${report.checks.promptCopied ? 'yes' : 'no'}`,
    `- prompt params complete: ${report.checks.promptParamsComplete ? 'yes' : 'no'}`,
    '',
    '## dataLayer',
    '',
  ];

  for (const event of report.pageState.promptViewedEvents) {
    lines.push(
      `- ${event.eventName || 'unknown'} slug=${event.payload?.prompt_slug || '-'} tool=${event.payload?.tool || '-'} category=${event.payload?.category || '-'}`
    );
  }

  lines.push('', '## gtag Spy', '');

  for (const call of report.gtagSpyCalls) {
    lines.push(
      `- ${call.command || 'unknown'} ${call.eventName || ''} slug=${call.payload?.prompt_slug || '-'} tool=${call.payload?.tool || '-'} category=${call.payload?.category || '-'}`
    );
  }

  if (report.issues.length > 0) {
    lines.push('', '## Issues', '');
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  const generatedAt = new Date().toISOString();
  const reportPathJson = path.join(outputDir, 'ga4-live-verification.json');
  const reportPathMd = path.join(outputDir, 'ga4-live-verification.md');

  let report;

  try {
    runPwcli(['open', promptUrl]);

    const pageState = parseJsonStringResult(runPwcli([
      'eval',
      `() => JSON.stringify({
        title: document.title,
        hasGtag: typeof window.gtag === 'function',
        dataLayerIsArray: Array.isArray(window.dataLayer),
        dataLayerLength: Array.isArray(window.dataLayer) ? window.dataLayer.length : null,
        dataLayerHead: Array.isArray(window.dataLayer) ? window.dataLayer.slice(0, 5) : [],
        configEntries: Array.isArray(window.dataLayer)
          ? window.dataLayer
              .filter((entry) => entry && typeof entry === 'object' && entry[0] === 'config')
              .map((entry) => ({ measurementId: entry[1], payload: entry[2] || null }))
          : [],
        promptViewedEvents: Array.isArray(window.dataLayer)
          ? window.dataLayer
              .filter((entry) => entry && typeof entry === 'object' && entry[0] === 'event' && entry[1] === 'prompt_viewed')
              .map((entry) => ({ eventName: entry[1], payload: entry[2] || null }))
          : []
      })`,
    ]));

    parseJsonStringResult(runPwcli([
      'eval',
      `() => {
        window.__ga4LiveCalls = [];
        const originalGtag = window.gtag;
        if (typeof originalGtag !== 'function') {
          return JSON.stringify({ installed: false, hasGtag: false });
        }
        window.gtag = function(...args) {
          window.__ga4LiveCalls.push(args);
          return originalGtag.apply(this, args);
        };
        return JSON.stringify({ installed: true, hasGtag: true });
      }`,
    ]));

    const copyActionResult = parseStringResult(runPwcli([
      'eval',
      `() => {
        const button = [...document.querySelectorAll('button')].find((element) =>
          /Copy Prompt/i.test((element.textContent || '').trim())
        );
        if (!button) return JSON.stringify({ found: false, label: null });
        button.click();
        return JSON.stringify({ found: true, label: (button.textContent || '').trim() });
      }`,
    ]));

    sleep(waitMs);

    const consoleSummary = parseConsoleSummary(runPwcli(['console', 'error']));
    const copyAction = copyActionResult ? JSON.parse(copyActionResult) : { found: false, label: null };
    const gtagSpyCalls = parseJsonStringResult(runPwcli([
      'eval',
      `() => JSON.stringify(
        Array.isArray(window.__ga4LiveCalls)
          ? window.__ga4LiveCalls.map((args) => ({
              command: args[0] || null,
              eventName: args[1] || null,
              payload: args[2] || null
            }))
          : []
      )`,
    ]));

    const configEntries = pageState?.configEntries || [];
    const promptViewedEvents = pageState?.promptViewedEvents || [];
    const spyCalls = gtagSpyCalls || [];

    const pageConfigEntry = configEntries.find((entry) => entry.measurementId);
    const promptViewedEvent = promptViewedEvents.find((entry) => entry.eventName === 'prompt_viewed');
    const promptCopiedCall = spyCalls.find((call) => call.command === 'event' && call.eventName === 'prompt_copied');

    const issues = [];
    if (!pageState?.hasGtag) issues.push('gtag was not available on the live page');
    if (!pageState?.dataLayerIsArray) issues.push('dataLayer was not available on the live page');
    if (!pageConfigEntry?.measurementId) issues.push('Missing GA config entry in dataLayer');
    if (expectedMeasurementId && pageConfigEntry?.measurementId !== expectedMeasurementId) {
      issues.push(`Expected GA measurement ID ${expectedMeasurementId}, found ${pageConfigEntry?.measurementId || 'none'}`);
    }
    if (!pageConfigEntry) issues.push('Missing GA page config on the live page');
    if (!promptViewedEvent) issues.push('Missing prompt_viewed event in dataLayer');
    if (!promptCopiedCall) issues.push('Missing prompt_copied gtag call after clicking Copy Prompt');
    if (promptViewedEvent && !(promptViewedEvent.payload?.prompt_slug && promptViewedEvent.payload?.tool && promptViewedEvent.payload?.category)) {
      issues.push('prompt_viewed event is missing one or more custom params');
    }
    if (promptCopiedCall && !(promptCopiedCall.payload?.prompt_slug && promptCopiedCall.payload?.tool && promptCopiedCall.payload?.category)) {
      issues.push('prompt_copied call is missing one or more custom params');
    }
    if (!copyAction?.found) issues.push('Copy Prompt button was not found on the live page');
    if ((consoleSummary?.errors || 0) > 0) issues.push(`Browser console reported ${consoleSummary.errors} error(s)`);

    report = {
      generatedAt,
      siteUrl,
      promptUrl,
      sessionName,
      expectedMeasurementId,
      pageState,
      copyAction,
      gtagSpyCalls,
      consoleSummary,
      checks: {
        pageView: Boolean(pageConfigEntry),
        promptViewed: Boolean(promptViewedEvent),
        promptCopied: Boolean(promptCopiedCall),
        promptParamsComplete: Boolean(
          promptViewedEvent?.payload?.prompt_slug &&
          promptViewedEvent?.payload?.tool &&
          promptViewedEvent?.payload?.category &&
          promptCopiedCall?.payload?.prompt_slug &&
          promptCopiedCall?.payload?.tool &&
          promptCopiedCall?.payload?.category
        ),
      },
      issues,
    };
  } finally {
    try {
      runPwcli(['close']);
    } catch {
      // Best effort cleanup only.
    }
  }

  writeJson(reportPathJson, report);
  writeText(reportPathMd, renderMarkdown(report));

  console.log(JSON.stringify({
    ok: report.issues.length === 0,
    outputDir,
    promptUrl,
    eventsSeen: [
      ...report.pageState.promptViewedEvents.map((event) => event.eventName),
      ...report.gtagSpyCalls.map((call) => call.eventName).filter(Boolean),
    ],
    issues: report.issues,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
