/**
 * Which prompts belong on which audience page (/prompts/for/<slug>/).
 *
 * Membership is data, not a filter: scripts/typesafe/audience-fit.mjs asks, for every prompt
 * and audience, "would someone in this audience reach for this prompt as part of their own
 * work?", and writes the prompts judged more likely yes than no to audience-membership.json,
 * each with its fit. Pages used to include every prompt whose category or tags matched, which
 * swept filler onto them (a `business` prompt landed on seven audience pages at once).
 *
 * A prompt added to the catalog appears on no audience page until that script is re-run with
 * --write-membership; scripts/seo/__tests__/audience-membership.test.mjs flags it.
 */
import membership from '../data/seo/audience-membership.json';

/** Audience page slug -> member prompt slug -> judged fit. */
export const AUDIENCE_FITS = membership.pages as Record<string, Record<string, number>>;

export function audienceFit(pageSlug: string, promptSlug: string): number | undefined {
  return AUDIENCE_FITS[pageSlug]?.[promptSlug];
}

export function isAudienceMember(pageSlug: string, promptSlug: string): boolean {
  return audienceFit(pageSlug, promptSlug) !== undefined;
}
