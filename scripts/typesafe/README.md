# TypeSafe judgments

Code owns every workflow here; TypeSafe (Jev) only supplies typed judgments — Choice, Noul
(yes/no probability) and Score — that the code combines with thresholds and weights it controls.
Docs: https://docs.typesafe.ai/llms.txt

| Piece | Where | Runs | Writes |
| --- | --- | --- | --- |
| Submission moderation | `convex/moderation.ts`, policy in `convex/lib/moderationPolicy.ts` | Scheduled after every `submissions.submit` | `status`, `reviewNotes`, `moderation` on the submission |
| Catalog audit | `audit-catalog.mjs` | `npm run typesafe:audit` | `output/typesafe/<date>/catalog-audit.{json,md}` |
| Related prompts | `build-related.mjs` | `npm run typesafe:related` | `src/data/seo/related-prompts.json` (commit it) |
| Keyword intent & gaps | `classify-keywords.mjs` | `npm run typesafe:keywords` | `output/typesafe/<date>/keyword-intent.{json,md}` |
| pt-BR pre-review | `verify-localization.mjs` | `npm run typesafe:localization` | `output/typesafe/<date>/localization-review.{json,md}` |
| Search rerank, builder hints | `convex/assist.ts`, `src/lib/assist.ts` | In the browser, behind `PUBLIC_TYPESAFE_*` flags | nothing |

Every script accepts `--dry-run` (print the exact request, no API call), `--limit=N`,
`--concurrency=N`, and where it applies `--slug=<slug>`. Answers are cached in
`output/typesafe/cache/` by a hash of state + questions, so re-runs only pay for what changed and
tuning a threshold or weight never re-runs inference.

## Rules these follow

- **Nothing is auto-published or auto-edited.** Only near-certain spam (>= 0.92) changes a
  submission's status; audits, keyword gaps and localization results are reports for a person.
- **Labels are hidden from the model.** A prompt's current category/difficulty/tags are left out
  of `state`, so the model judges the prompt instead of agreeing with the label.
- **The model only sees candidates code retrieved.** Similarity, related prompts and keyword
  coverage all shortlist lexically first; widen the shortlist if recall looks low.
- **Thresholds were calibrated on the first full run** (2026-09-19, 156 prompts / 150 keywords /
  8 pilot pages). Re-tuning is free: answers are cached by state + questions, so changing a
  threshold and re-running costs zero requests. Re-calibrate when the catalog or a rubric changes.
- **pt-BR is advisory.** TypeSafe documents lower accuracy outside English; `reviewStatus` is
  only ever changed by a human.
- **No personal data is sent.** Author name, email, fingerprint and IP never leave Convex.

## What the first calibration run changed

Three checks were miscalibrated on first contact with real data, and fixing them is why the
report is worth reading:

- **Composite quality spans only 0.79–0.99** on a curated catalog, so the original absolute
  `lowQuality: 0.45` cutoff could never fire. Outliers are now the weakest tenth *within a
  promptType*, because rubrics written around text output score image prompts ~5 points lower
  as a group — a single global cutoff would only ever rediscover that.
- **Difficulty relabelling was noise.** The model disagrees with 43% of catalog difficulty
  labels at a median confidence of 0.50, and calls only 3 prompts "advanced" against the
  catalog's 32. Per-prompt suggestions now need 0.8 confidence (21 findings → 7), and the
  systematic skew is reported once at the top of the report instead of as 67 separate errors.
- **Description accuracy never dropped below 0.66**, so its 0.4 cutoff was dead. Raised to 0.7.

Category relabelling needed no change: disagreements carry a median confidence of 0.93 and the
top ones are plainly right (`sql-query-debugger` and `sql-query-optimizer` are filed under
data-analysis but are coding prompts).

The localization gate flagged all 8 pilot pages on its first run, which is useless for triage.
The cause was one "faithfulness" score treating deliberate condensation as failure — the pt-BR
description for `ai-slop-remover` is 224 characters against an 796-character English source.
Contradiction and omission are now separate judgments: inventing or contradicting a claim is a
**defect** to fix, leaving material out is an editorial **choice** to confirm. That resolves to
6 defects, 1 to confirm and 1 clean, and the 6 are real — the pt-BR roundup descriptions name
specific tools ("ChatGPT, Claude e Gemini") where the English says "any use case".
