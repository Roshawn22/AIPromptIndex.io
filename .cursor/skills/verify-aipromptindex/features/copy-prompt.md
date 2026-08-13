# Copy a prompt

Copy lets a user open a prompt page and copy the prompt text with the primary Copy control, then see a Copied confirmation.

## Sub-features

- `copy-open` opens the fixture prompt from the catalog or a direct URL.
- `copy-primary` copies from the large Copy control under the prompt block.
- `copy-confirm` shows the Copied state on that control.

## How to get to it (user POV)

- Open `/prompts/meeting-notes-summarizer/` directly.
- From `/prompts/`, choose the card titled `Meeting Notes Summarizer`.
- From search, choose the `Meeting Notes Summarizer` result.

## Driving it with Playwright

Preconditions:

- AIPromptIndex is healthy at the URL from `control-aipromptindex url`.
- `control-aipromptindex doctor` reports fixture `meeting-notes-summarizer`.
- Grant clipboard permissions if the browser prompts.

- **Open fixture.** Go to `/prompts/meeting-notes-summarizer/`. The heading is `Meeting Notes Summarizer` and the prompt block is visible.
- **Copy.** Choose the button named `Copy Prompt` (the large control under the prompt block). The same button's accessible name becomes `Copied!`.
- **Proof.** Capture the page immediately after copy, while `Copied!` is still shown (it reverts after about 2 seconds). Save snapshot to `artifacts/copy-prompt/copied.aria.txt` and screenshot to `artifacts/copy-prompt/copied.png`. Both show `Meeting Notes Summarizer` and `Copied!`.

## Gotchas

- The primary control's accessible name matches its visible label (`Copy Prompt`). After success it becomes `Copied!`.
- The overlay control on the prompt block is named `Copy prompt` and is `opacity-0` until hover or focus. Do not require it for this feature; `copy-primary` is the user path.
- `Copied!` lasts about 2 seconds. Snapshot immediately.
- Do not prove copy by writing the clipboard from the console.
- Skip Upvote, Downvote, and Save on this page.
