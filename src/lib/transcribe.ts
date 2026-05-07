// Server-side only — calls Prisma + outbound HTTP. Don't import from a
// client component. (See comment in summarize.ts for why we don't use the
// `server-only` guard module.)
import OpenAI from "openai";
import { prisma } from "./db";
import { summarizeAndSave } from "./summarize";

// Voice-note transcription via Groq's Whisper-large-v3-turbo (free tier).
//
// Why Groq instead of OpenAI: free tier with no card required (~14k
// requests/day, 30/min — more than enough for a personal SaveHub).
// Quality is the same Whisper model family; latency is actually faster.
// API is OpenAI-compatible so we keep the `openai` SDK and just swap the
// baseURL + model name.
//
// Flow (called fire-and-forget from the Telegram voice handler):
//   1. Resolve the Telegram file_id -> downloadable URL using the bot token.
//   2. Stream the audio bytes into Whisper for transcription.
//   3. Update the SavedItem: title becomes the first line of the transcript,
//      description holds the full text, summary is filled in by Claude.

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";

function readKey(): string | undefined {
  return (
    process.env.SAVEHUB_GROQ_KEY ||
    process.env.GROQ_API_KEY ||
    // Backwards-compat: if someone sets an OpenAI key instead, we'd still
    // route through Groq's URL (won't auth). Prefer the Groq names.
    undefined
  );
}

// Lazy singleton (see summarize.ts for the rationale): with dotenv loading
// in run-bot.ts happening AFTER imports, top-level `new OpenAI(...)` would
// see undefined and stick with it.
const globalForGroq = globalThis as unknown as { groq?: OpenAI };
function getClient(): OpenAI {
  if (!globalForGroq.groq) {
    globalForGroq.groq = new OpenAI({
      apiKey: readKey() ?? "missing",
      baseURL: GROQ_BASE_URL,
    });
  }
  return globalForGroq.groq;
}

// Groq's whisper endpoint accepts up to 25 MB. Telegram voice notes are
// well under (typically <2 MB for a few minutes of audio), but we cap
// defensively before paying for the upload round-trip.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function transcribeAndSave(
  itemId: string,
  telegramFileId: string,
): Promise<void> {
  if (!readKey()) {
    console.warn(
      `[transcribe] no Groq key (SAVEHUB_GROQ_KEY / GROQ_API_KEY) — skipping ${itemId}`,
    );
    return;
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn(`[transcribe] TELEGRAM_BOT_TOKEN missing — skipping ${itemId}`);
    return;
  }

  try {
    // 1. file_id -> file_path
    const metaRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(telegramFileId)}`,
    );
    if (!metaRes.ok) {
      console.error(`[transcribe] getFile failed for ${itemId}:`, metaRes.status);
      return;
    }
    const meta = (await metaRes.json()) as {
      ok?: boolean;
      result?: { file_path?: string; file_size?: number };
    };
    if (!meta.ok || !meta.result?.file_path) {
      console.error(`[transcribe] getFile non-ok for ${itemId}:`, meta);
      return;
    }
    if (meta.result.file_size && meta.result.file_size > MAX_AUDIO_BYTES) {
      console.warn(
        `[transcribe] audio too large for Whisper (${meta.result.file_size}b) — skipping ${itemId}`,
      );
      return;
    }

    // 2. Download the audio file.
    const audioRes = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${meta.result.file_path}`,
    );
    if (!audioRes.ok) {
      console.error(`[transcribe] audio fetch failed for ${itemId}:`, audioRes.status);
      return;
    }
    const audioBlob = await audioRes.blob();

    // 3. Whisper transcription via Groq. Telegram voice is OGG/Opus, which
    // Whisper accepts directly. Force pt-BR to avoid auto-detect drift on
    // short clips.
    const audioFile = new File([audioBlob], "voice.ogg", {
      type: audioBlob.type || "audio/ogg",
    });
    const transcription = await getClient().audio.transcriptions.create({
      file: audioFile,
      model: TRANSCRIPTION_MODEL,
      language: "pt",
      response_format: "text",
    });
    const text = String(transcription).trim();

    if (!text) {
      console.warn(`[transcribe] empty transcript for ${itemId}`);
      return;
    }

    // 4. Update the saved item with the real text.
    const titleCandidate = text.split(/[.!?\n]/)[0]?.trim() ?? text;
    const title =
      titleCandidate.length > 80
        ? titleCandidate.slice(0, 77) + "..."
        : titleCandidate;
    const description = text;

    const updated = await prisma.savedItem.update({
      where: { id: itemId },
      data: {
        title,
        description,
        summary: "Resumindo...",
        summarized: false,
      },
      select: { id: true, source: true, url: true },
    });

    // 5. Now that we have real text, run the AI summary on top of it.
    void summarizeAndSave(updated.id, {
      title,
      description,
      url: updated.url,
      source: updated.source as Parameters<typeof summarizeAndSave>[1]["source"],
    });
  } catch (e) {
    console.error(`[transcribe] failed for ${itemId}:`, e);
  }
}
