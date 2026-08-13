# Submit a prompt

Submit lets a user open the submission page and see either the submission form or the setup empty state. Verification stops before sending data to Convex.

## Sub-features

- `submit-open-header` opens `/submit/` from the header `Submit Prompt` link.
- `submit-open-hero` opens `/submit/` from the home `Submit a Prompt` control.
- `submit-observe` shows the form fields or the setup message without submitting.

## How to get to it (user POV)

- Choose `Submit Prompt` in the header (desktop).
- Choose `Submit a Prompt` on the home hero.
- Choose `Submit a Prompt` in the mobile menu.
- Open `/submit/` directly.

## Driving it with Playwright

Preconditions:

- AIPromptIndex is healthy at the URL from `control-aipromptindex url`.
- `control-aipromptindex doctor` reports `doctor=pass`.
- Do not submit the form.

- **Header entry.** Choose `Submit Prompt`. The URL is `/submit/` and the heading is `Submit a Prompt`.
- **Hero entry.** Open `/` and choose `Submit a Prompt`. The same heading appears.
- **Observe form or empty state.** On `/submit/`, one of these is visible: the textbox named `Prompt Title`, or the sentence `Submission form is being set up. Check back soon!`.
- **Proof.** Capture `/submit/` without pressing `Submit Prompt for Review`. Save snapshot to `artifacts/submit-prompt/page.aria.txt` and screenshot to `artifacts/submit-prompt/page.png`. Both show the `Submit a Prompt` heading and either the title field or the setup sentence.

## Gotchas

- If Convex is configured, the live form writes to the shared backend. Never complete a submit during verification.
- Header label is `Submit Prompt`; hero and page heading use `Submit a Prompt`.
- A successful real submit would show `Prompt Submitted!`. Seeing that during verification means the run mutated shared data — report it as contamination, not proof.
