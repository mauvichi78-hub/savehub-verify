// Re-export Auth.js handlers as the App Router catch-all for /api/auth/*.
// Auth.js v5 wraps sign-in, callback, sign-out, session etc in a single pair
// of GET/POST handlers exposed via `handlers`.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
