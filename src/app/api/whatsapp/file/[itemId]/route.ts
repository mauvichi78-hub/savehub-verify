import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Proxy a saved WhatsApp media file out to the user, hiding the access token.
//
// Why proxy instead of redirect: Meta's media-download URL is signed AND
// requires the Authorization: Bearer header — there's no way to give the
// browser a clickable link without exposing WHATSAPP_ACCESS_TOKEN. Streaming
// through us keeps the token server-side and gives us a stable URL
// (`/api/whatsapp/file/<itemId>`) that we can store on the SavedItem
// instead of an ephemeral one (Meta media URLs expire in ~5 min).
//
// Auth: must be logged in AND own the item. Item IDs are cuids (not
// guessable) but ownership check is cheap and stops a leaked-id-in-logs
// from becoming a real exposure.

const GRAPH_API_VERSION = "v21.0";
// 50 min — well under Meta's ~5 min URL TTL is irrelevant since we re-resolve
// every request, but keeping the response cacheable for the same client for a
// short window avoids re-fetching the same image while scrolling the library.
const FILE_TTL_S = 60 * 50;

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
    select: { userId: true, whatsappMediaId: true, type: true, title: true },
  });

  if (!item || item.userId !== session.user.id) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!item.whatsappMediaId) {
    return new NextResponse("Item has no attached WhatsApp media", { status: 404 });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    return new NextResponse("WhatsApp not configured", { status: 503 });
  }

  // Step 1: media_id -> downloadable URL via Graph API.
  let mediaUrl: string;
  let mediaMime: string;
  try {
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(item.whatsappMediaId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!r.ok) {
      console.error(
        "[whatsapp-proxy] media meta failed:",
        r.status,
        await r.text().catch(() => ""),
      );
      return new NextResponse("WhatsApp media lookup failed", { status: 502 });
    }
    const body = (await r.json()) as { url?: string; mime_type?: string };
    if (!body.url) {
      console.error("[whatsapp-proxy] media meta missing url:", body);
      return new NextResponse("WhatsApp media unavailable", { status: 502 });
    }
    mediaUrl = body.url;
    mediaMime = body.mime_type ?? "application/octet-stream";
  } catch (e) {
    console.error("[whatsapp-proxy] media meta threw:", e);
    return new NextResponse("WhatsApp media lookup error", { status: 502 });
  }

  // Step 2: fetch bytes (still needs Bearer header) and stream through.
  const fileResp = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileResp.ok || !fileResp.body) {
    return new NextResponse("WhatsApp media fetch failed", { status: 502 });
  }

  const contentType = fileResp.headers.get("content-type") ?? mediaMime;
  // Suggest a download filename derived from the saved item title; let the
  // browser display inline for image/video/audio so opening the URL shows
  // the content directly.
  const isInline = /^(image|video|audio)\//.test(contentType);
  const safeName =
    item.title.replace(/[^\w.\-]+/g, "_").slice(0, 80) || `savehub-${itemId}`;
  const dispositionType = isInline ? "inline" : "attachment";

  return new NextResponse(fileResp.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${dispositionType}; filename="${safeName}"`,
      "Cache-Control": `private, max-age=${FILE_TTL_S}`,
    },
  });
}
