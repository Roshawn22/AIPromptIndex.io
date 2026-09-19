/**
 * Browser-side access to the TypeSafe-backed Convex actions (convex/assist.ts).
 * Both features are off unless their PUBLIC_ flag is "true", and every call resolves to
 * `null` on any failure so the UI keeps its existing behaviour. The TypeSafe API key lives
 * only in the Convex deployment; nothing here can reach TypeSafe directly.
 */
import { getVisitorId } from './visitor';

type PublicEnv = Record<string, string | undefined>;
const env = (import.meta as ImportMeta & { env?: PublicEnv }).env ?? {};

export const searchRerankEnabled = env.PUBLIC_TYPESAFE_SEARCH_RERANK === 'true';
export const builderHintsEnabled = env.PUBLIC_TYPESAFE_BUILDER_HINTS === 'true';

// Read here rather than via ./convex, which would statically pull convex/react into the search bundle.
function getConvexUrl(): string | null {
  const url = env.PUBLIC_CONVEX_URL;
  return url && url !== 'https://your-convex-url.convex.cloud' ? url : null;
}

type AssistAction = 'rerankSearch' | 'checkVariable';
type Caller = (name: AssistAction, args: Record<string, unknown>) => Promise<unknown>;
let callerPromise: Promise<Caller | null> | null = null;

function getCaller(): Promise<Caller | null> {
  if (!callerPromise) {
    const url = getConvexUrl();
    callerPromise = url
      // Convex is loaded on demand so search and the builder only pay for it when a flag is on.
      ? Promise.all([import('convex/browser'), import('./convexApi')]).then(([{ ConvexHttpClient }, { api }]) => {
          const client = new ConvexHttpClient(url);
          return (name, args) => client.action(api.assist[name], args);
        })
      : Promise.resolve(null);
  }
  return callerPromise;
}

async function callAction<T>(name: AssistAction, args: Record<string, unknown>): Promise<T | null> {
  try {
    const call = await getCaller();
    if (!call) return null;
    return (await call(name, { visitorId: getVisitorId(), ...args })) as T | null;
  } catch {
    return null;
  }
}

export type RerankCandidate = { url: string; name: string; description: string; type: string };

/** Natural-language searches benefit from judging intent; one- or two-word lookups do not. */
export function shouldRerank(query: string, candidateCount: number): boolean {
  return searchRerankEnabled && candidateCount >= 2 && query.trim().split(/\s+/).length >= 3;
}

export async function rerankSearch(
  query: string,
  candidates: RerankCandidate[],
): Promise<Map<string, number> | null> {
  const scored = await callAction<{ url: string; relevance: number }[]>('rerankSearch', { query, candidates });
  return scored ? new Map(scored.map((entry) => [entry.url, entry.relevance])) : null;
}

/** Stable re-order: judged relevance first, original (Fuse) order as the tie-breaker. */
export function applyRelevance<T>(items: T[], getUrl: (item: T) => string, relevance: Map<string, number>): T[] {
  return items
    .map((item, index) => ({ item, index, relevance: relevance.get(getUrl(item)) ?? 0 }))
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index)
    .map((entry) => entry.item);
}

export async function checkVariableFit(input: {
  promptTitle: string;
  variableName: string;
  variableDescription: string;
  example: string;
  value: string;
}): Promise<number | null> {
  if (!builderHintsEnabled) return null;
  const result = await callAction<{ fits: number }>('checkVariable', input);
  return result ? result.fits : null;
}
