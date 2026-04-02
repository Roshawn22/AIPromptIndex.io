import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const track = mutation({
  args: {
    type: v.string(),
    promptSlug: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analyticsEvents", {
      type: args.type,
      promptSlug: args.promptSlug,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});
