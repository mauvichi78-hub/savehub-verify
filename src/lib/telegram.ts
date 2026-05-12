import { Bot, type Context } from "grammy";
import type { Message } from "grammy/types";
import { prisma } from "./db";
import { detectSource, sourceNames, sourceType, thumbnails } from "./data";
import { fetchUrlMetadata } from "./url-metadata";
import { summarizeAndSave } from "./summarize";
import { transcribeAndSave } from "./transcribe";

// ---------------------------------------------------------------------------
// SaveHub Telegram bot
//
// Two flows:
//   /start <code>            -> link this Telegram chat to a SaveHub user
//   <message with a URL>     -> save the URL into the user's library
//
// Designed to run identically in dev (long-polling) and prod (webhook).
// ---------------------------------------------------------------------------

const URL_REGEX = /https?:\/\/[^\s]+/i;
// Hashtags after the link choose the destination collection — `#Roteiros`,
// `#Estudo`, etc. Match-then-trim keeps it tolerant to punctuation.
const HASHTAG_REGEX = /#([\p{L}\p{N}_-]+)/gu;

function extractUrl(input: string | undefined): string | null {
  if (!input) return null;
  const m = input.match(URL_REGEX);
  if (!m) return null;
  // Strip trailing punctuation Telegram sometimes glues to URLs (`).`, `,`).
  const candidate = m[0].replace(/[.,;:!?)\]]+$/, "");
  // Sanity-check via the URL constructor so we don't try to save garbage like
  // `https://` alone or `http://x` without a real host.
  try {
    const u = new URL(candidate);
    if (!u.hostname.includes(".")) return null;
    return candidate;
  } catch {
    return null;
  }
}

function extractHashtags(input: string | undefined): string[] {
  if (!input) return [];
  const out: string[] = [];
  for (const m of input.matchAll(HASHTAG_REGEX)) out.push(m[1]);
  return out;
}

// Resolve the user's hashtag choice (e.g. `#Estudo`) to one of their existing
// collections (case-insensitive, accent-insensitive). Returns null when no
// hashtag matches — caller falls back to the default collection.
async function resolveCollectionFromHashtags(
  userId: string,
  hashtags: string[],
): Promise<{ id: string; name: string } | null> {
  if (hashtags.length === 0) return null;
  const userCollections = await prisma.collection.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  for (const tag of hashtags) {
    const match = userCollections.find((c) => norm(c.name) === norm(tag));
    if (match) return match;
  }
  return null;
}

// When the message was forwarded, surface where it came from. Used both as
// extra context for the saved item's description and as a tag, so the user
// can later filter by source channel/author in the library.
type ForwardInfo = {
  // Human-readable label, e.g. "Encaminhado de @channelName" or "Encaminhado de Maria".
  label: string;
  // Stable tag value, normalized — e.g. "@channelname" or "user:maria_silva".
  tag: string;
};

function readForwardInfo(message: Message): ForwardInfo | null {
  const fo = message.forward_origin;
  if (!fo) return null;

  switch (fo.type) {
    case "user": {
      const u = fo.sender_user;
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
      const handle = u.username ? `@${u.username}` : name || "usuário";
      return {
        label: `Encaminhado de ${handle}`,
        tag: u.username ? `@${u.username}` : `user:${name.toLowerCase()}`,
      };
    }
    case "hidden_user":
      return {
        label: `Encaminhado de ${fo.sender_user_name}`,
        tag: `user:${fo.sender_user_name.toLowerCase()}`,
      };
    case "chat": {
      const c = fo.sender_chat;
      const title = ("title" in c && c.title) || "grupo";
      return {
        label: `Encaminhado do grupo ${title}`,
        tag: `group:${String(title).toLowerCase()}`,
      };
    }
    case "channel": {
      const c = fo.chat;
      const handle = c.username ? `@${c.username}` : c.title || "canal";
      return {
        label: `Encaminhado do canal ${handle}`,
        tag: c.username ? `@${c.username}` : `channel:${(c.title ?? "").toLowerCase()}`,
      };
    }
  }
}

