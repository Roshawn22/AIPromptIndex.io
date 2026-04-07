import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdminIdentity } from "./lib/auth";

function normalizeVisitorFingerprint(visitorFingerprint: string): string {
  const normalizedFingerprint = visitorFingerprint.trim();
  if (!normalizedFingerprint) {
    throw new Error("Missing visitor fingerprint. Please refresh and try again.");
  }
  return normalizedFingerprint;
}

export const submit = mutation({
  args: {
    title: v.string(),
    promptText: v.string(),
    tool: v.string(),
    category: v.string(),
    difficulty: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.string()),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    visitorFingerprint: v.string(),
  },
  handler: async (ctx, args) => {
    const visitorFingerprint = normalizeVisitorFingerprint(args.visitorFingerprint);

    // Rate limiting: max 5 submissions per hour per fingerprint
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const rateLimit = await ctx.db
      .query("submissionRateLimits")
      .withIndex("by_key", (q) => q.eq("key", visitorFingerprint))
      .first();

    if (rateLimit) {
      if (rateLimit.blockedUntil && Date.now() < rateLimit.blockedUntil) {
        throw new Error("Too many submissions. Please try again later.");
      }

      if (rateLimit.windowStart > oneHourAgo && rateLimit.count >= 5) {
        await ctx.db.patch(rateLimit._id, {
          blockedUntil: Date.now() + 60 * 60 * 1000,
        });
        throw new Error("Too many submissions. Please try again in an hour.");
      }

      if (rateLimit.windowStart <= oneHourAgo) {
        await ctx.db.patch(rateLimit._id, {
          count: 1,
          windowStart: Date.now(),
          blockedUntil: undefined,
        });
      } else {
        await ctx.db.patch(rateLimit._id, {
          count: rateLimit.count + 1,
        });
      }
    } else {
      await ctx.db.insert("submissionRateLimits", {
        key: visitorFingerprint,
        count: 1,
        windowStart: Date.now(),
      });
    }

    const id = await ctx.db.insert("promptSubmissions", {
      title: args.title,
      promptText: args.promptText,
      tool: args.tool,
      category: args.category,
      difficulty: args.difficulty,
      description: args.description,
      tags: args.tags,
      authorName: args.authorName,
      authorEmail: args.authorEmail,
      status: "pending",
      submittedAt: Date.now(),
      visitorFingerprint,
    });

    return { id, status: "pending" };
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminIdentity(ctx);

    return await ctx.db
      .query("promptSubmissions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();
  },
});
