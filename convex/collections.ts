import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Save a prompt to the authenticated user's collection (default: "favorites").
 * Skips if already saved. Requires Clerk authentication.
 */
export const savePrompt = mutation({
  args: {
    promptSlug: v.string(),
    collectionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be signed in to save prompts");
    }
    const clerkUserId = identity.subject;
    const collectionName = args.collectionName ?? "favorites";

    // Check if already saved
    const existing = await ctx.db
      .query("userCollections")
      .withIndex("by_user_prompt", (q) =>
        q.eq("clerkUserId", clerkUserId).eq("promptSlug", args.promptSlug)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("userCollections", {
      clerkUserId,
      promptSlug: args.promptSlug,
      collectionName,
      savedAt: Date.now(),
    });
  },
});

/**
 * Remove a prompt from the authenticated user's collections.
 */
export const removePrompt = mutation({
  args: {
    promptSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be signed in to remove saved prompts");
    }
    const clerkUserId = identity.subject;

    const existing = await ctx.db
      .query("userCollections")
      .withIndex("by_user_prompt", (q) =>
        q.eq("clerkUserId", clerkUserId).eq("promptSlug", args.promptSlug)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Check if a prompt is saved by a user.
 * This query accepts clerkUserId as an arg since queries can't use auth
 * in all contexts, but the client only passes the authenticated user's own ID.
 */
export const isPromptSaved = query({
  args: {
    clerkUserId: v.string(),
    promptSlug: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.clerkUserId) return false;

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
    if (!args.clerkUserId) return [];

    const records = await ctx.db
      .query("userCollections")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    return records.map((r) => r.promptSlug);
  },
});
