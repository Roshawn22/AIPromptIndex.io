# Browse the prompt catalog

Browse lets a user open the prompt library from the home page or header, filter the catalog by tool and category, and open a prompt from a card.

## Sub-features

- `browse-home` shows the home library heading and a path into the catalog.
- `browse-nav` opens `/prompts/` from the header Prompts link.
- `browse-filter-tool` narrows the catalog to one tool.
- `browse-open-card` opens a prompt detail page from a catalog card.

## How to get to it (user POV)

- Open `/` and choose `Browse Prompt Library`.
- Choose the `Prompts` link in the main navigation.
- Open `/prompts/` directly.
- From home, choose a tool pill such as `ChatGPT` (goes to `/tools/chatgpt/`, not the catalog filters).

## Driving it with Playwright

Preconditions:

- AIPromptIndex is healthy at the URL from `control-aipromptindex url`.
- `control-aipromptindex doctor` reports `doctor=pass`.
- Viewport width is at least 1280px.

- **Home identity.** Open `/`. The heading `The AI Prompt Library` is visible and the header shows `AIPromptIndex`.
- **Hero entry.** Choose `Browse Prompt Library`. The URL is `/prompts/` and the heading `All Prompts` is visible.
- **Nav entry.** Open `/`, then choose the `Prompts` link in `Main navigation`. The same `/prompts/` heading appears.
- **Filter by tool.** On `/prompts/`, set the first select (current option `All Tools`) to `ChatGPT`. The status text `Showing N of M prompts` updates to a smaller N, and remaining cards show a `ChatGPT` badge.
- **Open a card.** Choose a catalog link whose heading is a prompt title (prefer a visible card, not a specific slug). The detail page heading matches that title and the URL is `/prompts/<slug>/`.
- **Proof.** Capture `/prompts/` after the ChatGPT filter. Save snapshot to `artifacts/browse-catalog/filtered.aria.txt` and screenshot to `artifacts/browse-catalog/filtered.png`. Both show `All Prompts`, a reduced `Showing` count, and at least one `ChatGPT` card.

## Gotchas

- Tool pills on the home page go to `/tools/<slug>/`, not `/prompts/?tool=`. Catalog filtering is the unlabeled selects on `/prompts/`.
- Difficulty button accessible names are lowercase (`beginner`), except `All Levels`.
- Prompt card links have no extra accessible name beyond the card contents; match the heading text inside the link.
- Trailing slashes are required. `/prompts` may redirect; assert `/prompts/`.
