// Dev-mode SaveHub Telegram bot. Uses long-polling so it works on localhost
// without exposing a public URL. In production we'd switch to a webhook
// handler at /api/telegram/webhook (already wired) and skip this script.
//
// Run: npm run bot:dev
// Stop: Ctrl+C
//
// Requires env: TELEGRAM_BOT_TOKEN (in .env.local).
import { config } from "dotenv";
// Load .env.local first so its values take precedence over .env (matches
// Next.js env loading order). TELEGRAM_BOT_TOKEN lives in .env.local.
config({ path: ".env.local" });
config({ path: ".env" });

import { createBot } from "../src/lib/telegram";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error(
    "Missing TELEGRAM_BOT_TOKEN. Get one from @BotFather (/newbot) and add it to .env.local",
  );
  process.exit(1);
}

const bot = createBot(token);

async function main() {
  console.log("SaveHub bot starting (long-polling)...");
  const me = await bot.api.getMe();
  console.log(`  -> @${me.username} (id=${me.id})`);
  console.log("Listening for updates. Ctrl+C to stop.");

  // Drop any pending updates (so messages sent while the bot was off don't
  // flood in the moment we start).
  await bot.start({ drop_pending_updates: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
