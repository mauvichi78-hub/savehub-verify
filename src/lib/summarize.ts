// Server-side only — calls Prisma + outbound HTTP. Don't import from a
// client component. (Used to use `import "server-only"` as a build guard,
// but the bot script (`scripts/run-bot.ts`) runs outside the Next runtime
// and the guard module throws on load there.)
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { sourceNames } from "./data";
import type { Source } from "./types";

// Read SAVEHUB_CLAUDE_KEY first to dodge a local-dev collision: when the dev
// server is spawned from inside Claude Code, the shell already has
// `ANTHROPIC_API_KEY=` (empty) exported, and Node does not let `.env.local`
// override existing process env. SAVEHUB_CLAUDE_KEY is the project-local
// name; ANTHROPIC_API_KEY remains the canonical name in Vercel/production.
function readKey(): string | undefined {
  return process.env.SAVEHUB_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY || undefined;
}

// Lazy singleton — defers `new Anthropic({...})` until the first call so the
// constructor sees the env vars dotenv loads at runtime. ES module imports
// are hoisted; the bot script (`scripts/run-bot.ts`) runs `dotenv.config(...)`
// AFTER all imports, so any top-level `new Anthropic(...)` in this file
// would otherwise get `apiKey: undefined` and stick with that forever.
const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };
function getClient(): Anthropic {
  if (!globalForAnthropic.anthropic) {
    globalForAnthropic.anthropic = new Anthropic({ apiKey: readKey() });
  }
  return globalForAnthropic.anthropic;
}

type SummarizeInput = {
  title: string;
  description: string;
  url: string;
  source: Source;
};

// Asks Claude for both the summary AND a small set of topical tags in one
// call. The model is instructed to return strict JSON; we parse defensively
// (Markdown fences, leading/trailing prose) and fall back to summary-only
// behavior on parse failure so we never lose the summary just because tags
// went sideways.
const SYSTEM_PROMPT =
  "Você organiza uma biblioteca pessoal de links salvos chamada SaveHub.\n\n" +
  "Pra cada item recebido, retorne UM ÚNICO objeto JSON com a forma exata:\n" +
  "{\n" +
  '  "summary": "2 a 3 frases curtas em português brasileiro descrevendo, com base nas informações disponíveis, o que o conteúdo provavelmente oferece e por que vale revisitar. Foco em utilidade prática (o que dá pra aprender, aplicar ou referenciar). Direto, sem floreio. NÃO comece com \\"Este link...\\" ou \\"O conteúdo...\\".",\n' +
  '  "tags": ["3 a 6 tags em português brasileiro", "minúsculas, sem #", "tópicos / áreas / técnicas mencionadas, NÃO genéricos como \\"video\\" ou \\"link\\""]\n' +
  "}\n\n" +
  "Retorne APENAS o JSON. Nada de markdown, nada de comentário antes ou depois.";

type ClaudeOutput = { summary?: string; tags?: string[] };

// Strip markdown code fences and trim — Claude sometimes wraps JSON in
// ```json ... ``` despite the prompt asking it not to. Defensive only.
function parseClaudeJSON(raw: string): ClaudeOutput | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped) as ClaudeOutput;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function safeParseExistingTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

// Fire-and-forget: never throws. The bot/UI reply has already been sent;
// failure here just means the item stays with `summarized: false` and can be
// reprocessed later.
export async function summarizeAndSave(
  itemId: string,
  input: SummarizeInput,
): Promise<void> {
  if (!readKey()) {
    console.warn(
      `[summarize] no Claude API key (SAVEHUB_CLAUDE_KEY / ANTHROPIC_API_KEY) — skipping ${itemId}`,
    );
    return;
  }

  try {
    const userPrompt = [
      `Fonte: ${sourceNames[input.source]}`,
      `Título: ${input.title}`,
      `Descrição: ${input.description}`,
      `URL: ${input.url}`,
    ].join("\n");

    const response = await getClient().messages.create({
      model: "claude-haiku-4-5",
      // Bumped from 256 to 400 to comfortably fit the JSON envelope + 3-6
      // tags + 2-3 sentence summary in PT-BR.
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!rawText) {
      console.error(`[summarize] empty response for item ${itemId}`);
      return;
    }

    const parsed = parseClaudeJSON(rawText);
    // Fall back gracefully: if JSON parse failed, treat the entire output as
    // the summary. Tags just don't get added — better than losing the summary.
    const summary = parsed?.summary?.trim() || rawText;
    const aiTags = Array.isArray(parsed?.tags) ? parsed.tags : [];

    if (!summary) {
      console.error(`[summarize] empty summary for item ${itemId}`);
      return;
    }

    // Merge AI tags with whatever programmatic tags the save flow already
    // attached (collection name, source, channel handle, etc.). Dedupe
    // case-insensitively, keep original casing of first occurrence, cap to
    // a reasonable total so the JSON column doesn't grow unbounded.
    const existing = await prisma.savedItem.findUnique({
      where: { id: itemId },
      select: { tags: true },
    });
    const existingTags = safeParseExistingTags(existing?.tags ?? "[]");
    const cleanedAi = aiTags
      .filter((t) => typeof t === "string")
      .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
      .filter((t) => t.length > 0 && t.length <= 40);

    const seen = new Set<string>();
    const merged: string[] = [];
    for (const t of [...existingTags, ...cleanedAi]) {
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(t);
      if (merged.length >= 20) break;
    }

    await prisma.savedItem.update({
      where: { id: itemId },
      data: { summary, summarized: true, tags: JSON.stringify(merged) },
    });
  } catch (e) {
    console.error(`[summarize] failed for item ${itemId}:`, e);
  }
}