async function findUserByChat(chatId: number) {
  return prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
  });
}

async function handleStart(ctx: Context, code: string | undefined) {
  const chat = ctx.chat;
  if (!chat) return;
  const chatId = String(chat.id);

  // Already linked? Tell the user and stop.
  const existing = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: { email: true },
  });
  if (existing) {
    await ctx.reply(
      `Você já está conectado ao SaveHub como *${existing.email}*. Manda links pra eu salvar.`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (!code) {
    await ctx.reply(
      "Olá! Pra conectar este chat ao seu SaveHub:\n\n1) Abra o app SaveHub no navegador\n2) Clique em *Conectar Telegram*\n3) Reenvie aqui o comando que aparecer (com o código de 6 caracteres)",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // Validate the link token: exists, not expired.
  const token = await prisma.telegramLinkToken.findUnique({
    where: { token: code.trim().toUpperCase() },
    include: { user: true },
  });
  if (!token || token.expiresAt < new Date()) {
    await ctx.reply(
      "Código inválido ou expirado. Gere um novo no app e tente de novo.",
    );
    return;
  }

  // If this chatId is already linked to ANOTHER user, refuse — avoids
  // accidental cross-account hijacks.
  const occupied = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
  });
  if (occupied && occupied.id !== token.userId) {
    await ctx.reply(
      "Este chat já está vinculado a outra conta SaveHub. Faça /unlink na outra conta antes.",
    );
    return;
  }

  // Persist the link and consume the token.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { telegramChatId: chatId },
    }),
    prisma.telegramLinkToken.delete({ where: { token: token.token } }),
    // Bonus: clean up other expired tokens for this user.
    prisma.telegramLinkToken.deleteMany({
      where: { userId: token.userId, expiresAt: { lt: new Date() } },
    }),
  ]);

  await ctx.reply(
    `Conectado! 🎉\n\nA partir de agora, qualquer link que você mandar ou encaminhar pra mim eu salvo no SaveHub de *${token.user.email}*.`,
    { parse_mode: "Markdown" },
  );
}

// Show the last 10 saved items so the user can recall what's in their library
// without leaving the chat. Each row carries a short ID suffix that `/delete`
// accepts.
async function handleList(ctx: Context) {
  const chat = ctx.chat;
  if (!chat) return;
  const user = await findUserByChat(chat.id);
  if (!user) {
    await ctx.reply(
      "Este chat não está vinculado. Use /start <código> com o código do app SaveHub.",
    );
    return;
  }
  const items = await prisma.savedItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { collection: true },
  });
  if (items.length === 0) {
    await ctx.reply(
      "Você ainda não salvou nenhum item. Manda um link pra começar.",
    );
    return;
  }
  const lines = items
    .map((it, i) => {
      const shortId = it.id.slice(-6);
      const titleTrunc =
        it.title.length > 50 ? it.title.slice(0, 47) + "..." : it.title;
      return `${i + 1}. \`${shortId}\` — ${titleTrunc}\n   _${sourceNames[it.source as keyof typeof sourceNames] ?? it.sourceLabel} • ${it.collection.name}_`;
    })
    .join("\n\n");
  await ctx.reply(
    `*Últimos ${items.length} salvos:*\n\n${lines}\n\nPra apagar: \`/delete <id>\``,
    { parse_mode: "Markdown" },
  );
}

