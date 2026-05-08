// AI-driven content idea generator. Takes a Collection's saved items and
// produces production-ready briefs for a target platform.
//
// Server-side only — calls Prisma + Anthropic. Mirrors summarize.ts's
// lazy-singleton + dual-key-name pattern (see comments there for why).

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { sourceNames } from "./data";
import type { Source } from "./types";

export type Platform =
  | "instagram-reels"
  | "instagram-carousel"
  | "instagram-post"
  | "youtube-short"
  | "youtube-long";

export const PLATFORM_LABELS: Record<Platform, string> = {
  "instagram-reels": "Instagram Reels (vídeo curto vertical, 30–90s)",
  "instagram-carousel": "Instagram Carrossel (5–10 slides com texto)",
  "instagram-post": "Instagram Post (foto + caption longa)",
  "youtube-short": "YouTube Short (vídeo curto vertical, ≤60s)",
  "youtube-long": "YouTube vídeo longo (5–20min)",
};

// Per-platform guidance baked into the prompt. The brief shape is the same
// across platforms; this just tells the model what "good structure" looks
// like for each format so the bullets actually map to a producible piece.
const PLATFORM_GUIDANCE: Record<Platform, string> = {
  "instagram-reels":
    "Reels favorece hook nos primeiros 1–3s, ritmo rápido, 1 ideia central. structure = beats do roteiro (ex: 'Cena 1: …', 'Cut: …'). hashtags com mix de nicho específico + 1-2 amplas.",
  "instagram-carousel":
    "Carrossel favorece progressão entre slides. structure = 1 bullet por slide (slide 1 = capa/promessa, slides 2–N = desenvolvimento, último = CTA visual). hashtags de nicho.",
  "instagram-post":
    "Post de feed depende mais da caption. structure = beats da caption (lead, desenvolvimento em 2-3 mini-blocos, fechamento). hashtags de nicho.",
  "youtube-short":
    "Short é vertical e <60s. structure = beats do roteiro com tempo aproximado (ex: '0–3s hook', '3–15s desenvolvimento', '15–55s tese', '55–60s CTA'). hashtags com #shorts incluso.",
  "youtube-long":
    "Long-form tolera 5–20min. structure = capítulos do vídeo (intro, 3-5 seções, conclusão). hashtags como tópicos pesquisáveis.",
};

export type GeneratedIdea = {
  title: string;
  hook: string;
  angle: string;
  structure: string[];
  cta: string;
  hashtags: string[];
  // Subset of the input item ids — which items inspired this specific idea.
  sourceItemIds: string[];
};

function readKey(): string | undefined {
  return (
    process.env.SAVEHUB_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY || undefined
  );
}

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };
function getClient(): Anthropic {
  if (!globalForAnthropic.anthropic) {
    globalForAnthropic.anthropic = new Anthropic({ apiKey: readKey() });
  }
  return globalForAnthropic.anthropic;
}

function buildSystemPrompt(): string {
  return [
    "Você é um estrategista de conteúdo para criadores brasileiros.",
    "Você recebe uma coleção de referências (links que o criador salvou) e gera ideias de conteúdo prontas pra produzir em uma plataforma específica.",
    "",
    "Princípios:",
    "- USÁVEL: nada de ideia genérica ou pseudo-filosófica. O criador precisa conseguir gravar/produzir a partir do brief.",
    "- ESPECÍFICA da plataforma alvo: formato, ritmo, padrão de atenção daquele público.",
    "- ANCORADA: cada ideia cita 1–3 itens da coleção (use os IDs literais que vierem no input).",
    "- VOZ de criador em PT-BR. Nada de linguagem corporativa, nada de \"alavancar\", \"otimizar\", \"engajar\".",
    "",
    "Retorne UM ÚNICO objeto JSON com a forma exata:",
    "{",
    '  "ideas": [',
    "    {",
    '      "title": "título curto, máx 70 chars",',
    '      "hook": "1–2 frases que prendem nos primeiros segundos",',
    '      "angle": "1 frase com a tese ou promessa da peça",',
    '      "structure": ["bullet 1", "bullet 2", "bullet 3"],',
    '      "cta": "1 frase do que pedir no fim",',
    '      "hashtags": ["sem #", "tudo minúsculas", "5 a 8"],',
    '      "sourceItemIds": ["item-id-do-input", "outro-item-id"]',
    "    }",
    "  ]",
    "}",
    "",
    "Retorne APENAS o JSON. Sem markdown, sem comentário antes ou depois.",
  ].join("\n");
}

