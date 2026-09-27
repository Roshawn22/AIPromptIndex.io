import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import {
  type CatalogItem,
  type ModerationJudgments,
  decideModeration,
  shortlistSimilar,
} from "./lib/moderationPolicy";
import {
  type Question,
  asChoice,
  asNormalizedScore,
  asNoul,
  choice,
  isTypeSafeConfigured,
  noul,
  score,
  systemOne,
} from "./lib/typesafe";

const TOOLS: Record<string, string> = {
  chatgpt: "OpenAI ChatGPT: general text chat assistant.",
  claude: "Anthropic Claude: general text chat assistant, long documents.",
  gemini: "Google Gemini: general text chat assistant with Google integration.",
  midjourney: "Midjourney: image generation with parameters such as --ar or --v.",
  "dall-e": "OpenAI DALL-E: image generation from a natural-language description.",
  "stable-diffusion": "Stable Diffusion: image generation, often with weighted terms and negative prompts.",
  cursor: "Cursor: AI code editor that works across the files of a repository.",
  "github-copilot": "GitHub Copilot: in-editor code completion and chat.",
};

const CATEGORIES: Record<string, string> = {
  writing: "Content creation, copywriting, editing and creative writing.",
  coding: "Code generation, debugging, review, refactoring and technical documentation.",
  marketing: "Campaigns, social media, SEO content and ad copy.",
  "image-generation": "Prompts whose output is an image.",
  business: "Strategy, operations, planning, communication and management.",
  "data-analysis": "Analysing data, spreadsheets, SQL, statistics and reporting.",
  education: "Teaching, learning, lesson planning and studying.",
  creative: "Brainstorming, storytelling, worldbuilding, games and other creative play.",
};

const DIFFICULTIES: Record<string, string> = {
  beginner: "Usable by someone new to AI tools: paste it, fill in obvious blanks, get a useful result.",
  intermediate: "Needs the user to supply meaningful context or make several choices, or chains a few steps.",
  advanced: "Needs domain expertise or technical setup to use well, or orchestrates a complex multi-stage workflow.",
};

const QUALITY_QUESTIONS = {
  clarity: score("How clearly does `submission.promptText` tell an AI tool what to do?", [
    "Confusing or self-contradictory; an AI tool would have to guess what is being asked.",
    "The overall goal is understandable, but key instructions are vague.",
    "The task and expected result are clearly stated, with only minor ambiguity.",
    "The task, constraints, audience and expected result are all stated precisely.",
  ]),
  specificity: score("How much concrete guidance and domain expertise does `submission.promptText` contain?", [
    'A generic one-line request anyone could have typed, such as "write a blog post about X".',
    "Adds a little context or a role, but the output would still be generic.",
    "Gives concrete context, constraints or steps that noticeably shape the output.",
    "Encodes real domain expertise: specific steps, criteria, edge cases or examples.",
  ]),
  reusability: score("How easily can a different person reuse `submission.promptText` by filling in placeholders like [VARIABLE]?", [
    "Hard-coded to one specific situation; others would have to rewrite most of it.",
    "Reusable in principle, but the parts a user must change are not marked.",
    "The parts a user must change are marked as placeholders and cover most of what varies.",
    "Every part that varies between users is a clearly named placeholder; the rest works unchanged.",
  ]),
  outputGuidance: score("How well does `submission.promptText` specify the format and structure of the response it wants?", [
    "Says nothing about the form of the response.",
    'Hints at the kind of response wanted, such as "a list", without detail.',
    "Specifies the format, length or structure of the response.",
    "Specifies format, structure and quality bar, so two runs would produce comparably shaped results.",
  ]),
} as const;
const QUALITY_LEVEL_COUNT = 4;

