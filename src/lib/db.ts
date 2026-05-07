import { PrismaClient } from "@prisma/client";

// Singleton: in dev, Next's HMR re-imports modules and would otherwise spawn
// many PrismaClient instances. Stash one on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