// Delete a specific saved item, addressed by the short ID suffix shown in
// /list. Uses endsWith so the user only types the last 6 chars; collision
// risk in 6 chars of a cuid suffix is astronomically low at any realistic
// library size.
async function handleDelete(ctx: Context, idArg: string | undefined) {
  const chat = ctx.chat;
  if (!chat) return;
  const user = await findUserByChat(chat.id);
  if (!user) {
    await ctx.reply("Este chat não está vinculado.");
    return;
  }
  if (!idArg) {
    await ctx.reply(
      "Use `/delete <id>` — onde `<id>` é os últimos 6 caracteres que aparecem em `/list` (ex: `lsz60`).",
      { parse_mode: "Markdown" },
    );
    return;
  }
  const suffix = idArg.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (suffix.length < 4) {
    await ctx.reply("ID muito curto. Use pelo menos 4 caracteres.");
    return;
  }
  const candidates = await prisma.savedItem.findMany({
    where: { userId: user.id, id: { endsWith: suffix } },
    select: { id: true, title: true },
  });
  if (candidates.length === 0) {
    await ctx.reply(`Nenhum item seu termina em \`${suffix}\`.`, {
      parse_mode: "Markdown",
    });
    return;
  }
  if (candidates.length > 1) {
    await ctx.reply(
      `Mais de um item bate com \`${suffix}\` (${candidates.length}). Use um ID mais longo.`,
      { parse_mode: "Markdown" },
    );
    return;
  }
  const [target] = candidates;
  await prisma.savedItem.delete({ where: { id: target.id } });
  await ctx.reply(`Apagado: _${target.title}_`, { parse_mode: "Markdown" });
}

// Show all collections with item counts.
async function handleCollections(ctx: Context) {
  const chat = ctx.chat;
  if (!chat) return;
  const user = await findUserByChat(chat.id);
  if (!user) {
    await ctx.reply("Este chat não está vinculado.");
    return;
  }
  const cols = await prisma.collection.findMany({
    where: { userId: user.id },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });
  if (cols.length === 0) {
    await ctx.reply(
      "Você ainda não tem coleções. A primeira é criada quando você salva o primeiro link.",
    );
    return;
  }
  const lines = cols
    .map(
      (c) =>
        `• *${c.name}* — ${c._count.items} ${c._count.items === 1 ? "item" : "itens"}`,
    )
    .join("\n");
  await ctx.reply(
    `*Suas coleções:*\n\n${lines}\n\nPra salvar em uma específica: mande o link com a hashtag, ex: \`link #${cols[0].name}\``,
    { parse_mode: "Markdown" },
  );
}

async function handleUnlink(ctx: Context) {
  const chat = ctx.chat;
  if (!chat) return;
  const user = await findUserByChat(chat.id);
  if (!user) {
    await ctx.reply("Este chat não está vinculado a nenhuma conta SaveHub.");
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null },
  });
  await ctx.reply("Desvinculado. Pra reconectar, gere um novo código no app.");
}

