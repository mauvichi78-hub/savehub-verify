import { NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { createBot } from "@/lib/telegram";

// Production transport for the SaveHub Telegram bot. In dev we use the
// long-polling runner (`npm run bot:dev`) and Telegram won't post here.
//
// To go live, set:
//   1. TELEGRAM_BOT_TOKEN in env
//   2. The bot's webhook URL via Telegram BotAPI:
//      curl -F "url=https://<your-domain>/api/telegram/webhook" \
//           https://api.telegram.org/bot<TOKEN>/setWebhook
//
// Optional but recommended: configure a secret token via setWebhook so we
// can verify Telegram is the caller (TELEGRAM_WEBHOOK_SECRET).

const token = process.env.TELEGRAM_BOT_TOKEN;

const handler = token
  ? webhookCallback(createBot(token), "std/http", {
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    })
  : null;

export async function POST(req: Request) {
  if (!handler) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 503 },
    );
  }
  return handler(req);
}