export const getSubmission = internalQuery({
  args: { id: v.id("promptSubmissions") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const applyResult = internalMutation({
  args: {
    id: v.id("promptSubmissions"),
    status: v.union(v.literal("pending"), v.literal("spam")),
    reviewNotes: v.string(),
    moderation: v.object({
      evaluatedAt: v.number(),
      model: v.string(),
      priority: v.number(),
      needsCarefulReview: v.boolean(),
      spamProbability: v.optional(v.number()),
      qualityScore: v.optional(v.number()),
      suggestedTool: v.optional(v.string()),
      suggestedCategory: v.optional(v.string()),
      suggestedDifficulty: v.optional(v.string()),
      similarToUrl: v.optional(v.string()),
      similarProbability: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    // A human decision made while the judgment was in flight always wins.
    if (!submission || submission.status !== "pending") return null;
    await ctx.db.patch(args.id, {
      status: args.status,
      reviewNotes: args.reviewNotes,
      moderation: args.moderation,
    });
    return null;
  },
});

async function loadCatalog(): Promise<CatalogItem[]> {
  const siteUrl = (process.env.SITE_URL?.trim() || "https://aipromptindex.io").replace(/\/$/, "");
  try {
    const response = await fetch(`${siteUrl}/search-index.json`);
    if (!response.ok) return [];
    const items = (await response.json()) as CatalogItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    // Similarity is a nice-to-have; moderation proceeds without it.
    return [];
  }
}

export const evaluate = internalAction({
  args: { id: v.id("promptSubmissions") },
  handler: async (ctx, args) => {
    if (!isTypeSafeConfigured()) return null;
    const submission = await ctx.runQuery(internal.moderation.getSubmission, { id: args.id });
    if (!submission || submission.status !== "pending") return null;

    const similarCandidates = shortlistSimilar(
      `${submission.title} ${submission.description ?? ""} ${submission.tags ?? ""}`,
      await loadCatalog(),
    );

    // The submitter's own tool/category/difficulty are kept out of state so the model
    // judges the prompt rather than agreeing with the label it was given. Author name,
    // email and fingerprint are never sent to TypeSafe.
    const state = {
      submission: {
        title: submission.title,
        promptText: submission.promptText,
        description: submission.description ?? "",
      },
      existingPrompts: similarCandidates.map((item) => ({ title: item.name, description: item.description })),
    };

    const questions: Record<string, Question> = {
      spam: noul("Is `submission` spam, advertising or self-promotion rather than a genuine prompt shared for others to use?", {
        true: "Promotes a product, service, link or contact detail; is gibberish or keyword stuffing; or is unrelated to AI prompts.",
        false: "A genuine attempt to share a prompt, even if it is low quality or very short.",
      }),
      usable: noul("Could someone paste `submission.promptText` into an AI tool and get a useful result?", {
        true: "It is an instruction or template addressed to an AI tool.",
        false: "It is a question to the site, a comment, a test entry, or otherwise not a prompt.",
      }),
      tool: choice("Which AI tool is `submission.promptText` written for or best suited to?", TOOLS),
      category: choice("Which catalog category best fits the main job `submission.promptText` does for the user?", CATEGORIES),
      difficulty: choice("How much skill does a user need to use `submission.promptText` well?", DIFFICULTIES),
      ...QUALITY_QUESTIONS,
      ...Object.fromEntries(similarCandidates.map((_, index) => [
        `similar_${index}`,
        noul(`Does \`existingPrompts[${index}]\` already do essentially the same job as \`submission\`?`, {
          true: "Both produce the same kind of output for the same purpose; publishing both would feel redundant.",
          false: "They share a topic but serve different purposes, audiences or outputs.",
        }),
      ])),
    };

    let response;
    try {
      response = await systemOne({ state, questions });
    } catch (error) {
      // Leave the submission pending and untouched; a human reviews it as before.
      console.error("TypeSafe moderation failed", error);
      return null;
    }
    const { answers } = response;

    const pick = (id: string) => {
      const answer = asChoice(answers[id]);
      return answer ? { choice: answer.choice, confidence: answer.confidence } : null;
    };
    const judgments: ModerationJudgments = {
      spamProbability: asNoul(answers.spam),
      usableProbability: asNoul(answers.usable),
      quality: {
        clarity: asNormalizedScore(answers.clarity, QUALITY_LEVEL_COUNT),
        specificity: asNormalizedScore(answers.specificity, QUALITY_LEVEL_COUNT),
        reusability: asNormalizedScore(answers.reusability, QUALITY_LEVEL_COUNT),
        outputGuidance: asNormalizedScore(answers.outputGuidance, QUALITY_LEVEL_COUNT),
      },
      tool: pick("tool"),
      category: pick("category"),
      difficulty: pick("difficulty"),
      similar: similarCandidates.map((item, index) => ({
        url: item.url,
        title: item.name,
        probability: asNoul(answers[`similar_${index}`]) ?? 0,
      })),
    };

    const decision = decideModeration(
      { tool: submission.tool, category: submission.category, difficulty: submission.difficulty },
      judgments,
    );

    await ctx.runMutation(internal.moderation.applyResult, {
      id: args.id,
      status: decision.status,
      reviewNotes: `[TypeSafe] ${decision.notes.join(" ")}`,
      moderation: {
        evaluatedAt: Date.now(),
        model: response.model,
        priority: decision.priority,
        needsCarefulReview: decision.needsCarefulReview,
        ...(judgments.spamProbability !== null ? { spamProbability: judgments.spamProbability } : {}),
        ...(decision.qualityScore !== null ? { qualityScore: decision.qualityScore } : {}),
        ...(decision.suggestedTool ? { suggestedTool: decision.suggestedTool } : {}),
        ...(decision.suggestedCategory ? { suggestedCategory: decision.suggestedCategory } : {}),
        ...(decision.suggestedDifficulty ? { suggestedDifficulty: decision.suggestedDifficulty } : {}),
        ...(decision.similarTo
          ? { similarToUrl: decision.similarTo.url, similarProbability: decision.similarTo.probability }
          : {}),
      },
    });
    return null;
  },
});
