# pt-BR human review checklist

Reviewer: ____________________

Review date: ____________________

The reviewer should be fluent in Brazilian Portuguese and familiar with AI-product terminology. Review the eight routes from a local or preview build created with `npm run localization:review-build`.

## Global shell

- [ ] Navigation labels sound natural in Brazilian Portuguese.
- [ ] Search, theme, authentication, copy, save, and newsletter controls are understandable.
- [ ] Links that open untranslated English content are clearly identified.
- [ ] Mobile and desktop layouts have no truncation, overflow, or ambiguous tap targets.
- [ ] `prompt`, `template`, `Gemini`, `Cursor`, `ChatGPT`, and `Claude` terminology is used consistently.
- [ ] The newsletter CTA accurately explains that the destination publication is in English.

## Page review

- [ ] `/pt-BR/`
- [ ] `/pt-BR/best/gemini-prompts/`
- [ ] `/pt-BR/best/best-ai-prompts/`
- [ ] `/pt-BR/best/free-ai-prompts/`
- [ ] `/pt-BR/best/prompt-templates/`
- [ ] `/pt-BR/best/cursor-ai-prompts/`
- [ ] `/pt-BR/prompts/ai-slop-remover/`
- [ ] `/pt-BR/prompts/business-plan-executive-summary/`

For each page:

- [ ] The title and description preserve the English source intent.
- [ ] The copy reads naturally rather than as a literal translation.
- [ ] Claims, product capabilities, dates, numbers, and proper names remain accurate.
- [ ] SEO title is at most 60 characters and the meta description is at most 155 characters.
- [ ] Calls to action match the destination and do not imply that untranslated content is localized.

For the two translated prompts:

- [ ] Every placeholder variable is unchanged, including capitalization and brackets.
- [ ] Instructions preserve the source constraints and output format.
- [ ] The translated prompt produces the intended output when tested in its named AI tool.

## Approval procedure

1. Make editorial corrections in `src/data/i18n/pt-BR/`.
2. If the English source changed, refresh `sourceFingerprint` and repeat the page review.
3. Run `npm run localization:review-build`.
4. Change a page to `reviewStatus: approved` only after its checklist items pass.
5. Run the review build again after all eight pages are approved.

Approval confirms language quality only. Deployment and indexing still require separate explicit authorization and both rollout environment flags.
