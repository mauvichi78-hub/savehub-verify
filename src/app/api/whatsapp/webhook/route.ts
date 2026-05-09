import { NextResponse } from "next/server";
import {
  dispatchWhatsappMessage,
  type WhatsappIncomingMessage,
} from "@/lib/whatsapp";

// Meta Cloud API webhook endpoint for the SaveHub WhatsApp bot.
//
// Setup (developers.facebook.com → your app → WhatsApp → Configuration):
//   - Webhook URL:   https://<your-domain>/api/whatsapp/webhook
//   - Verify token:  the value of WHATSAPP_VERIFY_TOKEN below
//   - Subscriptions: enable "messages"
//
// Required env (.env.local):
//   WHATSAPP_VERIFY_TOKEN  any random string we share with Meta
//   WHATSAPP_ACCESS_TOKEN  permanent or temp Meta token
//   WHATSAPP_PHONE_ID      the bot's phone number ID (not the number itself)
//
// Local dev: Meta needs a public URL. Use ngrok or Cloudflare Tunnel:
//   ngrok http 3000  →  https://abcd1234.ngrok-free.app/api/whatsapp/webhook
// then paste that into Meta's webhook config.

// ---------------------------------------------------------------------------
// GET — Meta calls this once to verify ownership of the webhook URL.
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "WHATSAPP_VERIFY_TOKEN not configured" },
      { status: 503 },
    );
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — Meta delivers user messages here. We always return 200 fast so Meta
// stops retrying; the actual save runs after we've ack'd. (Saving via
// fetchUrlMetadata can take a few seconds — Meta would retry otherwise.)
// ---------------------------------------------------------------------------

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsappIncomingMessage[];
        contacts?: Array<{ wa_id?: string }>;
      };
    }>;
  }>;
};

export async function POST(req: Request) {
  let body: WebhookPayload;
  try {
    body = (await req.json()) as WebhookPayload;
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  // Pull all (waId, message) pairs out of Meta's nested envelope. The
  // dispatcher in lib/whatsapp.ts decides text vs media routing.
  const messages: Array<{ waId: string; message: WhatsappIncomingMessage }> = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        if (!m.from) continue;
        messages.push({ waId: m.from, message: m });
      }
    }
  }

  // Don't await processing — return 200 immediately so Meta doesn't retry.
  // Each message is dispatched independently; failures are logged but the
  // ack still goes back to Meta cleanly.
  for (const { waId, message } of messages) {
    void dispatchWhatsappMessage(waId, message).catch((e) => {
      console.error("WhatsApp message handler crashed:", e);
    });
  }

  return new NextResponse("OK", { status: 200 });
}
