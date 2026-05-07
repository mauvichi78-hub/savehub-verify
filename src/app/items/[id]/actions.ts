"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_SUMMARY = 2000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

// Allowed values mirror what the bot/save flows produce. UI keeps it as a
// freeform string in the edit form but we still constrain length here.
const ALLOWED_STATUSES = ["Para usar", "Em uso", "Arquivado"] as const;

type EditFormInput = {
  itemId: string;
  title: string;
  description: string;
  summary: string;
  collectionId: string;
  status: string;
  // Comma-separated string from the form input — we split + dedupe here
  // before re-encoding into the JSON-array column.
  tagsRaw: string;
};

function parseTags(raw: string): string[] {
  const parts = raw
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, MAX_TAGS);
  // Dedupe case-insensitively but keep original casing of first occurrence.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of parts) {
    if (t.length > MAX_TAG_LENGTH) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function updateItem(
  input: EditFormInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Título não pode ficar vazio." };
  if (title.length > MAX_TITLE)
    return { ok: false, error: `Título pode ter no máximo ${MAX_TITLE} caracteres.` };

  const description = input.description.trim().slice(0, MAX_DESCRIPTION);
  const summary = input.summary.trim().slice(0, MAX_SUMMARY);

  const status = ALLOWED_STATUSES.includes(input.status as (typeof ALLOWED_STATUSES)[number])
    ? input.status
    : "Para usar";

  // Verify ownership of both the item AND the target collection before
  // touching anything — catches both "wrong user" and "moving to a
  // collection you don't own".
  const [item, collection] = await Promise.all([
    prisma.savedItem.findFirst({
      where: { id: input.itemId, userId },
      select: { id: true },
    }),
    prisma.collection.findFirst({
      where: { id: input.collectionId, userId },
      select: { id: true },
    }),
  ]);
  if (!item) return { ok: false, error: "Item não encontrado." };
  if (!collection)
    return { ok: false, error: "Coleção destino inválida." };

  const tags = parseTags(input.tagsRaw);

  await prisma.savedItem.update({
    where: { id: input.itemId },
    data: {
      title,
      description,
      summary,
      status,
      collectionId: input.collectionId,
      tags: JSON.stringify(tags),
      // If the user manually wrote a summary, mark it summarized so the AI
      // path doesn't re-overwrite on next pass.
      summarized: summary.length > 0 ? true : false,
    },
  });

  revalidatePath("/");
  revalidatePath("/collections");
  revalidatePath(`/collections/${input.collectionId}`);
  revalidatePath(`/items/${input.itemId}`);
  return { ok: true };
}

// Returns void on success because we redirect; client-side caller never
// rebuilds with the response anyway. Goes to / (library home) on success —
// matches the back-arrow behavior on /items/[id].
export async function deleteItemAction(itemId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const item = await prisma.savedItem.findFirst({
    where: { id: itemId, userId },
    select: { id: true, collectionId: true },
  });
  if (!item) return; // silent — already gone or not yours

  await prisma.savedItem.delete({ where: { id: item.id } });
  revalidatePath("/");
  revalidatePath("/collections");
  revalidatePath(`/collections/${item.collectionId}`);
  redirect("/");
}
