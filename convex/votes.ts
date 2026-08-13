import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const voteCountsReturn = v.object({
  upvotes: v.number(),
  downvotes: v.number(),
  total: v.number(),
});

const castVoteAction = v.union(
  v.literal("removed"),
  v.literal("changed"),
  v.literal("created"),
);

export const getVoteCounts = query({
  args: { promptSlug: v.string() },
  returns: voteCountsReturn,
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("promptVotes")
      .withIndex("by_prompt", (q) => q.eq("promptSlug", args.promptSlug))
      .collect();

    const upvotes = votes.filter((vote) => vote.voteType === "up").length;
    const downvotes = votes.filter((vote) => vote.voteType === "down").length;

    return { upvotes, downvotes, total: upvotes - downvotes };
  },
});

export const getUserVote = query({
  args: { promptSlug: v.string(), visitorId: v.string() },
  returns: v.union(v.literal("up"), v.literal("down"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("promptVotes")
      .withIndex("by_prompt_visitor", (q) =>
        q.eq("promptSlug", args.promptSlug).eq("visitorId", args.visitorId)
      )
      .first();

    return existing?.voteType ?? null;
  },
});

export const castVote = mutation({
  args: {
    promptSlug: v.string(),
    visitorId: v.string(),
    voteType: v.union(v.literal("up"), v.literal("down")),
  },
  returns: v.object({ action: castVoteAction }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("promptVotes")
      .withIndex("by_prompt_visitor", (q) =>
        q.eq("promptSlug", args.promptSlug).eq("visitorId", args.visitorId)
      )
      .first();

    if (existing) {
      if (existing.voteType === args.voteType) {
        // Toggle off — remove vote
        await ctx.db.delete(existing._id);
        return { action: "removed" as const };
      }
      // Change vote direction
      await ctx.db.patch(existing._id, {
        voteType: args.voteType,
        createdAt: Date.now(),
      });
      return { action: "changed" as const };
    }

    // New vote
    await ctx.db.insert("promptVotes", {
      promptSlug: args.promptSlug,
      visitorId: args.visitorId,
      voteType: args.voteType,
      createdAt: Date.now(),
    });
    return { action: "created" as const };
  },
});
