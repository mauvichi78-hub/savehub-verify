// Throwaway smoke-test seed: ensure a fake user + fresh WhatsApp link token
// exist, then print the token so curl can replay /start <token>.
import { prisma } from "../src/lib/db";

// Inlined from src/lib/whatsapp.ts (avoid pulling summarize.ts → server-only,
// which throws when imported outside a Next.js server runtime).
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateWhatsappLinkCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return out;
}

async function main() {
  const email = "wa-smoke@savehub.test";
  const user = await prisma.user.upsert({
    where: { email },
    update: { whatsappWaId: null },
    create: { email, name: "WA Smoke" },
  });

  await prisma.whatsappLinkToken.deleteMany({ where: { userId: user.id } });

  const token = generateWhatsappLinkCode(6);
  await prisma.whatsappLinkToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });

  console.log(JSON.stringify({ userId: user.id, email, token }));
}

main().finally(() => prisma.$disconnect());
