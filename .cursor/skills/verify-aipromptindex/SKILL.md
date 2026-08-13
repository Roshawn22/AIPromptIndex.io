---
name: verify-aipromptindex
description: Drive the AIPromptIndex web app (Astro static site at aipromptindex.io) the way a user does — launch a disposable local instance, browse/search/copy prompts, and capture proof. Use when proving UI behavior, checking a user-facing change, or verifying catalog, search, copy, builder, or submit flows.
---

# Verify AIPromptIndex

AIPromptIndex is a public **web UI** (Astro + React islands). Users browse a prompt catalog, search, open a prompt, copy it, customize it in the builder, and optionally submit one. There is no first-party CLI. Convex/Clerk power vote, save, and submit; those hit a **shared** backend when `.env.local` is set — do not mutate them during verification.

Read `features/README.md` before driving. Use the matching feature file as the recipe. A proof that uses one convenient entry point is incomplete when the map lists others.

## Launch

Start a disposable instance on a dedicated port. Do not attach to a leftover `astro dev` on 4321.

```bash
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex launch
# optional: --port 4331 if 4327 is taken
```

Ready when `curl -fsS http://127.0.0.1:4327/` returns HTTP 200. The helper waits up to 90s and prints `launched pid=… url=…`.

Teardown (instances only; keep artifacts):

```bash
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex stop
```

Requires `npm install` already done in the repo root (`package.json` script `dev` is `astro dev`). Trailing slashes are required (`trailingSlash: 'always'`). Origin is always `http://127.0.0.1:<port>/`.

Two instances can run side by side on different ports. They share no local database. If Convex/Clerk env vars are present, vote/save/submit still share production-like backend state — never double-drive those.

## Doctor

Run this first whenever anything looks off:

```bash
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex doctor
```

Pass means: the recorded pid is alive, it owns the port, `/` contains `The AI Prompt Library`, `/prompts/` contains `All Prompts`, `/prompts/meeting-notes-summarizer/` contains `Meeting Notes Summarizer`, and `/search-index.json` includes that slug. Refuse to drive any instance this helper did not start (`control-aipromptindex status` must show `process=alive` and `port_owner=ours`).

## Drive

Harness: Playwright MCP (`plugin-playwright-playwright`) or the Cursor IDE browser. Prefer ARIA roles and accessible names. Viewport at least 1280px wide so desktop nav and the header Search control are visible (the mobile menu is `md:hidden`).

```bash
URL="$(.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex url)"
```

Stable handles (literal):

| Control | How to target it |
| --- | --- |
| Home | link named `AI Prompt Index home` → `/` |
| Prompts nav | link named `Prompts` → `/prompts/` |
| Categories nav | link named `Categories` → `/categories/` |
| Tools nav | link named `Tools` → `/tools/` |
| Builder nav | link named `Builder` → `/prompt-builder/` |
| Guides nav | link named `Guides` → `/guides/` |
| Blog nav | link named `Blog` → `/blog/` |
| Open search | button named `Open search` (header). Also `Cmd/Ctrl+K` or `/` when focus is not in an editable field |
| Search dialog | dialog named `Search AI prompts` |
| Search field | searchbox named `Search AI prompts` |
| Catalog heading | heading `All Prompts` on `/prompts/` |
| Catalog filters | unlabeled native `<select>`s whose first options are `All Tools`, `All Categories`, `Featured First`; difficulty buttons named `All Levels`, `beginner`, `intermediate`, `advanced` |
| Prompt card | link whose heading text is the prompt title, href `/prompts/<slug>/` |
| Fixture prompt | `/prompts/meeting-notes-summarizer/` heading `Meeting Notes Summarizer` |
| Copy (detail) | button named `Copy Prompt` (aria-label matches the visible label). After success: `Copied!` |
| Copy (code block) | button named `Copy prompt` (appears on hover/focus of the prompt block) |
| Builder search | textbox placeholder `Search prompts...` |
| Builder copy | button named `Copy Customized Prompt` |
| Submit CTA | link named `Submit Prompt` (header) or `Submit a Prompt` (home hero) → `/submit/` |

Do not use click coordinates. After navigation, wait for the heading of the destination page, not a fixed sleep. Search results debounce ~120ms and require **at least 2 characters**.

## Evidence

Store proof under `.cursor/skills/verify-aipromptindex/artifacts/<feature-id>/`. Cleanup must not delete this directory.

Proof standards:

- Exercise the real user path in the browser. Do not treat `curl` of HTML, Convex mutations, or test-only endpoints as UI proof. `doctor` is a health check, not a feature proof.
- Capture the action and the resulting state: ARIA snapshot (or accessibility snapshot) plus screenshot with `AIPromptIndex` visible in the header.
- For copy: the button accessible name must become `Copied!`. Do not call `navigator.clipboard.writeText` from the console.
- For search: snapshot must show the query and a result whose name is the expected prompt/article.
- For catalog filters: snapshot must show the reduced count (`Showing N of M prompts`) and a card for a remaining prompt.
- Side effects: copy is clipboard + button label. Vote, save, and submit write to Convex — **skip those mutations**. If a recipe would submit, stop at the visible form (or the `Submission form is being set up. Check back soon!` empty state) and record that skip.
- Record the feature ID and entry point used with every artifact. Save Playwright files with absolute paths under `.cursor/skills/verify-aipromptindex/artifacts/<feature-id>/` so they land in this repo, not a nested copy.

## Cleanup

```bash
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex stop
```

Stops only the pid in `.cursor/skills/verify-aipromptindex/.run/state`. Never `pkill astro` / `pkill node`. Leave `artifacts/` in place. Close the Playwright/browser tab used for the run.

## Helpers

```bash
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex launch [--port N]
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex doctor
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex url
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex status
.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex stop
```

The script is executable. Invoke it from the repo root with the paths above.