async function handleMessage(ctx: Context) {
  const chat = ctx.chat;
  const message = ctx.message;
  if (!chat || !message) return;

  const user = await findUserByChat(chat.id);
  if (!user) {
    await ctx.reply(
      "Este chat ainda não está vinculado. Use /start <código> com o código gerado no app SaveHub.",
    );
    return;
  }

  // Look in text and caption — Telegram puts forwarded link previews in either.
  const text = message.text ?? message.caption ?? "";

  // Telegram parses URLs into `entities`. A `text_link` carries a real `url`
  // (the masked target of `[text](url)` syntax); a plain `url` entity does not
  // — the URL itself is the substring of `text`. We only follow the explicit
  // `text_link.url` when present; otherwise we fall back to the regex on text.
  const entities = (message as { entities?: { type?: string; url?: string }[] }).entities ?? [];
  const textLinkUrl = entities.find((e) => e.type === "text_link" && e.url)?.url;
  const url = extractUrl(text) ?? extractUrl(textLinkUrl);

  if (!url) {
    // Distinguish "no URL at all" from "had something URL-shaped but malformed",
    // so the user gets a useful nudge instead of repeating the same try.
    const hasUrlShape = URL_REGEX.test(text) || !!textLinkUrl;
    if (hasUrlShape) {
      await ctx.reply(
        "Esse link parece quebrado (URL inválida). Confere e manda de novo.",
      );
    } else {
      await ctx.reply(
        "Não achei nenhum link nessa mensagem. Manda só o link, ou encaminha um post.",
      );
    }
    return;
  }

  const source = detectSource(url);
  const hashtags = extractHashtags(text);
  const requestedCollection = await resolveCollectionFromHashtags(
    user.id,
    hashtags,
  );

  // Fallback: default to "Roteiros" (creating it if the user hasn't yet).
  const fallbackName = "Roteiros";
  const collection =
    requestedCollection ??
    (await prisma.collection.upsert({
      where: { userId_name: { userId: user.id, name: fallbackName } },
      update: {},
      create: { userId: user.id, name: fallbackName },
    }));

  // Real og:/twitter: metadata when reachable; per-source defaults when not.
  const meta = await fetchUrlMetadata(url);
  const title =
    meta.title ||
    text.split("\n")[0]?.slice(0, 120) ||
    `${sourceNames[source]} salvo`;

  // Stitch in the forward origin (when present) so both the human-facing
  // description and the AI summary input know it came from a specific channel.
  const forward = readForwardInfo(message);
  const baseDescription =
    meta.description || `Salvo via Telegram em ${collection.name}.`;
  const description = forward
    ? `${forward.label}. ${baseDescription}`
    : baseDescription;
  const image = meta.image || thumbnails[source];

  const tags = [
    collection.name.toLowerCase(),
    sourceNames[source].toLowerCase(),
    "telegram",
  ];
  if (forward) tags.push(forward.tag);

  const item = await prisma.savedItem.create({
    data: {
      title,
      source,
      sourceLabel: sourceNames[source],
      type: sourceType[source],
      url,
      description,
      summary: "Resumindo...",
      tags: JSON.stringify(tags),
      status: "Para usar",
      summarized: false,
      image,
      userId: user.id,
      collectionId: collection.id,
    },
  });

  void summarizeAndSave(item.id, { title, description, url, source });

  // If the user used a hashtag we didn't recognize, hint at the available
  // ones so they can correct (without nagging on plain saves).
  let extra = "";
  if (hashtags.length > 0 && !requestedCollection) {
    const all = await prisma.collection.findMany({
      where: { userId: user.id },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    extra =
      `\n\n_Hashtag não bateu com coleção. Salvei em "${collection.name}". ` +
      `Disponíveis: ${all.map((c) => `#${c.name}`).join(", ")}_`;
  }

  // If the page didn't expose any usable metadata (no title, no description,
  // no image), the saved item only has fallback text. Tell the user so they
  // can edit it later instead of being surprised when the AI summary turns
  // out generic.
  const metaWasEmpty = !meta.title && !meta.description && !meta.image;
  const metaHint = metaWasEmpty
    ? "\n\n_Não consegui ler a página (provavelmente bloqueia bots). Editar manualmente no app se quiser._"
    : "";

  await ctx.reply(
    `Salvo: ${sourceNames[source]} → *${collection.name}*${extra}${metaHint}`,
    { parse_mode: "Markdown" },
  );
}

// Top-level wrapper: any unexpected throw inside handleMessage (DB hiccup,
// out-of-memory page metadata fetch, Prisma constraint, etc.) gets logged
// AND the user sees a friendly fallback instead of dead silence.
async function handleMessageSafe(ctx: Context) {
  try {
    await handleMessage(ctx);
  } catch (err) {
    console.error("Telegram handleMessage crashed:", err);
    try {
      await ctx.reply(
        "Algo deu errado do meu lado salvando isso. Tenta de novo em alguns segundos. Se persistir, manda mensagem pra gente.",
      );
    } catch (replyErr) {
      console.error("Telegram fallback reply also failed:", replyErr);
    }
  }
}

// ---------------------------------------------------------------------------
// Inline mode: lets the user type `@savehub_bot https://…` in any chat and
// save the link without ever opening the SaveHub bot DM. Telegram forces a
// two-step flow:
//   1. inline_query  — bot shows a preview card (must answer fast, < ~30s).
//   2. chosen_inline_result — fires after the user picks the card. The actual
//      save runs here (slower, no UI deadline).
//
// Since chosen_inline_result is a separate event, we have to remember which
// URL each preview pointed to. Telegram lets us pass a `result_id` (≤ 64
// bytes) but the URL itself can be longer, so we keep a small in-memory map
// keyed by a generated id. The map is best-effort: if the server restarts
// between query and selection, the save is dropped — acceptable trade-off.
//
// Requires enabling inline mode in @BotFather (`/setinline`) AND inline
// feedback (`/setinlinefeedback` -> Enabled) for the chosen_inline_result
// event to fire at all.
// ---------------------------------------------------------------------------

type InlineSelection = { url: string; tgUserId: string; createdAt: number };
const inlineSelectionCache = new Map<string, InlineSelection>();
const INLINE_CACHE_TTL_MS = 5 * 60_000;

function pruneInlineCache() {
  const now = Date.now();
  for (const [k, v] of inlineSelectionCache) {
    if (now - v.createdAt > INLINE_CACHE_TTL_MS) inlineSelectionCache.delete(k);
  }
}

// Save a link from any entry point (DM message OR inline result). Returns the
// created item or throws. Mirrors the shape of handleMessage's save path.
async function saveLinkForUser(
  userId: string,
  url: string,
  options: { sourceTag: "telegram" | "telegram-inline"; forwardLabel?: string },
) {
  const source = detectSource(url);
  const fallbackName = "Roteiros";
  const collection = await prisma.collection.upsert({
    where: { userId_name: { userId, name: fallbackName } },
    update: {},
    create: { userId, name: fallbackName },
  });

  const meta = await fetchUrlMetadata(url);
  const title = meta.title || `${sourceNames[source]} salvo`;
  const baseDescription =
    meta.description || `Salvo via Telegram em ${collection.name}.`;
  const description = options.forwardLabel
    ? `${options.forwardLabel}. ${baseDescription}`
    : baseDescription;
  const image = meta.image || thumbnails[source];

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
        collection.name.toLowerCase(),
        sourceNames[source].toLowerCase(),
        options.sourceTag,
      ]),
      status: "Para usar",
      summarized: false,
      image,
      userId,
      collectionId: collection.id,
    },
  });

  void summarizeAndSave(item.id, { title, description, url, source });
  return { item, collection };
}

