import "server-only";
import { auth } from "@/auth";

/**
 * Resolve the current user id from the Auth.js session.
 * Throws if the caller is not authenticated — pages reaching this point are
 * already gated by middleware, so a missing session is a programmer error.
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: no active session");
  }
  return session.user.id;
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
