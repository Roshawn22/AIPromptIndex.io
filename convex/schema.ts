import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const moderationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("spam")
);

export default defineSchema({
  // Votes — fingerprint-based dedup, no auth required
  promptVotes: defineTable({
    promptSlug: v.string(),
    visitorId: v.string(),
    voteType: v.union(v.literal("up"), v.literal("down")),
    createdAt: v.number(),
  })
    .index("by_prompt_visitor", ["promptSlug", "visitorId"])
    .index("by_prompt", ["promptSlug"]),

  // Community prompt submissions
  promptSubmissions: defineTable({
    title: v.string(),
    promptText: v.string(),
    tool: v.string(),
    category: v.string(),
    difficulty: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.string()),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    status: moderationStatus,
    reviewNotes: v.optional(v.string()),
    submittedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    visitorFingerprint: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_submitted", ["submittedAt"]),

  // Analytics events (lightweight)
  analyticsEvents: defineTable({
    type: v.string(), // "copy" | "view" | "share" | "search"
    promptSlug: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_prompt", ["promptSlug"]),

  // Newsletter subscriptions
  newsletterSubscriptions: defineTable({
    email: v.string(),
    status: v.string(), // "subscribed" | "duplicate" | "error"
    source: v.optional(v.string()),
    subscribedAt: v.number(),
  })
    .index("by_email", ["email"]),

  // Submission rate limits
  submissionRateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),
    blockedUntil: v.optional(v.number()),
  })
    .index("by_key", ["key"]),
});
