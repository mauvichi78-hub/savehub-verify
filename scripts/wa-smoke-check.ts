// Verify the WhatsApp smoke test: did the /start link the user, and was the
// URL saved? Then clean up the test user.
import { prisma } from "../src/lib/db";

async function main() {
  const email = "wa-smoke@savehub.test";
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      collections: { include: { items: true } },
      whatsappLinkTokens: true,
    },
  });
  console.log(JSON.stringify({
    found: !!user,
    whatsappWaId: user?.whatsappWaId,
    leftoverTokens: user?.whatsappLinkTokens.length ?? 0,
    collections: user?.collections.map(c => ({
      name: c.name,
      items: c.items.map(i => ({
        title: i.title,
        source: i.source,
        url: i.url,
        tags: i.tags,
        summarized: i.summarized,
        summary: i.summary,
      })),
    })),
  }, null, 2));

  if (user) {
    await prisma.user.delete({ where: { id: user.id } });
    console.log("cleaned up");
  }
}

main().finally(() => prisma.$disconnect());
