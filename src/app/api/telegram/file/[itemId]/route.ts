import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Proxy a saved Telegram media file out to the user, hiding the bot token.
//
// Why proxy instead of redirect: Telegram's file-download URL is
// `https://api.telegram.org/file/bot<TOKEN>/<file_path>` — sending the user a
// 302 to that would leak the bot token. Streaming through us keeps the token
// server-side and gives us a stable URL (`/api/telegram/file/<itemId>`) that
// we can store on the SavedItem instead of an ephemeral one.
//
// Auth: must be logged in AND own the item. Item IDs are cuids (not
// guessable) but ownership check is cheap and stops a leaked-id-in-logs from
// becoming a real exposure.

const TELEGRAM_FILE_TTL_S = 60 * 50; // ~50 min — well under Telegram's 1h URL TTL

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const item = await prisma.savedItem.findUnique({
    where: { id: itemId },
    select: { userId: true, telegramFileId: true, type: true, title: true },
  });

  if (!item || item.userId !== session.user.id) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!item.telegramFileId) {
    return new NextResponse("Item has no attached Telegram file", { status: 404 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return new NextResponse("Telegram not configured", { status: 503 });
  }

  // Step 1: resolve file_id -> file_path via Telegram getFile API.
  let filePath: string;
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(item.telegramFileId)}`,
    );
    if (!r.ok) {
      console.error("[telegram-proxy] getFile failed:", r.status, await r.text().catch(() => ""));
      return new NextResponse("Telegram file lookup failed", { status: 502 });
    }
    const body = (await r.json()) as { ok?: boolean; result?: { file_path?: string }; description?: string };
    if (!body.ok || !body.result?.file_path) {
      console.error("[telegram-proxy] getFile non-ok:", body);
      return new NextResponse("Telegram file unavailable", { status: 502 });
    }
    filePath = body.result.file_path;
  } catch (e) {
    console.error("[telegram-proxy] getFile threw:", e);
    return new NextResponse("Telegram file lookup error", { status: 502 });
  }

  // Step 2: fetch the actual file bytes and stream them through.
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const fileResp = await fetch(fileUrl);
  if (!fileResp.ok || !fileResp.body) {
    return new NextResponse("Telegram file fetch failed", { status: 502 });
  }

  const contentType = fileResp.headers.get("content-type") ?? "application/octet-stream";
  // Suggest a download filename derived from the saved item title, but let the
  // browser display inline for image/video/audio types so the user sees the
  // content directly when opening the URL.
  const isInline = /^(image|video|audio)\//.test(contentType);
  const safeName = item.title.replace(/[^\w.\-]+/g, "_").slice(0, 80) || `savehub-${itemId}`;
  const dispositionType = isInline ? "inline" : "attachment";

  return new NextResponse(fileResp.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${dispositionType}; filename="${safeName}"`,
      "Cache-Control": `private, max-age=${TELEGRAM_FILE_TTL_S}`,
    },
  });
}
