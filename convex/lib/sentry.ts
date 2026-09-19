// Reports errors that Convex deliberately swallows, so an outage in a fail-soft
// dependency is still visible outside the Convex dashboard logs.
//
// None of the @sentry/* SDKs run here: Convex functions execute in a V8 isolate
// (no "use node"), and those packages need Node globals like `async_hooks` and
// `process`, or browser globals like `window`. Convex's built-in Sentry
// integration does not help either — it only sees *uncaught* exceptions, and the
// whole point of these call sites is that they catch. So this speaks Sentry's
// envelope wire format directly over `fetch`, which the isolate does have.

const ENVELOPE_TIMEOUT_MS = 1500;
const THROTTLE_MS = 60_000;
const MAX_VALUE_LENGTH = 1000;

// Best-effort throttle so a sustained outage reports about once a minute rather
// than once per request. Module state lives as long as the isolate, so this
// resets on a cold start — fine, since it only ever errs toward reporting more.
const lastReportedAt = new Map<string, number>();

type ParsedDsn = { host: string; projectId: string; publicKey: string };

function parseDsn(raw: string): ParsedDsn | null {
  try {
    const url = new URL(raw);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !projectId) return null;
    return { host: url.host, projectId, publicKey: url.username };
  } catch {
    return null;
  }
}

/** Sentry wants 32 hex chars; these only need to be unique, not unguessable. */
function newEventId(): string {
  let id = "";
  for (let i = 0; i < 32; i += 1) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

function describe(error: unknown): { type: string; value: string; stack?: string } {
  if (error instanceof Error) {
    return { type: error.name || "Error", value: error.message, stack: error.stack };
  }
  // Defensive: `String({})` is "[object Object]", which tells you nothing when
  // this is the only record you have of the failure.
  if (typeof error === "object" && error !== null) {
    try {
      return { type: "Error", value: JSON.stringify(error) };
    } catch {
      return { type: "Error", value: String(error) };
    }
  }
  return { type: "Error", value: String(error) };
}

/**
 * Send one error to Sentry. Never throws and never rejects: monitoring must not
 * be able to break the path it is monitoring.
 *
 * Awaited by design. Convex gives no guarantee that work still outstanding when
 * an action returns will finish, so a fire-and-forget report would be dropped
 * exactly when it matters most. The timeout bounds the cost, and it is only ever
 * paid on a path that has already failed.
 */
export async function reportSwallowedError(
  summary: string,
  error: unknown,
  tags: Record<string, string> = {},
): Promise<void> {
  try {
    const dsn = parseDsn(process.env.SENTRY_DSN?.trim() || "");
    if (!dsn) return;

    const now = Date.now();
    const throttledAt = lastReportedAt.get(summary);
    if (throttledAt !== undefined && now - throttledAt < THROTTLE_MS) return;
    lastReportedAt.set(summary, now);

    const eventId = newEventId();
    const { type, value, stack } = describe(error);
    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: new Date(now).toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        event_id: eventId,
        timestamp: now / 1000,
        platform: "node",
        level: "error",
        logger: "convex",
        server_name: "convex",
        environment: process.env.SENTRY_ENVIRONMENT?.trim() || "production",
        tags: { runtime: "convex", ...tags },
        // Sentry only renders a stack it can parse into frames, and Convex
        // stacks are not worth parsing here. Attaching the raw string still
        // makes the difference between a network failure and an API rejection
        // obvious during triage.
        ...(stack ? { extra: { stack } } : {}),
        exception: {
          values: [
            {
              type,
              value: `${summary}: ${value}`.slice(0, MAX_VALUE_LENGTH),
              // Caught on purpose — say so, rather than let Sentry present these
              // as crashes that took the request down.
              mechanism: { type: "generic", handled: true },
            },
          ],
        },
      }),
    ].join("\n");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ENVELOPE_TIMEOUT_MS);
    try {
      await fetch(
        `https://${dsn.host}/api/${dsn.projectId}/envelope/?sentry_version=7&sentry_key=${dsn.publicKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-sentry-envelope" },
          body: envelope,
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Swallowed on purpose: see the doc comment above.
  }
}
