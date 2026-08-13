# AIPromptIndex verification map

This directory is the maintained source for verifying the user-facing behavior of AIPromptIndex. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `.cursor/skills/verify-aipromptindex/scripts/control-aipromptindex launch` so the origin is `http://127.0.0.1:4327` (or the printed port).
- Run `control-aipromptindex doctor` and require `doctor=pass`, `port_owner=ours`, and fixture `meeting-notes-summarizer`.
- Use a browser viewport at least 1280px wide.
- Never drive an instance that was not started by this verification run.
- Do not click Upvote, Downvote, Save, or submit a prompt. Those write to the shared Convex backend when `PUBLIC_CONVEX_URL` is set.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position.
- Treat every command as literal. Keep quoted names, slugs, and paths unchanged.
- All routes use a trailing slash (`/prompts/`, `/prompts/meeting-notes-summarizer/`).
- Restore the browser to `/` after a mutation-like UI action (copy is ephemeral; no data restore needed).
- Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an accessibility snapshot and a screenshot with the AIPromptIndex header visible.
- Copy proof is the button name changing to `Copied!`.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted control and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Playwright` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Browse the prompt catalog](./browse-catalog.md) covers home, `/prompts/`, tool/category filters, and opening a prompt card.
- [Search](./search.md) covers header Search, `/`, and Cmd/Ctrl+K, plus match, empty, and dismiss states.
- [Copy a prompt](./copy-prompt.md) covers opening the fixture prompt and copying from the primary Copy control.
- [Prompt builder](./prompt-builder.md) covers picking a template, filling a variable, and copying the customized text.
- [Submit a prompt](./submit-prompt.md) covers reaching `/submit/` and observing the form or setup empty state without sending data.