// ---------------------------------------------------------------------------
// Media saves: photo / video / audio / document / video_note. Each one stores
// the Telegram file_id on the SavedItem and points `url` at our proxy route,
// which streams the bytes back without leaking the bot token. Voice notes
// take a separate path (handleVoice) since they trigger transcription.
// ---------------------------------------------------------------------------

type MediaInput = {
  fileId: string;
  mediaType: string; // "Foto" | "Vídeo" | "Áudio" | "Documento" | "Vídeo redondo"
  caption: string;
  forwardLabel?: string;
  hashtags?: string[];
};

async function saveMediaForUser(userId: string, input: MediaInput) {
  const fallbackName = "Roteiros";
  const requested = await resolveCollectionFromHashtags(
    userId,
    input.hashtags ?? [],
  );
  const collection =
    requested ??
    (await prisma.collection.upsert({
      where: { userId_name: { userId, name: fallbackName } },
      update: {},
      create: { userId, name: fallbackName },
    }));

  const baseTitle = input.caption.split("\n")[0]?.slice(0, 80);
  const title =
    baseTitle && baseTitle.length > 0
      ? baseTitle
      : `${input.mediaType} via Telegram`;
  const baseDescription =
    input.caption || `${input.mediaType} encaminhada via Telegram.`;
  const description = input.forwardLabel
    ? `${input.forwardLabel}. ${baseDescription}`
    : baseDescription;

  // Two-step: create with placeholder url, then patch to point at the proxy
  // (url path needs the just-generated item id).
  const created = await prisma.savedItem.create({
    data: {
      title,
      source: "telegram",
      sourceLabel: "Telegram",
      type: input.mediaType,
      url: "",
      description,
      // Media items don't get an AI summary in the MVP — there's no text yet
      // for Claude to chew on. Voice notes are the exception (handled
      // separately with transcription).
      summary:
        input.mediaType === "Voice"
          ? "Transcrevendo..."
          : `${input.mediaType} salvo via Telegram. Sem resumo automático no MVP.`,
      tags: JSON.stringify([
        collection.name.toLowerCase(),
        "telegram",
        input.mediaType.toLowerCase(),
      ]),
      status: "Para usar",
      summarized: input.mediaType !== "Voice",
      // No useful thumbnail without an extra Telegram round-trip; leave blank.
      image: "",
      telegramFileId: input.fileId,
      userId,
      collectionId: collection.id,
    },
  });

  // For photos, point the item's image at the same proxy URL so the library
  // card and homepage detail panel show the actual photo as a thumbnail
  // (instead of falling back to no thumbnail). For other media kinds the
  // proxy returns video/audio bytes, which an <img> can't render — leave
  // image empty so the SaveHubApp guard skips the <img> tag.
  const proxyUrl = `/api/telegram/file/${created.id}`;
  const item = await prisma.savedItem.update({
    where: { id: created.id },
    data: {
      url: proxyUrl,
      ...(input.mediaType === "Foto" ? { image: proxyUrl } : {}),
    },
  });

  const hashtagMatched =
    (input.hashtags?.length ?? 0) > 0 ? requested !== null : null;
  return { item, collection, hashtagMatched };
}

