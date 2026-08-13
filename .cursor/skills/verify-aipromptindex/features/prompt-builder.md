# Prompt builder

Prompt builder lets a user pick a template, replace a variable, preview the filled prompt, and copy the customized text.

## Sub-features

- `builder-open` opens `/prompt-builder/` from the header Builder link.
- `builder-select` selects the fixture template from the list.
- `builder-fill` replaces one variable value and shows it in the preview.
- `builder-copy` copies the customized prompt.

## How to get to it (user POV)

- Choose `Builder` in the main navigation.
- Open `/prompt-builder/` directly.
- From a prompt page, there is no in-page builder link; the user uses the header.

## Driving it with Playwright

Preconditions:

- AIPromptIndex is healthy at the URL from `control-aipromptindex url`.
- `control-aipromptindex doctor` reports `doctor=pass`.
- Viewport width is at least 1280px.

- **Open builder.** Choose `Builder`. The heading `Prompt Builder` and `Choose a Template` are visible.
- **Find fixture.** In the textbox with placeholder `Search prompts...`, type `Meeting Notes`. Choose the button whose name includes `Meeting Notes Summarizer`. `Customize Variables` appears and shows `Editing Meeting Notes Summarizer`.
- **Fill a variable.** In the textbox named `MEETING_TYPE`, replace the value with `Verification standup`. The preview under `Preview & Copy` contains `Verification standup`.
- **Copy.** Choose `Copy Customized Prompt`. The button text becomes `Copied!`.
- **Proof.** Capture the builder after copy. Save snapshot to `artifacts/prompt-builder/copied.aria.txt` and screenshot to `artifacts/prompt-builder/copied.png`. Both show `Prompt Builder`, `Meeting Notes Summarizer`, `Verification standup`, and `Copied!`.

## Gotchas

- The template list is a stack of buttons, not links. Match the title text `Meeting Notes Summarizer`.
- Variable fields are labeled with the placeholder name (`MEETING_TYPE`), not the description.
- Preview highlights a value only when it differs from the example. Assert the preview text, not a highlight class.
- `Copied!` lasts about 2 seconds.
- Skip `Open in Gemini` (or other tool) affiliate links; they leave the app.
