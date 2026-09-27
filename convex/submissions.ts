import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { query, mutation } from "./_generated/server";
import { requireAdminIdentity } from "./lib/auth";
import { moderationResult } from "./schema";

const difficulty = v.union(
  v.literal("beginner"),
  v.literal("intermediate"),
  v.literal("advanced"),
);

const moderationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("spam"),
);

const promptSubmissionDoc = v.object({
  _id: v.id("promptSubmissions"),
  _creationTime: v.number(),
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
  moderation: v.optional(moderationResult),
});

function normalizeVisitorFingerprint(visitorFingerprint: string): string {
  const normalizedFingerprint = visitorFingerprint.trim();
  if (!normalizedFingerprint) {
    throw new ConvexError("Missing visitor fingerprint. Please refresh and try again.");
  }
  return normalizedFingerprint;
}

// This mutation is public and reachable without the form, so the server enforces the
// same limits the form shows. The caps are generous next to the catalog (the longest
// published prompt is under 3,000 characters) but stop a script from storing, and then
// sending to the moderation model, arbitrarily large payloads.
export const SUBMISSION_LIMITS = {
  title: 120,
  promptText: 8000,
  description: 1000,
  tags: 200,
  authorName: 120,
  authorEmail: 254,
} as const;

// Every submission also schedules a paid moderation call, so a site-wide hourly cap
// bounds the cost of a script that rotates fingerprints to dodge the per-visitor limit.
const SUBMISSIONS_PER_VISITOR_PER_HOUR = 5;
const SUBMISSIONS_SITE_WIDE_PER_HOUR = 40;
const HOUR_MS = 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function requireLength(value: string, field: keyof typeof SUBMISSION_LIMITS, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ConvexError(`${label} is required.`);
  if (trimmed.length > SUBMISSION_LIMITS[field]) {
    throw new ConvexError(`${label} must be ${SUBMISSION_LIMITS[field]} characters or fewer.`);
  }
  return trimmed;
}

function optionalLength(value: string | undefined, field: keyof typeof SUBMISSION_LIMITS, label: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > SUBMISSION_LIMITS[field]) {
    throw new ConvexError(`${label} must be ${SUBMISSION_LIMITS[field]} characters or fewer.`);
  }
  return trimmed;
}

export const submit = mutation({
  args: {
    title: v.string(),
    promptText: v.string(),
    tool: v.string(),
    category: v.string(),
    difficulty,
    description: v.optional(v.string()),
    tags: v.optional(v.string()),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    visitorFingerprint: v.string(),
  },
  returns: v.object({
    id: v.id("promptSubmissions"),
    status: v.literal("pending"),
  }),
  handler: async (ctx, args) => {
    const visitorFingerprint = normalizeVisitorFingerprint(args.visitorFingerprint);

    const title = requireLength(args.title, "title", "Title");
    const promptText = requireLength(args.promptText, "promptText", "Prompt text");
    const description = optionalLength(args.description, "description", "Description");
    const tags = optionalLength(args.tags, "tags", "Tags");
    const authorName = optionalLength(args.authorName, "authorName", "Name");
    const authorEmail = optionalLength(args.authorEmail, "authorEmail", "Email");
    if (authorEmail && !EMAIL_PATTERN.test(authorEmail)) {
      throw new ConvexError("Enter a valid email address, or leave it blank.");
    }

    // Rate limiting: max 5 submissions per hour per fingerprint
    const oneHourAgo = Date.now() - HOUR_MS;
    const rateLimit = await ctx.db
      .query("submissionRateLimits")
      .withIndex("by_key", (q) => q.eq("key", visitorFingerprint))
      .first();

    if (rateLimit) {
      if (rateLimit.blockedUntil && Date.now() < rateLimit.blockedUntil) {
        throw new ConvexError("Too many submissions. Please try again later.");
      }

      if (rateLimit.windowStart > oneHourAgo && rateLimit.count >= SUBMISSIONS_PER_VISITOR_PER_HOUR) {
        await ctx.db.patch(rateLimit._id, {
          blockedUntil: Date.now() + HOUR_MS,
        });
        throw new ConvexError("Too many submissions. Please try again in an hour.");
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

    // Site-wide backstop: a fresh fingerprint per request resets the check above, so
    // this key is shared by every submitter and survives fingerprint rotation.
    const globalLimit = await ctx.db
      .query("submissionRateLimits")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
    if (!globalLimit) {
      await ctx.db.insert("submissionRateLimits", { key: "global", count: 1, windowStart: Date.now() });
    } else if (globalLimit.windowStart <= oneHourAgo) {
      await ctx.db.patch(globalLimit._id, { count: 1, windowStart: Date.now(), blockedUntil: undefined });
    } else if (globalLimit.count >= SUBMISSIONS_SITE_WIDE_PER_HOUR) {
      throw new ConvexError("Submissions are paused for a short while. Please try again in an hour.");
    } else {
      await ctx.db.patch(globalLimit._id, { count: globalLimit.count + 1 });
    }

    const id = await ctx.db.insert("promptSubmissions", {
      title,
      promptText,
      tool: args.tool,
      category: args.category,
      difficulty: args.difficulty,
      description,
      tags,
      authorName,
      authorEmail,
      status: "pending",
      submittedAt: Date.now(),
      visitorFingerprint,
    });

    // Judged off the request path; the submitter never waits on it and a failure
    // simply leaves the submission pending for a human, as before.
    await ctx.scheduler.runAfter(0, internal.moderation.evaluate, { id });

    return { id, status: "pending" as const };
  },
});

export const listPending = query({
  args: {},
  returns: v.array(promptSubmissionDoc),
  handler: async (ctx) => {
    await requireAdminIdentity(ctx);

    const pending = await ctx.db
      .query("promptSubmissions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    // Highest review priority first; submissions not judged yet keep newest-first order after them.
    return pending.sort(
      (a, b) => (b.moderation?.priority ?? -1) - (a.moderation?.priority ?? -1),
    );
  },
});
