"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

// Length cap chosen to match what UI cards / hashtags can comfortably display
// without truncation. The unique([userId, name]) constraint already prevents
// duplicates per-user.
const MAX_NAME_LENGTH = 40;

function normalizeName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function validateName(raw: string): string {
  const name = normalizeName(raw);
  if (!name) throw new Error("Nome da coleção não pode ficar vazio");
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Nome da coleção pode ter no máximo ${MAX_NAME_LENGTH} caracteres`);
  }
  return name;
}

export async function createCollection(
  rawName: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  let name: string;
  try {
    name = validateName(rawName);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const existing = await prisma.collection.findUnique({
    where: { userId_name: { userId, name } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "Você já tem uma coleção com esse nome." };
  }

  const created = await prisma.collection.create({
    data: { userId, name },
    select: { id: true },
  });
  revalidatePath("/collections");
  revalidatePath("/");
  return { ok: true, id: created.id };
}

export async function renameCollection(
  id: string,
  rawName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  let name: string;
  try {
    name = validateName(rawName);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const target = await prisma.collection.findFirst({
    where: { id, userId },
    select: { id: true, name: true },
  });
  if (!target) {
    return { ok: false, error: "Coleção não encontrada." };
  }
  if (target.name === name) {
    return { ok: true }; // no-op; spare a DB write
  }

  const collision = await prisma.collection.findUnique({
    where: { userId_name: { userId, name } },
    select: { id: true },
  });
  if (collision && collision.id !== id) {
    return { ok: false, error: "Você já tem outra coleção com esse nome." };
  }

  await prisma.collection.update({ where: { id }, data: { name } });
  revalidatePath("/collections");
  revalidatePath(`/collections/${id}`);
  revalidatePath("/");
  return { ok: true };
}

// Schema cascades SavedItem deletes when a Collection is removed (see
// schema.prisma → SavedItem.collection onDelete: Cascade). So deleting a
// collection here drops every item inside it. Caller should confirm with
// the user first — UI shows the affected item count before calling.
export async function deleteCollection(
  id: string,
): Promise<{ ok: true; deletedItems: number } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const target = await prisma.collection.findFirst({
    where: { id, userId },
    select: { id: true, _count: { select: { items: true } } },
  });
  if (!target) {
    return { ok: false, error: "Coleção não encontrada." };
  }

  await prisma.collection.delete({ where: { id } });
  revalidatePath("/collections");
  revalidatePath("/");
  return { ok: true, deletedItems: target._count.items };
}
