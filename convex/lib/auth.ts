import type { UserIdentity } from "convex/server";

type AuthContext = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
};

const adminUserIds = new Set(
  (process.env.CLERK_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

export async function requireIdentity(
  ctx: AuthContext,
  message = "Must be signed in.",
): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error(message);
  }
  return identity;
}

export function isAdminIdentity(identity: UserIdentity): boolean {
  return adminUserIds.has(identity.subject);
}

export async function requireAdminIdentity(ctx: AuthContext): Promise<UserIdentity> {
  const identity = await requireIdentity(
    ctx,
    "Must be signed in to view pending submissions.",
  );
  if (!isAdminIdentity(identity)) {
    throw new Error("Must be an admin to view pending submissions.");
  }
  return identity;
}
