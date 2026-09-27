import type { MutationCtx } from "../_generated/server";

/**
 * Tables that hold a fixed-window request budget: one row per key with the number of
 * calls spent since `windowStart`. Both tables share the same shape.
 */
type BudgetTable = "voteRateLimits" | "assistRateLimits";

/**
 * Spends one call from the budget stored under `key`. Returns false once `limit` calls
 * have been spent inside the current `windowMs` window, so the caller can refuse the
 * request. The window resets on the first call after it expires.
 *
 * Used by public mutations that anonymous visitors can call directly, where the only
 * client identifier is a self-issued visitor id that a script can rotate at will. A
 * per-visitor key throttles an honest client; a "global" key caps what rotation can do.
 */
export async function spendBudget(
  ctx: MutationCtx,
  table: BudgetTable,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const row = await ctx.db
    .query(table)
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!row) {
    await ctx.db.insert(table, { key, count: 1, windowStart: now });
    return true;
  }
  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch(row._id, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= limit) return false;
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return true;
}
