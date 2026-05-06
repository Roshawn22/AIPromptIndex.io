# Ahrefs Slow Page Triage

Updated: 2026-04-28

Ahrefs flagged three slow pages after the confirmation crawl:

| Page | Ahrefs issue | Live follow-up result |
| --- | --- | --- |
| `/tools/cursor/` | Slow page | Three live `curl` checks returned `0.481s`, `0.235s`, and `0.203s` total load time. |
| `/best/chatgpt-prompts/` | Slow page | Three live `curl` checks returned `0.444s`, `0.185s`, and `0.190s` total load time. |
| `/prompts/investor-update-email/` | Slow page | Three live `curl` checks returned `0.477s`, `0.792s`, and `0.201s` total load time. |

## Assessment

The follow-up measurements do not reproduce a persistent server-side slowdown. The Ahrefs warning looks like transient edge response variance, with `/best/chatgpt-prompts/` carrying the largest HTML payload and `/prompts/investor-update-email/` showing one slower repeat.

## Follow-Up

- Recheck after the next Ahrefs crawl before making performance-specific source changes.
- If the same pages are repeatedly flagged, prioritize reducing repeated prompt-card markup on large collection pages and reviewing client-side islands on prompt detail pages.
