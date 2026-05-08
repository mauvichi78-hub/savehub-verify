"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import {
  generateIdeasForCollection,
  type Platform,
} from "@/lib/ideas";

// Generate N ideas from a collection's items and persist them as Idea rows.
//
// Auth: must be logged in AND own the collection.
// Returns the created Idea ids so the caller can navigate or animate.
export async function generateIdeasFromCollectionAction(input: {
  collectionId: string;
  platform: Platform;
  count: number;
}): Promise<{ createdIds: string[] }> {
  const userId = await getCurrentUserId();

  // Ownership check — generateIdeasForCollection itself doesn't gate on user,
  // it'd happily generate from anyone's collection. Block here.
  const collection = await prisma.collection.findUnique({
    where: { id: input.collectionId },
    select: { id: true, userId: true },
  });
  if (!collection || collection.userId !== userId) {
    throw new Error("Collection not found");
  }

  const ideas = await generateIdeasForCollection(input.collectionId, {
    platform: input.platform,
    count: input.count,
  });

  if (ideas.length === 0) {
    throw new Error("No ideas generated — try again or pick a fuller collection");
  }

  const created = await prisma.$transaction(
    ideas.map((idea) =>
      prisma.idea.create({
        data: {
          userId,
          title: idea.title,
          hook: idea.hook,
          angle: idea.angle,
          structure: JSON.stringify(idea.structure),
          cta: idea.cta,
          hashtags: JSON.stringify(idea.hashtags),
          platform: input.platform,
          sourceCollectionId: input.collectionId,
          sourceItemIds: JSON.stringify(idea.sourceItemIds),
        },
        select: { id: true },
      }),
    ),
  );

  // Refresh both the ideas gallery and the collection page (which can show
  // a "N ideas generated" badge or list).
  revalidatePath("/ideas");
  revalidatePath(`/collections/${input.collectionId}`);

  return { createdIds: created.map((c) => c.id) };
}

export async function updateIdeaStatusAction(input: {
  ideaId: string;
  status: "draft" | "used" | "discarded";
}): Promise<void> {
  const userId = await getCurrentUserId();
  const idea = await prisma.idea.findUnique({
    where: { id: input.ideaId },
    select: { userId: true },
  });
  if (!idea || idea.userId !== userId) {
    throw new Error("Idea not found");
  }
  await prisma.idea.update({
    where: { id: input.ideaId },
    data: { status: input.status },
  });
  revalidatePath("/ideas");
}

export async function updateIdeaNotesAction(input: {
  ideaId: string;
  notes: string;
}): Promise<void> {
  const userId = await getCurrentUserId();
  const idea = await prisma.idea.findUnique({
    where: { id: input.ideaId },
    select: { userId: true },
  });
  if (!idea || idea.userId !== userId) {
    throw new Error("Idea not found");
  }
  await prisma.idea.update({
    where: { id: input.ideaId },
    data: { notes: input.notes.slice(0, 4000) },
  });
  revalidatePath("/ideas");
}

export async function deleteIdeaAction(ideaId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { userId: true },
  });
  if (!idea || idea.userId !== userId) {
    throw new Error("Idea not found");
  }
  await prisma.idea.delete({ where: { id: ideaId } });
  revalidatePath("/ideas");
}