function buildUserPrompt(args: {
  collectionName: string;
  itemsBlob: string;
  platform: Platform;
  count: number;
}): string {
  return [
    `Coleção: "${args.collectionName}"`,
    `Plataforma alvo: ${PLATFORM_LABELS[args.platform]}`,
    `Número de ideias: ${args.count}`,
    "",
    `Guia da plataforma: ${PLATFORM_GUIDANCE[args.platform]}`,
    "",
    "Itens da coleção (use os IDs literais em sourceItemIds):",
    args.itemsBlob,
    "",
    `Gere ${args.count} ideias de conteúdo distintas. Cada ideia usa 1–3 itens como referência. Evite repetir tema entre ideias da mesma rodada.`,
  ].join("\n");
}

// Strip markdown code fences and trim — Claude sometimes wraps JSON in
// ```json ... ``` despite the prompt asking it not to.
type ClaudeIdeasOutput = { ideas?: unknown };
function parseIdeasJson(raw: string): ClaudeIdeasOutput | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped) as ClaudeIdeasOutput;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// Sanitize one idea object from the model response. Defensive: missing or
// wrong-typed fields fall back to safe defaults instead of throwing — we'd
// rather hand the caller a partially-empty idea than lose the whole batch.
function validateIdea(raw: unknown): GeneratedIdea {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    title: asString(r.title, "Sem título").slice(0, 120),
    hook: asString(r.hook),
    angle: asString(r.angle),
    structure: asStringArray(r.structure),
    cta: asString(r.cta),
    hashtags: asStringArray(r.hashtags)
      .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
      .filter((t) => t.length > 0 && t.length <= 40),
    sourceItemIds: asStringArray(r.sourceItemIds),
  };
}

type CollectionItemRow = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
};

function buildItemsBlob(items: CollectionItemRow[]): string {
  return items
    .map((it) => {
      const sourceName =
        sourceNames[it.source as Source] ?? it.source;
      // Keep summary trimmed — we hit ~50 items × ~300 chars and the prompt
      // grows fast. 240 chars is enough to convey the gist for ideation.
      const summary =
        it.summary && it.summary !== "Resumindo..."
          ? it.summary.slice(0, 240)
          : "(sem resumo)";
      return `id=${it.id} | source=${sourceName} | título="${it.title}" | resumo="${summary}" | url=${it.url}`;
    })
    .join("\n");
}

// Cap how many items we feed to the model. 50 is plenty of context without
// blowing up tokens; collections beyond that take the most recent 50.
const MAX_ITEMS_FOR_PROMPT = 50;

export async function generateIdeasForCollection(
  collectionId: string,
  options: { platform: Platform; count: number },
): Promise<GeneratedIdea[]> {
  if (!readKey()) {
    throw new Error(
      "Missing Anthropic API key (set SAVEHUB_CLAUDE_KEY or ANTHROPIC_API_KEY)",
    );
  }
  if (options.count < 1 || options.count > 10) {
    throw new Error("count must be between 1 and 10");
  }
  if (!(options.platform in PLATFORM_LABELS)) {
    throw new Error(`Unknown platform: ${options.platform}`);
  }

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        take: MAX_ITEMS_FOR_PROMPT,
        select: {
          id: true,
          title: true,
          summary: true,
          url: true,
          source: true,
        },
      },
    },
  });
  if (!collection) {
    throw new Error(`Collection ${collectionId} not found`);
  }
  if (collection.items.length === 0) {
    throw new Error("Collection is empty — nothing to base ideas on");
  }

  const userPrompt = buildUserPrompt({
    collectionName: collection.name,
    itemsBlob: buildItemsBlob(collection.items),
    platform: options.platform,
    count: options.count,
  });

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5",
    // Each idea is ~120–180 words ≈ ~250 tokens; with JSON envelope and 10
    // ideas we land well below 4k.
    max_tokens: 4000,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!rawText) {
    throw new Error("Empty response from Claude");
  }

  const parsed = parseIdeasJson(rawText);
  if (!parsed || !Array.isArray(parsed.ideas)) {
    console.error("[ideas] failed to parse Claude response. Raw:", rawText.slice(0, 500));
    throw new Error("Failed to parse ideas JSON from Claude response");
  }

  // Drop empty/garbage ideas. An "idea" with no hook AND no angle AND no
  // structure has nothing for the creator to work with — better to surface
  // fewer good briefs than to paste skeletons into the UI.
  const validItemIds = new Set(collection.items.map((i) => i.id));
  return parsed.ideas
    .map(validateIdea)
    .filter((i) => i.hook || i.angle || i.structure.length > 0)
    .map((i) => ({
      ...i,
      // Drop hallucinated item ids that don't actually belong to this collection.
      sourceItemIds: i.sourceItemIds.filter((id) => validItemIds.has(id)),
    }));
}
