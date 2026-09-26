import { choice, noul, score } from './_client.mjs';

// Each level stands on its own and describes a concrete situation, so a Score lands
// on the same scale for every prompt and results stay comparable across the catalog.
export const QUALITY_DIMENSIONS = {
  clarity: {
    weight: 0.3,
    levels: [
      'The prompt is confusing or self-contradictory; an AI tool would have to guess what is being asked.',
      'The overall goal is understandable, but key instructions are vague or leave major decisions to the AI tool.',
      'The task and expected result are clearly stated, with only minor ambiguity.',
      'The task, constraints, audience and expected result are all stated precisely; nothing important is left to guesswork.',
    ],
    instructions: 'How clearly does `prompt.promptText` tell an AI tool what to do?',
  },
  specificity: {
    weight: 0.25,
    levels: [
      'A generic one-line request that anyone could have typed without thinking, such as "write a blog post about X".',
      'Adds a little context or a role, but the output would still be generic.',
      'Gives concrete context, constraints or steps that noticeably shape the output.',
      'Encodes real domain expertise: specific steps, criteria, edge cases or examples that a non-expert would not think to include.',
    ],
    instructions: 'How much concrete guidance and domain expertise does `prompt.promptText` contain?',
  },
  reusability: {
    weight: 0.25,
    levels: [
      'Hard-coded to one specific situation; a different user could not reuse it without rewriting most of it.',
      'Reusable in principle, but the parts a user must change are not marked or are easy to miss.',
      'The parts a user must change are marked as placeholders and cover most of what varies between users.',
      'Every part that varies between users is a clearly named placeholder, and the rest works unchanged for anyone.',
    ],
    instructions: 'How easily can a different person reuse `prompt.promptText` for their own situation by filling in placeholders like [VARIABLE]?',
  },
  outputGuidance: {
    weight: 0.2,
    levels: [
      'Says nothing about the form of the response.',
      'Hints at the kind of response wanted, such as "a list" or "a short summary", without detail.',
      'Specifies the format, length or structure of the response.',
      'Specifies format, structure and quality bar for the response, so two runs would produce comparably shaped results.',
    ],
    instructions: 'How well does `prompt.promptText` specify the format and structure of the response it wants?',
  },
};

export function qualityQuestions() {
  return Object.fromEntries(
    Object.entries(QUALITY_DIMENSIONS).map(([id, dimension]) => [id, score(dimension.instructions, dimension.levels)]),
  );
}

export function categoryQuestion(categories) {
  return choice(
    'Which catalog category best fits the main job `prompt.promptText` does for the user?',
    Object.fromEntries(categories.map((category) => [category.slug, category.description])),
  );
}

export const DIFFICULTY_LEVELS = {
  beginner: 'Usable by someone new to AI tools: paste it, fill in obvious blanks, get a useful result.',
  intermediate: 'Needs the user to supply meaningful context or make several choices, or chains a few steps.',
  advanced: 'Needs domain expertise or technical setup to use well, or orchestrates a complex multi-stage workflow.',
};

export function difficultyQuestion() {
  return choice('How much skill does a user need to use `prompt.promptText` well?', DIFFICULTY_LEVELS);
}

export function descriptionAccuracyQuestion(field) {
  return noul(
    `Does \`prompt.${field}\` accurately describe what \`prompt.promptText\` actually does?`,
    {
      true: 'Every claim in the description is delivered by the prompt text; nothing important is overstated.',
      false: 'The description promises something the prompt text does not do, or describes a different task.',
    },
  );
}

export function tagQuestion(tag) {
  return noul(
    `Is "${tag}" an accurate tag for \`prompt.promptText\`?`,
    {
      true: 'Someone browsing this tag would expect to find this prompt and would find it relevant.',
      false: 'The tag names a topic, tool or technique the prompt does not meaningfully involve.',
    },
  );
}

/** Weighted composite of normalized 0–1 dimension scores. Weights live in code, not in the model. */
export function compositeQuality(normalizedScores, dimensions = QUALITY_DIMENSIONS) {
  let total = 0;
  let weightSum = 0;
  for (const [id, dimension] of Object.entries(dimensions)) {
    const value = normalizedScores[id];
    if (typeof value !== 'number') continue;
    total += value * dimension.weight;
    weightSum += dimension.weight;
  }
  return weightSum > 0 ? total / weightSum : null;
}
