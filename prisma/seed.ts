import { PrismaClient } from "@prisma/client";
import { collections, seedItems } from "../src/lib/data";

const prisma = new PrismaClient();

const DEV_USER_EMAIL = "dev@savehub.local";

async function main() {
  // Idempotent: clear existing items for the dev user, then re-insert.
  // (Until auth lands, this is the single demo user.)
  const user = await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: {
      email: DEV_USER_EMAIL,
      name: "SaveHub demo",
    },
  });

  // Wipe items + collections for the dev user so seed is reproducible.
  await prisma.savedItem.deleteMany({ where: { userId: user.id } });
  await prisma.collection.deleteMany({ where: { userId: user.id } });

  // Create the 4 default collections.
  const collectionRecords = await Promise.all(
    collections.map((name) =>
      prisma.collection.create({
        data: { name, userId: user.id },
      }),
    ),
  );

  const collectionByName = new Map(
    collectionRecords.map((c) => [c.name, c]),
  );

  // Now create the seed items, mapping collection name -> id.
  // Backdate createdAt so the relative-date helper renders the same labels
  // as the legacy prototype ("Hoje", "Ontem", "Seg", "Dom", "12 abr"...).
  // The labels resolve relative to "now" at view time, so this is just an
  // approximation — once real users save content these stamps mean nothing.
  const now = new Date();
  function daysAgo(n: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  }

  // Map seed id -> backdated createdAt. Order in the array determines
  // insertion order; createdAt determines list ordering in the UI.
  const dateOverrides: Record<string, Date> = {
    "yt-hooks": daysAgo(0),
    "ig-carousel": daysAgo(1),
    "tt-hook": daysAgo(0),
    "tw-thread": daysAgo(0),
    "wa-audio": daysAgo(6),
    "tg-channel": daysAgo(7),
    "web-report": daysAgo(14),
  };

  for (const item of seedItems) {
    const collection = collectionByName.get(item.collection);
    if (!collection) {
      console.warn(`Collection ${item.collection} missing for ${item.id}`);
      continue;
    }
    await prisma.savedItem.create({
      data: {
        title: item.title,
        source: item.source,
        sourceLabel: item.sourceLabel,
        type: item.type,
        url: item.url,
        description: item.description,
        summary: item.summary,
        tags: JSON.stringify(item.tags),
        status: item.status,
        summarized: item.summarized,
        image: item.image,
        userId: user.id,
        collectionId: collection.id,
        createdAt: dateOverrides[item.id] ?? now,
      },
    });
  }

  console.log(
    `Seeded user ${user.email} with ${collectionRecords.length} collections and ${seedItems.length} items.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
