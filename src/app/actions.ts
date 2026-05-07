"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { detectSource, sourceNames, sourceType, thumbnails } from "@/lib/data";
import { generateLinkCode } from "@/lib/telegram";
import { generateWhatsappLinkCode } from "@/lib/whatsapp";
import { fetchUrlMetadata } from "@/lib/url-metadata";
import { summarizeAndSave } from "@/lib/summarize";

export type SaveItemInput = {
  url: string;
  title?: string;
  collection: string;
};

export async function saveItemAction(input: SaveItemInput): Promise<{ ok: true }> {
  const url = input.url.trim();
  if (!url) throw new Error("URL is required");

  const userId = await getCurrentUserId();
  const source = detectSource(url);
  const collectionName = input.collection.trim() || "Roteiros";

  // Pull og:/twitter: metadata from the URL so the saved item gets the real
  // title, thumbnail and description. Falls back to source-generic values
  // when fetching fails (offline, blocked, slow, non-HTML).
  const meta = await fetchUrlMetadata(url);
  const title =
    (input.title ?? "").trim() ||
    meta.title ||
    `${sourceNames[source]} salvo`;
  const description =
    meta.description || `Novo conteúdo salvo em ${collectionName}.`;
  const image = meta.image || thumbnails[source];

  const collection = await prisma.collection.upsert({
    where: { userId_name: { userId, name: collectionName } },
    update: {},
    create: { name: collectionName, userId },
  });

  const item = await prisma.savedItem.create({
    data: {
      title,
      source,
      sourceLabel: sourceNames[source],
      type: sourceType[source],
      url,
      description,
      summary: "Resumindo...",
      tags: JSON.stringify([
        collectionName.toLowerCase(),
        sourceNames[source].toLowerCase(),
      ]),
      status: "Para usar",
      summarized: false,
      image,
      userId,
      collectionId: collection.id,
    },
  });

  void summarizeAndSave(item.id, { title, description, url, source });

  revalidatePath("/");
  return { ok: true };
}

const TOKEN_TTL_MINUTES = 10;

/**
 * Mint a fresh 6-character code that the user types into the Telegram bot
 * (`/start <code>`) to link this account to their Telegram chat. Replaces
 * any previous unexpired tokens for the same user so we always have at most
 * one active code per user.
 */
export async function createTelegramLinkToken(): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const userId = await getCurrentUserId();
  // Drop any existing tokens for this user — only one active code at a time.
  await prisma.telegramLinkToken.deleteMany({ where: { userId } });

  // Tiny retry loop in the very rare collision case.
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateLinkCode(6);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);
    try {
      await prisma.telegramLinkToken.create({
        data: { token, userId, expiresAt },
      });
      return { token, expiresAt };
    } catch {
      // Probably PK collision; pick another code.
    }
  }
  throw new Error("Could not generate a unique Telegram link token");
}

export async function getTelegramConnection(): Promise<{
  connected: boolean;
  chatId: string | null;
}> {
  const userId = await getCurrentUserId();
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });
  return { connected: !!u?.telegramChatId, chatId: u?.telegramChatId ?? null };
}

export async function disconnectTelegram(): Promise<{ ok: true }> {
  const userId = await getCurrentUserId();
  await prisma.user.update({
    where: { id: userId },
    data: { telegramChatId: null },
  });
  await prisma.telegramLinkToken.deleteMany({ where: { userId } });
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// WhatsApp linking — same pattern as Telegram.
// ---------------------------------------------------------------------------

export async function createWhatsappLinkToken(): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const userId = await getCurrentUserId();
  await prisma.whatsappLinkToken.deleteMany({ where: { userId } });
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateWhatsappLinkCode(6);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);
    try {
      await prisma.whatsappLinkToken.create({
        data: { token, userId, expiresAt },
      });
      return { token, expiresAt };
    } catch {
      // PK collision; retry.
    }
  }
  throw new Error("Could not generate a unique WhatsApp link token");
}

export async function getWhatsappConnection(): Promise<{
  connected: boolean;
  waId: string | null;
}> {
  const userId = await getCurrentUserId();
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { whatsappWaId: true },
  });
  return { connected: !!u?.whatsappWaId, waId: u?.whatsappWaId ?? null };
}

export async function disconnectWhatsapp(): Promise<{ ok: true }> {
  const userId = await getCurrentUserId();
  await prisma.user.update({
    where: { id: userId },
    data: { whatsappWaId: null },
  });
  await prisma.whatsappLinkToken.deleteMany({ where: { userId } });
  revalidatePath("/settings");
  return { ok: true };
}
