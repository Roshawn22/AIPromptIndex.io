// Pure moderation policy: TypeSafe supplies judgments, this file decides what they mean.
// Thresholds are conservative starting points — only near-certain spam is acted on
// automatically, and a human still approves everything that gets published.

export const MODERATION_THRESHOLDS = {
  autoSpam: 0.92,
  likelySpam: 0.6,
  relabelConfidence: 0.6,
  similarPrompt: 0.7,
  uncertainConfidence: 0.45,
};

export const QUALITY_WEIGHTS = { clarity: 0.3, specificity: 0.3, reusability: 0.2, outputGuidance: 0.2 };

export type ModerationJudgments = {
  spamProbability: number | null;
  usableProbability: number | null;
  quality: Partial<Record<keyof typeof QUALITY_WEIGHTS, number | null>>;
  tool: { choice: string; confidence: number } | null;
  category: { choice: string; confidence: number } | null;
  difficulty: { choice: string; confidence: number } | null;
  similar: { url: string; title: string; probability: number }[];
};

export type ModerationDecision = {
  status: "pending" | "spam";
  priority: number;
  qualityScore: number | null;
  suggestedTool?: string;
  suggestedCategory?: string;
  suggestedDifficulty?: string;
  similarTo?: { url: string; title: string; probability: number };
  needsCarefulReview: boolean;
  notes: string[];
};

export function compositeQuality(quality: ModerationJudgments["quality"]): number | null {
  let total = 0;
  let weightSum = 0;
  for (const [dimension, weight] of Object.entries(QUALITY_WEIGHTS)) {
    const value = quality[dimension as keyof typeof QUALITY_WEIGHTS];
    if (typeof value !== "number") continue;
    total += value * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? total / weightSum : null;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function decideModeration(
  submitted: { tool: string; category: string; difficulty: string },
  judgments: ModerationJudgments,
  thresholds = MODERATION_THRESHOLDS,
): ModerationDecision {
  const notes: string[] = [];
  const spam = judgments.spamProbability ?? 0;
  const qualityScore = compositeQuality(judgments.quality);
  let needsCarefulReview = false;

  const decision: ModerationDecision = {
    status: "pending",
    priority: 0,
    qualityScore,
    needsCarefulReview: false,
    notes,
  };

  if (spam >= thresholds.autoSpam) {
    decision.status = "spam";
    notes.push(`Auto-marked as spam (${percent(spam)} likely spam or self-promotion).`);
  } else if (spam >= thresholds.likelySpam) {
    needsCarefulReview = true;
    notes.push(`Possible spam (${percent(spam)}); left for human review.`);
  }

  if (typeof judgments.usableProbability === "number" && judgments.usableProbability < 0.4) {
    notes.push(`May not be a usable prompt (${percent(judgments.usableProbability)} likely usable).`);
  }

  const relabels: [keyof typeof submitted, ModerationJudgments["tool"], "suggestedTool" | "suggestedCategory" | "suggestedDifficulty"][] = [
    ["tool", judgments.tool, "suggestedTool"],
    ["category", judgments.category, "suggestedCategory"],
    ["difficulty", judgments.difficulty, "suggestedDifficulty"],
  ];
  for (const [field, judgment, target] of relabels) {
    if (!judgment) continue;
    if (judgment.choice !== submitted[field] && judgment.confidence >= thresholds.relabelConfidence) {
      decision[target] = judgment.choice;
      notes.push(`Suggested ${field}: "${judgment.choice}" instead of "${submitted[field]}" (confidence ${percent(judgment.confidence)}).`);
    } else if (field === "category" && judgment.confidence < thresholds.uncertainConfidence) {
      // Tool and difficulty often have several acceptable answers (most text prompts work in
      // any chat assistant), so a flat distribution there is not a reason for extra scrutiny.
      needsCarefulReview = true;
    }
  }

  const closest = [...judgments.similar].sort((a, b) => b.probability - a.probability)[0];
  if (closest && closest.probability >= thresholds.similarPrompt) {
    decision.similarTo = closest;
    notes.push(`Similar to existing prompt "${closest.title}" (${closest.url}, ${percent(closest.probability)}).`);
  }

  if (qualityScore !== null) notes.push(`Quality ${Math.round(qualityScore * 100)}/100.`);

  // Review queue order: good, clean, novel submissions first.
  const quality = qualityScore ?? 0.5;
  decision.priority = Math.max(0, Math.round(100 * quality * (1 - spam) * (decision.similarTo ? 0.6 : 1)));
  decision.needsCarefulReview = needsCarefulReview;
  return decision;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it", "of", "on", "or",
  "that", "the", "this", "to", "with", "your", "you", "ai", "prompt", "prompts",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export type CatalogItem = { name: string; description: string; url: string; type: string; tags?: string[] };

/** Lexical shortlist of catalog prompts worth asking the model about; the model never sees the rest. */
export function shortlistSimilar(submissionText: string, catalog: CatalogItem[], limit = 5): CatalogItem[] {
  const queryTokens = new Set(tokenize(submissionText));
  if (queryTokens.size === 0) return [];
  return catalog
    .filter((item) => item.type === "prompt")
    .map((item) => {
      const nameTokens = new Set(tokenize(item.name));
      const otherTokens = new Set(tokenize(`${item.description} ${(item.tags ?? []).join(" ")}`));
      let overlap = 0;
      for (const token of queryTokens) {
        if (nameTokens.has(token)) overlap += 3;
        if (otherTokens.has(token)) overlap += 1;
      }
      return { item, overlap };
    })
    .filter((entry) => entry.overlap >= 3)
    .sort((a, b) => b.overlap - a.overlap || a.item.url.localeCompare(b.item.url))
    .slice(0, limit)
    .map((entry) => entry.item);
}
