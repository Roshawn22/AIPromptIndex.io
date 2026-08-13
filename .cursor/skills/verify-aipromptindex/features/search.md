# Search

Search lets a user find prompts, guides, and articles by name, open a result, see an empty state, and dismiss the dialog.

## Sub-features

- `search-open-button` opens search from the header Search control.
- `search-open-slash` opens search with `/` when focus is not in an editable field.
- `search-open-modk` opens search with Cmd/Ctrl+K.
- `search-match` returns the fixture prompt for a known query.
- `search-empty` shows a complete empty state for a query with no matches.
- `search-dismiss` closes the dialog with Escape.

## How to get to it (user POV)

- Choose the header button named `Open search` (visible label `Search` on desktop).
- Press `/` while focus is outside an input, textarea, or select.
- Press `Cmd+K` (macOS) or `Ctrl+K`.
- On a narrow viewport, open the menu named `Open menu`, then choose `Open search`.

## Driving it with Playwright

Preconditions:

- AIPromptIndex is healthy at the URL from `control-aipromptindex url`.
- `control-aipromptindex doctor` reports `search_index=ok`.
- Start on `/` with no dialog open.

- **Toolbar entry.** Choose `Open search`. A dialog named `Search AI prompts` appears with focus in the searchbox named `Search AI prompts`.
- **Keyboard slash.** Dismiss with Escape, then press `/`. The same dialog appears and the page does not insert a slash into a field.
- **Match.** Type `meeting notes`. After results appear, a link named `Meeting Notes Summarizer` is visible (type badge `Prompt`).
- **Open result.** Choose `Meeting Notes Summarizer`. The dialog closes and the heading reads `Meeting Notes Summarizer` at `/prompts/meeting-notes-summarizer/`.
- **Empty state.** Return to `/`, open search, and type `zzzxqnotaprompt`. The dialog shows `No results for "zzzxqnotaprompt"`.
- **Dismiss.** Press Escape. The dialog is gone and the home heading `The AI Prompt Library` is visible.
- **Proof.** Recreate the populated result state (`meeting notes`). Save snapshot to `artifacts/search/results.aria.txt` and screenshot to `artifacts/search/results.png`. Both identify AIPromptIndex, the query, and `Meeting Notes Summarizer`.

## Gotchas

- Queries shorter than 2 characters show `Type at least 2 characters to search.` and no results.
- Results update after a ~120ms debounce. Wait for a result link or the empty-state sentence, not a fixed sleep.
- `/` while a textbox has focus types a slash instead of opening search.
- There are two `Open search` buttons (header and mobile menu). Use the header one at desktop width.
- Search index is `/search-index.json`. If doctor reports it missing, do not treat an empty dialog as a product empty state.
