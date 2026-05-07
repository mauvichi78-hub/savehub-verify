import "server-only";

import type { Collection, SavedItem as DBSavedItem } from "@prisma/client";
import { prisma } from "./db";
import { getCurrentUserId } from "./session";
import type { SavedItem, Source } from "./types";
import { formatRelativeDate, formatTime } from "./format";

type ItemWithCollection = DBSavedItem & { collection: Collection };

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function dbItemToUI(row: ItemWithCollection, now: Date): SavedItem {
  return {
    id: row.id,
    title: row.title,
    source: row.source as Source,
    sourceLabel: row.sourceLabel,
    collection: row.collection.name,
    type: row.type,
    date: formatRelativeDate(row.createdAt, now),
    time: formatTime(row.createdAt),
    url: row.url,
    description: row.description,
    summary: row.summary,
    tags: parseTags(row.tags),
    status: row.status,
    summarized: row.summarized,
    image: row.image,
  };
}

export async function listItems(): Promise<SavedItem[]> {
  const userId = await getCurrentUserId();
  const rows = await prisma.savedItem.findMany({
    where: { userId },
    include: { collection: true },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return rows.map((row) => dbItemToUI(row, now));
}

export async function listCollectionNames(): Promise<string[]> {
  const userId = await getCurrentUserId();
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { name: true },
  });
  return rows.map((r) => r.name);
}

export type CollectionSummary = {
  id: string;
  name: string;
  itemCount: number;
  createdAt: Date;
};

export async function listCollectionsWithCounts(): Promise<CollectionSummary[]> {
  const userId = await getCurrentUserId();
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { items: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    itemCount: r._count.items,
    createdAt: r.createdAt,
  }));
}

// Single item by id, scoped to current user. Returns null if not found or
// not owned (callers should treat both as 404 to avoid leaking existence).
export async function getItem(
  itemId: string,
): Promise<{ item: SavedItem; collectionId: string } | null> {
  const userId = await getCurrentUserId();
  const row = await prisma.savedItem.findFirst({
    where: { id: itemId, userId },
    include: { collection: true },
  });
  if (!row) return null;
  const now = new Date();
  return { item: dbItemToUI(row, now), collectionId: row.collectionId };
}

// Items in a single collection — for /collections/[id]. Throws if the
// collection doesn't belong to the current user (defense in depth; the page
// should also check before calling).
export async function listItemsInCollection(
  collectionId: string,
): Promise<{ collection: { id: string; name: string }; items: SavedItem[] }> {
  const userId = await getCurrentUserId();
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true, name: true },
  });
  if (!collection) {
    throw new Error("Collection not found or not owned by current user");
  }
  const rows = await prisma.savedItem.findMany({
    where: { userId, collectionId: collection.id },
    include: { collection: true },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return {
    collection,
    items: rows.map((row) => dbItemToUI(row, now)),
  };
}
