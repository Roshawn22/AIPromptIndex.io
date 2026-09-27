// Minimal TypeSafe System One client for Convex actions (HTTP API: https://docs.typesafe.ai/api.md).
// The key is read from the Convex deployment environment and never reaches the browser.

type Entry = string | null | { [key: string]: unknown } | unknown[];

export type NoulQuestion = { type: "noul"; instructions: Entry; criteria?: { true?: Entry; false?: Entry } };
export type ChoiceQuestion = { type: "choice"; instructions: Entry; criteria: Record<string, Entry> };
export type ScoreQuestion = { type: "score"; instructions: Entry; criteria: Entry[] };
export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type SystemOneResponse = {
  model: string;
  answers: Record<string, Answer>;
  usage: { input_tokens: number; output_tokens: number };
};

export const noul = (instructions: Entry, criteria?: NoulQuestion["criteria"]): NoulQuestion =>
  criteria ? { type: "noul", instructions, criteria } : { type: "noul", instructions };
export const choice = (instructions: Entry, criteria: Record<string, Entry>): ChoiceQuestion => ({
  type: "choice",
  instructions,
  criteria,
});
export const score = (instructions: Entry, criteria: Entry[]): ScoreQuestion => ({
  type: "score",
  instructions,
  criteria,
});

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);

export function isTypeSafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim());
}

export async function systemOne(
  request: { state: unknown; questions: Record<string, Question> },
  { maxAttempts = 3 }: { maxAttempts?: number } = {},
): Promise<SystemOneResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set for this Convex deployment.");
  const model = process.env.TYPESAFE_MODEL?.trim() || "jev-latest";

  let lastError: Error = new Error("TypeSafe request was not attempted.");
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let retryable = true;
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ state: request.state, model, questions: request.questions }),
      });
      if (response.ok) return (await response.json()) as SystemOneResponse;
      const body = await response.text();
      lastError = new Error(`TypeSafe request failed (${response.status}): ${body.slice(0, 300)}`);
      retryable = RETRYABLE_STATUSES.has(response.status);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    if (!retryable) break;
    if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

export function asNoul(answer: Answer | undefined): number | null {
  return answer?.type === "noul" ? answer.noul : null;
}

export function asChoice(answer: Answer | undefined): ChoiceAnswer | null {
  return answer?.type === "choice" ? answer : null;
}

/** Score answers are a probability-weighted level index; normalize to 0–1. */
export function asNormalizedScore(answer: Answer | undefined, levelCount: number): number | null {
  if (answer?.type !== "score" || levelCount < 2) return null;
  return Math.max(0, Math.min(1, answer.score / (levelCount - 1)));
}