// Pulls the file_id (and optional caption) out of whichever media kind the
// message carries. Returns null if the message has no media we know how to
// handle. For photos, picks the largest variant.
function readMedia(
  message: Message,
): { fileId: string; mediaType: string; caption: string } | null {
  const caption = message.caption ?? "";

  if (message.photo && message.photo.length > 0) {
    // photo array goes thumbnail -> largest. Take the last (largest).
    const largest = message.photo[message.photo.length - 1];
    return { fileId: largest.file_id, mediaType: "Foto", caption };
  }
  if (message.video) {
    return { fileId: message.video.file_id, mediaType: "Vídeo", caption };
  }
  if (message.audio) {
    return { fileId: message.audio.file_id, mediaType: "Áudio", caption };
  }
  if (message.document) {
    return { fileId: message.document.file_id, mediaType: "Documento", caption };
  }
  if (message.video_note) {
    return {
      fileId: message.video_note.file_id,
      mediaType: "Vídeo redondo",
      caption,
    };
  }
  return null;
}

async function handleMedia(ctx: Context) {
  const chat = ctx.chat;
  const message = ctx.message;
  if (!chat || !message) return;

  const user = await findUserByChat(chat.id);
  if (!user) {
    await ctx.reply(
      "Este chat ainda não está vinculado. Use /start <código> com o código do app SaveHub.",
    );
    return;
  }

  const media = readMedia(message);
  if (!media) {
    // Something odd — handler matched but no recognized media kind. Bail
    // silently; the text/caption handler can still try to extract a URL.
    return;
  }

  // If the caption carries a URL, the user's intent is to save the link —
  // the attached photo/video is usually an incidental preview. Delegate to
  // the URL handler, which reads message.caption when text is absent.
  if (extractUrl(media.caption)) {
    await handleMessage(ctx);
    return;
  }

  const forward = readForwardInfo(message);
  const hashtags = extractHashtags(media.caption);

  try {
    const { item, collection, hashtagMatched } = await saveMediaForUser(user.id, {
      fileId: media.fileId,
      mediaType: media.mediaType,
      caption: media.caption,
      forwardLabel: forward?.label,
      hashtags,
    });
    let extra = "";
    if (hashtagMatched === false) {
      const all = await prisma.collection.findMany({
        where: { userId: user.id },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      extra =
        `\nHashtag não bateu com coleção. Salvei em *${collection.name}*. ` +
        `Disponíveis: ${all.map((c) => `#${c.name}`).join(", ")}`;
    }
    await ctx.reply(
      `Salvo: ${media.mediaType} → *${collection.name}*${extra}\n_id: \`${item.id.slice(-6)}\`_`,
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    console.error("Telegram media save failed:", err);
    await ctx.reply(
      "Não consegui salvar essa mídia. Tenta de novo em alguns segundos.",
    );
  }
}

// Voice notes get the same media-save shape as photo/video, but with one
// extra step: kick off Whisper transcription in the background, which then
// updates the item's title/description with the transcript and chains into
// AI summarization.
async function handleVoice(ctx: Context) {
  const chat = ctx.chat;
  const message = ctx.message;
  if (!chat || !message?.voice) return;

  const user = await findUserByChat(chat.id);
  if (!user) {
    await ctx.reply(
      "Este chat ainda não está vinculado. Use /start <código> com o código do app SaveHub.",
    );
    return;
  }

  const forward = readForwardInfo(message);
  const caption = message.caption ?? "";
  const hashtags = extractHashtags(caption);

  try {
    const { item, collection } = await saveMediaForUser(user.id, {
      fileId: message.voice.file_id,
      mediaType: "Voice",
      caption,
      forwardLabel: forward?.label,
      hashtags,
    });

    void transcribeAndSave(item.id, message.voice.file_id);

    await ctx.reply(
      `Salvo: voice → *${collection.name}*\nTranscrevendo... vai aparecer no app em alguns segundos.\n_id: \`${item.id.slice(-6)}\`_`,
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    console.error("Telegram voice save failed:", err);
    await ctx.reply("Não consegui salvar esse voice. Tenta de novo.");
  }
}

async function handleInlineQuery(ctx: Context) {
  const iq = ctx.inlineQuery;
  if (!iq) return;

  pruneInlineCache();
  const tgUserId = String(iq.from.id);
  const query = iq.query.trim();

  // Empty query — nudge the user with a switch_pm button (deep-links them
  // back into the bot DM if they need help).
  if (!query) {
    await ctx.answerInlineQuery([], {
      cache_time: 0,
      button: {
        text: "Digite uma URL pra salvar no SaveHub",
        start_parameter: "from_inline",
      },
    });
    return;
  }

  // Account linkage uses telegramChatId, which equals from.id for private
  // 1:1 chats with the bot — same value we stored at /start time.
  const user = await prisma.user.findUnique({
    where: { telegramChatId: tgUserId },
    select: { id: true, email: true },
  });
  if (!user) {
    await ctx.answerInlineQuery(
      [
        {
          type: "article",
          id: "not-linked",
          title: "Conta não vinculada",
          description: "Conecte o Telegram primeiro: abra o bot e use /start.",
          input_message_content: {
            message_text:
              "Pra usar o SaveHub inline, abre o bot @savehub_bot e roda /start primeiro.",
          },
        },
      ],
      { cache_time: 0, button: { text: "Vincular agora", start_parameter: "from_inline" } },
    );
    return;
  }

  const url = extractUrl(query);
  if (!url) {
    await ctx.answerInlineQuery(
      [
        {
          type: "article",
          id: "no-url",
          title: "Não é uma URL válida",
          description: "Cola um link http:// ou https:// completo.",
          input_message_content: {
            message_text: "Não consegui ler URL no que você digitou.",
          },
        },
      ],
      { cache_time: 0 },
    );
    return;
  }

  // Fast metadata fetch (5s timeout in fetchUrlMetadata) for the preview card.
  const meta = await fetchUrlMetadata(url);
  const source = detectSource(url);
  const previewTitle = meta.title || `${sourceNames[source]}: ${url.slice(0, 60)}`;
  const previewDescription = meta.description || "Toca pra salvar no SaveHub";

  const resultId = generateLinkCode(12) + Date.now().toString(36).slice(-4);
  inlineSelectionCache.set(resultId, { url, tgUserId, createdAt: Date.now() });

  await ctx.answerInlineQuery(
    [
      {
        type: "article",
        id: resultId,
        title: `Salvar: ${previewTitle.slice(0, 80)}`,
        description: previewDescription.slice(0, 120),
        thumbnail_url: meta.image ?? undefined,
        input_message_content: {
          message_text: `📚 Salvo no SaveHub\n${previewTitle.slice(0, 100)}\n${url}`,
        },
      },
    ],
    { cache_time: 60, is_personal: true },
  );
}

async function handleChosenInlineResult(ctx: Context) {
  const cir = ctx.chosenInlineResult;
  if (!cir) return;

  const cached = inlineSelectionCache.get(cir.result_id);
  inlineSelectionCache.delete(cir.result_id);
  if (!cached) {
    console.warn(
      `[inline] result_id ${cir.result_id} not in cache — server restart or expired`,
    );
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramChatId: cached.tgUserId },
    select: { id: true },
  });
  if (!user) return; // user unlinked between query and selection

  try {
    await saveLinkForUser(user.id, cached.url, {
      sourceTag: "telegram-inline",
    });
  } catch (err) {
    console.error("[inline] save failed:", err);
  }
}

/**
 * Build a configured Bot instance. Same wiring is used by the dev
 * long-polling runner and (eventually) the webhook handler.
 */
export function createBot(token: string) {
  const bot = new Bot(token);

  // Match `/start CODE` or `/start` alone.
  bot.command("start", async (ctx) => {
    const arg = ctx.match?.toString().trim();
    await handleStart(ctx, arg || undefined);
  });

  bot.command("unlink", handleUnlink);

  bot.command("list", handleList);
  bot.command("delete", async (ctx) => {
    const arg = ctx.match?.toString().trim();
    await handleDelete(ctx, arg || undefined);
  });
  // English + Portuguese alias for the collections command — Telegram command
  // names can't carry accents.
  bot.command("collections", handleCollections);
  bot.command("colecoes", handleCollections);

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "*SaveHub Bot*\n\n" +
        "• Mande ou encaminhe um link, eu salvo no seu SaveHub.\n" +
        "• Adicione `#NomeDaColeção` na mesma mensagem pra escolher onde cai (ex: `link #Estudo`). Sem hashtag, vai pra *Roteiros*.\n\n" +
        "*Comandos:*\n" +
        "• /start <código> — conecta este chat ao seu app.\n" +
        "• /list — últimos 10 itens salvos.\n" +
        "• /delete <id> — apaga um item (id é os últimos 6 chars do /list).\n" +
        "• /collections — lista suas coleções.\n" +
        "• /unlink — desvincula este chat.\n" +
        "• /help — esta ajuda.",
      { parse_mode: "Markdown" },
    );
  });

  // Any other text message (including forwarded ones) -> try to save it.
  bot.on("message:text", handleMessageSafe);
  // `message:caption` ALSO fires on photo/video/document with caption — we
  // route those to the media handler below instead so we don't double-save.
  // Only let caption-only messages without media reach the URL handler.
  bot.on("message:caption", async (ctx) => {
    const m = ctx.message;
    if (m && (m.photo || m.video || m.audio || m.document || m.video_note)) {
      await handleMedia(ctx);
      return;
    }
    await handleMessageSafe(ctx);
  });

  // Pure media messages (no text/caption)
  bot.on("message:photo", handleMedia);
  bot.on("message:video", handleMedia);
  bot.on("message:audio", handleMedia);
  bot.on("message:document", handleMedia);
  bot.on("message:video_note", handleMedia);

  // Voice notes are a separate kind from `audio` and trigger Whisper
  // transcription on top of the regular media save.
  bot.on("message:voice", handleVoice);

  // Inline mode: requires `/setinline` and `/setinlinefeedback` enabled in
  // @BotFather. Without those, these handlers never fire and the bot still
  // works as before — strictly additive.
  bot.on("inline_query", handleInlineQuery);
  bot.on("chosen_inline_result", handleChosenInlineResult);

  bot.catch((err) => {
    console.error("Telegram bot error:", err);
  });

  return bot;
}

// 6-character alphanumeric code, ambiguous chars (0/O, 1/I) excluded.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateLinkCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return out;
}
