import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

// Auth.js v5 (NextAuth) — single config powering both server-side helpers
// (auth(), handlers) and middleware.
//
// Persistence: Prisma adapter still owns the User/Account rows (so we keep
// our DB user id and the createUser bootstrap event below).
//
// Sessions: stored as JWT in a signed cookie, NOT in the DB. This skips a
// Prisma round-trip per request — meaningful for the proxy middleware which
// runs on every page load — and lets us deploy to edge runtimes (Cloudflare,
// Vercel Edge) that can't open Prisma connections from the request handler.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      // Auth.js v5 picks AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from env
      // automatically; explicit here for clarity / future overrides.
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Force account chooser so users can switch Google accounts on login.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Runs whenever a JWT is created/updated. On first sign-in (when `user`
    // is provided), copy the DB user id onto the token so subsequent
    // requests can identify the user without a DB read.
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    // Shapes the Session object returned by `auth()` and exposed to the
    // client. With JWT strategy `user` is no longer the DB row — it's
    // synthesized from the token. We pull `id` from the token where the
    // jwt callback put it.
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
  events: {
    // Fires once, when a User row is first created (i.e. first Google sign-in).
    // Bootstrap the four default collections so the new user lands on a
    // populated library shell instead of an empty state.
    async createUser({ user }) {
      if (!user.id) return;
      const defaults = ["Roteiros", "Referências", "Estudo", "Produtos"];
      await Promise.all(
        defaults.map((name) =>
          prisma.collection.create({ data: { userId: user.id!, name } }),
        ),
      );
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  // Carry the DB user id on the JWT itself so the session callback can hand
  // it to the client without going back to Prisma.
  // (Augmenting @auth/core/jwt rather than next-auth/jwt — the latter is just
  // a re-export and module augmentation only flows through the source.)
  interface JWT {
    userId?: string;
  }
}
