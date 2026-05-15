// Smoke test for the WhatsApp media path. Mirrors ideas-smoke: create a
// throwaway user, replay the 4 caption variants through dispatchWhatsappMessage
// directly, assert what landed in the DB, then delete the user (cascades).
//
// Run: npx tsx scripts/wa-smoke-media.ts
//
// What we cover (added by 6b6d792 "Honor URL and hashtag in media captions"):
//   1. image + URL in caption    -> saved as a link, source detected by URL
//   2. image + matching #tag     -> saved as media in the user's collection
//   3. image + non-matching #tag -> saved as media in "Roteiros" (fallback)
//   4. image + no caption        -> saved as media in "Roteiros"
//
// We don't need real Meta tokens: sendWhatsappReply guards on missing env and
// just logs. The proxy fetch (Meta Graph download) only fires on /api/whatsapp
// /file/[itemId], which the smoke never touches. summarizeAndSave is fire-
// and-forget and short-circuits when there's no Anthropic key.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

// Smoke must not hit Meta's API for sendWhatsappReply — clear the env so the
// reply helper short-circuits with its "missing PHONE_ID or ACCESS_TOKEN"
// guard instead of trying (and failing 401) against the real Graph endpoint.
delete process.env.WHATSAPP_ACCESS_TOKEN;
delete process.env.WHATSAPP_PHONE_ID;
// Same for Anthropic: handleSaveMessage fires summarizeAndSave; without the
// key it skips silently and avoids a post-cleanup "record not found" race.
delete process.env.SAVEHUB_CLAUDE_KEY;
delete process.env.ANTHROPIC_API_KEY;

import { prisma } from "../src/lib/db";
import {
  dispatchWhatsappMessage,
  type WhatsappIncomingMessage,
} from "../src/lib/whatsapp";

const WA_ID = "5511999990000-smoke";
const EMAIL = "wa-media-smoke@savehub.test";

type Case = {
  name: string;
  message: WhatsappIncomingMessage;
  expect: {
    collection: string;
    source: string;
    hasMediaId: boolean;
    urlIncludes?: string;
  };
};

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
}

// Mute the "WhatsApp send aborted" / "no Claude API key" log noise that the
// guards in whatsapp.ts and summarize.ts emit when their envs are absent.
// We intentionally cleared those envs above; the logs are signal in prod but
// pure noise here.
const SUPPRESS = [
  /WhatsApp send aborted/,
  /\[summarize\] no Claude API key/,
];
const origError = console.error;
const origWarn = console.warn;
function muted(orig: typeof console.error) {
  return (...args: unknown[]) => {
    const s = args.map(String).join(" ");
    if (SUPPRESS.some((re) => re.test(s))) return;
    orig(...args);
  };
}
console.error = muted(origError);
console.warn = muted(origWarn);

async function main() {
  await cleanup();

  const user = await prisma.user.create({
    data: { email: EMAIL, name: "WA Media Smoke", whatsappWaId: WA_ID },
  });
  console.log(`[seed] user ${user.id} (waId=${WA_ID})`);

  // Pre-create a collection so case 2 has a real target for #Estudo.
  await prisma.collection.create({
    data: { userId: user.id, name: "Estudo" },
  });

  const cases: Case[] = [
    {
      name: "image + URL in caption -> saved as link",
      message: {
        from: WA_ID,
        type: "image",
        image: { id: "wa-media-1", caption: "olha esse https://example.com" },
      },
      expect: {
        collection: "Roteiros",
        source: "web",
        hasMediaId: false,
        urlIncludes: "example.com",
      },
    },
    {
      name: "image + matching #Estudo -> saved in Estudo",
      message: {
        from: WA_ID,
        type: "image",
        image: { id: "wa-media-2", caption: "anota #Estudo" },
      },
      expect: { collection: "Estudo", source: "whatsapp", hasMediaId: true },
    },
    {
      name: "image + non-matching hashtag -> Roteiros fallback",
      message: {
        from: WA_ID,
        type: "image",
        image: { id: "wa-media-3", caption: "#InexistenteForaDaLista" },
      },
      expect: { collection: "Roteiros", source: "whatsapp", hasMediaId: true },
    },
    {
      name: "image + no caption -> Roteiros, as media",
      message: {
        from: WA_ID,
        type: "image",
        image: { id: "wa-media-4" },
      },
      expect: { collection: "Roteiros", source: "whatsapp", hasMediaId: true },
    },
  ];

  let passed = 0;
  let failed = 0;

  try {
    for (const c of cases) {
      console.log(`\n[case] ${c.name}`);

      const before = await prisma.savedItem.count({
        where: { userId: user.id },
      });

      await dispatchWhatsappMessage(WA_ID, c.message);

      const after = await prisma.savedItem.count({
        where: { userId: user.id },
      });
      if (after !== before + 1) {
        console.error(`  FAIL: expected 1 new item, got ${after - before}`);
        failed++;
        continue;
      }

      const item = await prisma.savedItem.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { collection: true },
      });
      if (!item) {
        console.error("  FAIL: no item returned after dispatch");
        failed++;
        continue;
      }

      const checks: Array<[string, unknown, unknown]> = [
        ["collection", item.collection.name, c.expect.collection],
        ["source", item.source, c.expect.source],
        ["hasMediaId", !!item.whatsappMediaId, c.expect.hasMediaId],
      ];
      if (c.expect.urlIncludes) {
        checks.push([
          "url includes",
          item.url.includes(c.expect.urlIncludes),
          true,
        ]);
      }

      let caseFailed = false;
      for (const [label, got, want] of checks) {
        if (got !== want) {
          console.error(
            `  FAIL ${label}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`,
          );
          caseFailed = true;
        }
      }
      if (caseFailed) {
        console.error(
          `  full item: ${JSON.stringify(
            {
              title: item.title,
              source: item.source,
              collectionName: item.collection.name,
              url: item.url,
              whatsappMediaId: item.whatsappMediaId,
              tags: item.tags,
            },
            null,
            2,
          )}`,
        );
        failed++;
      } else {
        console.log(`  OK: "${item.title}" -> ${item.collection.name}`);
        passed++;
      }
    }
  } finally {
    await cleanup();
    console.log("\n[cleanup] user + cascades deleted");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch(async (err) => {
    console.error("[smoke] FAILED:", err);
    await cleanup().catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
