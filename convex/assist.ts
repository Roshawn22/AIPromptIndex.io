import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";
import {
  type Question,
  asNormalizedScore,
  asNoul,
  isTypeSafeConfigured,
  noul,
  score,
  systemOne,
} from "./lib/typesafe";

// These actions are callable by anonymous visitors, so every call spends from a
// per-visitor and a site-wide budget before it is allowed to reach TypeSafe.
const WINDOW_MS = 60 * 1000;
const PER_VISITOR_LIMIT = 12;
const GLOBAL_LIMIT = 300;

const MAX_QUERY_LENGTH = 160;
const MAX_CANDIDATES = 8;
const MAX_FIELD_LENGTH = 300;

export const consumeBudget = internalMutation({
  args: { visitorId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const spend = async (key: string, limit: number) => {
      const row = await ctx.db
        .query("assistRateLimits")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (!row) {
        await ctx.db.insert("assistRateLimits", { key, count: 1, windowStart: now });
        return true;
      }
      if (now - row.windowStart >= WINDOW_MS) {
        await ctx.db.patch(row._id, { count: 1, windowStart: now });
        return true;
      }
      if (row.count >= limit) return false;
      await ctx.db.patch(row._id, { count: row.count + 1 });
      return true;
    };
    // Check the visitor first so one noisy visitor cannot drain the site-wide budget.
    if (!(await spend(`visitor:${args.visitorId}`, PER_VISITOR_LIMIT))) return false;
    return await spend("global", GLOBAL_LIMIT);
  },
});

const clip = (value: string, length = MAX_FIELD_LENGTH) => value.trim().slice(0, length);

const RELEVANCE_LEVELS = [
  "Not what the searcher is looking for.",
  "Loosely related to the search, but would not help with what the searcher is trying to do.",
  "Helps with what the searcher is trying to do, though it is not an exact fit.",
  "Exactly what the searcher is looking for.",
];

/**
 * Re-orders the client's Fuse.js matches by how well each serves the searcher's intent.
 * Returns `null` whenever judging is unavailable so the caller keeps its original order.
 */
export const rerankSearch = action({
  args: {
    visitorId: v.string(),
    query: v.string(),
    candidates: v.array(v.object({
      url: v.string(),
      name: v.string(),
      description: v.string(),
      type: v.string(),
    })),
  },
  returns: v.union(v.null(), v.array(v.object({ url: v.string(), relevance: v.number() }))),
  handler: async (ctx, args) => {
    const query = clip(args.query, MAX_QUERY_LENGTH);
    const candidates = args.candidates.slice(0, MAX_CANDIDATES);
    if (!isTypeSafeConfigured() || query.length < 3 || candidates.length < 2) return null;
    if (!(await ctx.runMutation(internal.assist.consumeBudget, { visitorId: clip(args.visitorId, 64) }))) return null;

    const state = {
      site: "A free library of copy-paste prompts, guides and articles for AI tools.",
      searchQuery: query,
      results: candidates.map((candidate) => ({
        kind: clip(candidate.type, 20),
        title: clip(candidate.name),
        description: clip(candidate.description),
      })),
    };
    const questions: Record<string, Question> = Object.fromEntries(candidates.map((_, index) => [
      `result_${index}`,
      score(`How well does \`results[${index}]\` serve someone who searched the site for \`searchQuery\`?`, RELEVANCE_LEVELS),
    ]));

    try {
      const { answers } = await systemOne({ state, questions }, { maxAttempts: 1 });
      return candidates.map((candidate, index) => ({
        url: candidate.url,
        relevance: asNormalizedScore(answers[`result_${index}`], RELEVANCE_LEVELS.length) ?? 0,
      }));
    } catch (error) {
      console.error("TypeSafe search rerank failed", error);
      return null;
    }
  },
});

/**
 * Judges whether a value typed into a prompt-builder variable suits that slot.
 * Returns the probability that it fits, or `null` when judging is unavailable.
 */
export const checkVariable = action({
  args: {
    visitorId: v.string(),
    promptTitle: v.string(),
    variableName: v.string(),
    variableDescription: v.string(),
    example: v.string(),
    value: v.string(),
  },
  returns: v.union(v.null(), v.object({ fits: v.number() })),
  handler: async (ctx, args) => {
    const value = clip(args.value, 500);
    if (!isTypeSafeConfigured() || value.length < 2) return null;
    if (!(await ctx.runMutation(internal.assist.consumeBudget, { visitorId: clip(args.visitorId, 64) }))) return null;

    const state = {
      promptTemplate: clip(args.promptTitle),
      slot: {
        name: clip(args.variableName, 80),
        description: clip(args.variableDescription),
        example: clip(args.example),
      },
      userValue: value,
    };
    const questions: Record<string, Question> = {
      fits: noul("Is `userValue` the kind of thing `slot` asks for?", {
        true: "It is a plausible value for this slot, even if brief, informal or very different from `slot.example`.",
        false: "It answers a different question than the slot asks, such as a name where a tone is wanted, or is placeholder text or gibberish.",
      }),
    };

    try {
      const { answers } = await systemOne({ state, questions }, { maxAttempts: 1 });
      const fits = asNoul(answers.fits);
      return fits === null ? null : { fits };
    } catch (error) {
      console.error("TypeSafe variable check failed", error);
      return null;
    }
  },
});
