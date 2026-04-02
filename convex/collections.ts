import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Save a prompt to a user's collection (default: "favorites").
 * Skips if already saved.
 */
export const savePrompt = mutation({
  args: {
    clerkUserId: v.string(),
    promptSlug: v.string(),
    collectionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const collectionName = args.collectionName ?? "favorites";

    // Check if already saved
    const existing = await ctx.db
      .query("userCollections")
      .withIndex("by_user_prompt", (q) =>
        q.eq("clerkUserId", args.clerkUserId).eq("promptSlug", args.promptSlug)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("userCollections", {
      clerkUserId: args.clerkUserId,
      promptSlug: args.promptSlug,
      collectionName,
      savedAt: Date.now(),
    });
  },
});

/**
 * Remove a prompt from a user's collections.
 */
export const removePrompt = mutation({
  args: {
    clerkUserId: v.string(),
    promptSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userCollections")
      .withIndex("by_user_prompt", (q) =>
        q.eq("clerkUserId", args.clerkUserId).eq("promptSlug", args.promptSlug)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Check if a prompt is saved by a user.
 */
export const isPromptSaved = query({
  args: {
    clerkUserId: v.string(),
    promptSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userCollections")
      .withIndex("by_user_prompt", (q) =>
        q.eq("clerkUserId", args.clerkUserId).eq("promptSlug", args.promptSlug)
      )
      .first();

    return existing !== null;
  },
});

/**
 * Get all saved prompt slugs for a user.
 */
export const getUserFavorites = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("userCollections")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    return records.map((r) => r.promptSlug);
  },
});
