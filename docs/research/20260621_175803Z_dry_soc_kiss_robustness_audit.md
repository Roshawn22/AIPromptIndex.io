# AIPromptIndex Robustness Audit

Generated: 2026-06-21 17:58:03Z
Repo: /Users/roshawnfranklin/AIPromptIndex.io
Branch: codex/ahrefs-site-audit-url-fixes

## Audit Summary

The audit found no critical or high-severity robustness defects. The project was already buildable, but `astro check` exposed 18 hints that pointed to real cleanup opportunities: repeated clipboard fallback code, stale imports and variables, deprecated iframe attributes, and a configuration value read by the Ahrefs keyword-gap script but not used.

The remediation pass focused on narrow, low-risk fixes:

- Centralized browser clipboard behavior in a shared helper.
- Removed stale imports, unused variables, and deprecated iframe attributes.
- Wired `AHREFS_TARGET_MODE` into the keyword-gap Ahrefs request instead of hardcoding `subdomains`.
- Ignored local Playwright runtime folders so automation state stops polluting git status.

Verification after remediation:

- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: passed; 247 pages built.
- `node --test scripts/seo/__tests__/*.test.mjs`: 8 tests passed.
- `git diff --check`: clean.

## Codebase Census

Detected stack: Astro static site with React islands, TypeScript, Convex, content collections, and Node-based SEO automation scripts.

File census excluding generated, dependency, build, cache, local runtime, and output paths:

- `.astro`: 37 files
- `.tsx`: 23 files
- `.ts`: 21 files
- `.mjs`: 33 files
- `.json`: 169 files
- `.md`: 19 files
- `.css`: 4 files
- `.svg`: 2 files
- `.txt`: 2 files

Largest source and workflow surfaces:

- /Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/run-ai-ops.mjs: 883 lines
- /Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/build-brief.mjs: 847 lines
- /Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/_shared.mjs: 821 lines
- /Users/roshawnfranklin/AIPromptIndex.io/docs/superpowers/plans/2026-04-10-medium-syndication.md: 813 lines
- /Users/roshawnfranklin/AIPromptIndex.io/docs/link-building-prospect-list-and-drafts.md: 633 lines
- /Users/roshawnfranklin/AIPromptIndex.io/src/components/prompt/PromptBuilder.tsx: 479 lines
- /Users/roshawnfranklin/AIPromptIndex.io/src/components/global/SearchModal.tsx: 425 lines

Major exclusions:

- `/Users/roshawnfranklin/AIPromptIndex.io/node_modules`: vendored dependencies.
- `/Users/roshawnfranklin/AIPromptIndex.io/dist`: build output.
- `/Users/roshawnfranklin/AIPromptIndex.io/.astro`: generated Astro metadata and types.
- `/Users/roshawnfranklin/AIPromptIndex.io/.git`: VCS internals.
- `/Users/roshawnfranklin/AIPromptIndex.io/output`: local SEO/artifact output.
- `/Users/roshawnfranklin/AIPromptIndex.io/.playwright-cli` and `/Users/roshawnfranklin/AIPromptIndex.io/.playwright-mcp`: local browser automation state.
- `/Users/roshawnfranklin/AIPromptIndex.io/package-lock.json`: dependency lockfile.

## Critical Findings

No critical or high-severity findings were found.

## Medium Findings

### DRY-001: Clipboard Fallback Logic Was Duplicated Across Copy Surfaces

**Severity**: Medium
**Files**: /Users/roshawnfranklin/AIPromptIndex.io/src/components/prompt/PromptBuilder.tsx, /Users/roshawnfranklin/AIPromptIndex.io/src/components/prompt/PromptCodeBlock.tsx, /Users/roshawnfranklin/AIPromptIndex.io/src/components/prompt/PromptCompare.tsx, /Users/roshawnfranklin/AIPromptIndex.io/src/components/ui/CopyButton.tsx, /Users/roshawnfranklin/AIPromptIndex.io/src/lib/clipboard.ts
**Evidence**: Three components used duplicated `navigator.clipboard.writeText` plus `document.execCommand('copy')` fallback code, and another compare surface used a separate clipboard-only flow. `astro check` flagged deprecated `document.execCommand` usage at three call sites before remediation.
**Current State**: Clipboard behavior is centralized in /Users/roshawnfranklin/AIPromptIndex.io/src/lib/clipboard.ts:1. Consumers now call the helper from /Users/roshawnfranklin/AIPromptIndex.io/src/components/prompt/PromptBuilder.tsx:125, /Users/roshawnfranklin/AIPromptIndex.io/src/components/prompt/PromptCodeBlock.tsx:15, /Users/roshawnfranklin/AIPromptIndex.io/src/components/prompt/PromptCompare.tsx:77, and /Users/roshawnfranklin/AIPromptIndex.io/src/components/ui/CopyButton.tsx:37.
**Problem**: Duplicated browser fallback logic increases drift risk: one copy surface can preserve selection, track analytics, or handle insecure clipboard contexts differently from another.
**Proposed Change**: Completed. Keep all copy-to-clipboard behavior behind `copyTextToClipboard`.
**Estimated Impact**: Removed repeated fallback blocks from four UI surfaces and reduced future browser API maintenance to one helper.
**Confidence**: High

### KISS-001: Local Browser Runtime State Was Not Ignored

**Severity**: Medium
**Files**: /Users/roshawnfranklin/AIPromptIndex.io/.gitignore
**Evidence**: `git status --short` showed `.playwright-cli/` and `.playwright-mcp/` as untracked directories before remediation. These are local automation runtime folders, not project source.
**Current State**: `.playwright-cli/` and `.playwright-mcp/` are ignored at /Users/roshawnfranklin/AIPromptIndex.io/.gitignore:32.
**Problem**: Unignored local runtime state makes git status noisy and increases the chance of accidentally staging browser profile artifacts or test state.
**Proposed Change**: Completed. Keep local automation state ignored.
**Estimated Impact**: Removes two runtime directories from future status noise.
**Confidence**: High

## Low Findings

### KISS-002: Checker Hints Came From Stale Imports, Variables, And Deprecated Attributes

**Severity**: Low
**Files**: /Users/roshawnfranklin/AIPromptIndex.io/src/components/common/NewsletterSignup.astro, /Users/roshawnfranklin/AIPromptIndex.io/src/pages/blog/index.astro, /Users/roshawnfranklin/AIPromptIndex.io/src/pages/guides/index.astro, /Users/roshawnfranklin/AIPromptIndex.io/src/pages/categories/[slug].astro, /Users/roshawnfranklin/AIPromptIndex.io/src/pages/prompts/for/[slug].astro, /Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/analyze-ai-visibility.mjs, /Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/run-ai-ops.mjs
**Evidence**: `astro check` reported 18 hints before remediation and 0 hints afterward.
**Current State**: The stale imports and variables were removed, and deprecated iframe attributes were replaced with a `border: 0` style at /Users/roshawnfranklin/AIPromptIndex.io/src/components/common/NewsletterSignup.astro:57.
**Problem**: Warning noise makes future regressions easier to miss and encourages ignoring checker output.
**Proposed Change**: Completed. Keep `astro check` clean.
**Estimated Impact**: Reduced checker output from 18 hints to 0.
**Confidence**: High

### DRY-002: Keyword-Gap Script Read A Target Mode It Did Not Use

**Severity**: Low
**Files**: /Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/keyword-gap-analysis.mjs
**Evidence**: `AHREFS_TARGET_MODE` was read at /Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/keyword-gap-analysis.mjs:18, but the competitor keyword request hardcoded `subdomains`.
**Current State**: The Ahrefs request now passes `mode` at /Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/keyword-gap-analysis.mjs:97.
**Problem**: A config variable that appears active but is ignored creates audit/debugging friction for SEO data pulls.
**Proposed Change**: Completed. Use the configured target mode.
**Estimated Impact**: One SEO script now respects the same target-mode contract it exposes.
**Confidence**: High

## Recommended Refactoring Sequence

1. Completed: clean checker hints, centralize clipboard behavior, and ignore local Playwright state.
2. Keep the newly clean `npm run check` output as a pre-merge gate for future UI and SEO script edits.
3. Defer broad SEO-script refactors until an SEO workflow is actively being changed. The largest scripts are good candidates for extraction, but the current blast radius does not justify a standalone rewrite.
4. If `scripts/seo/run-ai-ops.mjs` grows further, split it by responsibility: artifact loading, candidate scoring, AI prompt building, response normalization, and markdown rendering.
5. If `scripts/seo/_shared.mjs` continues growing, split API clients from artifact/status helpers so Ahrefs, Semrush, Google, and local inventory behavior can evolve independently.

## Compound Patterns

The main compound issue was DRY plus KISS: small browser and analytics behaviors were duplicated across multiple UI islands while each local copy also carried deprecated fallback code. Centralizing the clipboard behavior reduced duplicated logic and eliminated multiple checker hints at once.

The SEO scripts show a lower-severity SoC risk: `/Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/run-ai-ops.mjs` and `/Users/roshawnfranklin/AIPromptIndex.io/scripts/seo/_shared.mjs` are large enough that future workflow changes should be made carefully, with focused extraction only when it reduces active maintenance risk.
