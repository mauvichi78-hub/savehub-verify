import { prisma } from "./db";
import { detectSource, sourceNames, sourceType, thumbnails } from "./data";
import { fetchUrlMetadata } from "./url-metadata";
import { summarizeAndSave } from "./summarize";

// ---------------------------------------------------------------------------
// SaveHub WhatsApp bot — Meta Cloud API (graph.facebook.com).
//
// Two flows, mirroring the Telegram implementation:
//   /start <code>            -> link this WhatsApp number to a SaveHub user
//   <message with a URL>     -> save the URL into the user's library
//
// Transport: webhook only (Meta does not support long-polling). The dev
// loop needs a public URL — use ngrok / Cloudflare Tunnel against
// /api/whatsapp/webhook.
// ---------------------------------------------------------------------------

const URL_REGEX = /https?:\/\/[^\s]+/i;
const HASHTAG_REGEX = /#([\p{L}\p{N}_-]+)/gu;
const GRAPH_API_VERSION = "v21.0";

function extractUrl(text: string): string | null {
  const m = text.match(URL_REGEX);
  return m ? m[0] : null;
}

function extractHashtags(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(HASHTAG_REGEX)) out.push(m[1]);
  return out;
}

async function findUserByWa(waId: string) {
  return prisma.user.findUnique({ where: { whatsappWaId: waId } });
}

// Reply to the user. WhatsApp's 24h "customer service" window means free-form
// replies are only allowed when responding to a recent user message — which
// is exactly our case (we're answering an incoming message right now).
export async function sendWhatsappReply(
  waId: string,
  body: string,
): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    console.error("WhatsApp send aborted: missing PHONE_ID or ACCESS_TOKEN");
    return;
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: waId,
          type: "text",
          text: { body, preview_url: false },
        }),
      },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "(no body)");
      console.error("WhatsApp send failed:", res.status, errText);
    }
  } catch (e) {
    console.error("WhatsApp send error:", e);
  }
}

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

async function handleStart(waId: string, code: string | undefined) {
  const existing = await prisma.user.findUnique({
    where: { whatsappWaId: waId },
    select: { email: true },
  });
  if (existing) {
    await sendWhatsappReply(
      waId,
      `Você já está conectado ao SaveHub como ${existing.email}. Manda links pra eu salvar.`,
    );
    return;
  }
  if (!code) {
    await sendWhatsappReply(
      waId,
      "Olá! Pra conectar este número ao seu SaveHub:\n\n1) Abra o app SaveHub no navegador\n2) Vá em Configurações → Conectar WhatsApp\n3) Reenvie aqui o comando exibido (com o código de 6 caracteres)",
    );
    return;
  }
  const token = await prisma.whatsappLinkToken.findUnique({
    where: { token: code.trim().toUpperCase() },
    include: { user: true },
  });
  if (!token || token.expiresAt < new Date()) {
    await sendWhatsappReply(
      waId,
      "Código inválido ou expirado. Gere um novo no app e tente de novo.",
    );
    return;
  }
  const occupied = await prisma.user.findUnique({
    where: { whatsappWaId: waId },
  });
  if (occupied && occupied.id !== token.userId) {
    await sendWhatsappReply(
      waId,
      "Este número já está vinculado a outra conta SaveHub. Faça /unlink na outra conta antes.",
    );
    return;
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { whatsappWaId: waId },
    }),
    prisma.whatsappLinkToken.delete({ where: { token: token.token } }),
    prisma.whatsappLinkToken.deleteMany({
      where: { userId: token.userId, expiresAt: { lt: new Date() } },
    }),
  ]);
  await sendWhatsappReply(
    waId,
    `Conectado! 🎉\n\nA partir de agora, qualquer link que você mandar ou encaminhar pra mim eu salvo no SaveHub de ${token.user.email}.`,
  );
}

async function handleUnlink(waId: string) {
  const user = await findUserByWa(waId);
  if (!user) {
    await sendWhatsappReply(
      waId,
      "Este número não está vinculado a nenhuma conta SaveHub.",
    );
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { whatsappWaId: null },
  });
  await sendWhatsappReply(
    waId,
    "Desvinculado. Pra reconectar, gere um novo código no app.",
  );
}

async function handleHelp(waId: string) {
  await sendWhatsappReply(
    waId,
    "SaveHub Bot\n\n" +
      "• Mande ou encaminhe um link, eu salvo no seu SaveHub.\n" +
      "• Adicione #NomeDaColeção na mesma mensagem pra escolher onde cai (ex: link #Estudo). Sem hashtag, vai pra Roteiros.\n" +
      "• /start <código> — conecta este número ao seu app.\n" +
      "• /unlink — desvincula este número.\n" +
      "• /help — esta ajuda.",
  );
}

async function handleSaveMessage(waId: string, text: string) {
  const user = await findUserByWa(waId);
  if (!user) {
    await sendWhatsappReply(
      waId,
      "Este número ainda não está vinculado. Use /start <código> com o código gerado no app SaveHub (Configurações → Conectar WhatsApp).",
    );
    return;
  }
  const url = extractUrl(text);
  if (!url) {
    await sendWhatsappReply(
      waId,
      "Não achei nenhum link nessa mensagem. Manda só o link, ou encaminha um post.",
    );
    return;
  }

  const source = detectSource(url);
  const hashtags = extractHashtags(text);
  const requested = await resolveCollectionFromHashtags(user.id, hashtags);

  const fallbackName = "Roteiros";
  const collection =
    requested ??
    (await prisma.collection.upsert({
      where: { userId_name: { userId: user.id, name: fallbackName } },
      update: {},
      create: { userId: user.id, name: fallbackName },
    }));

  const meta = await fetchUrlMetadata(url);
  const title =
    meta.title ||
    text.split("\n")[0]?.slice(0, 120) ||
    `${sourceNames[source]} salvo`;
  const description =
    meta.description || `Salvo via WhatsApp em ${collection.name}.`;
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
        "whatsapp",
      ]),
      status: "Para usar",
      summarized: false,
      image,
      userId: user.id,
      collectionId: collection.id,
    },
  });

  void summarizeAndSave(item.id, { title, description, url, source });

  let extra = "";
  if (hashtags.length > 0 && !requested) {
    const all = await prisma.collection.findMany({
      where: { userId: user.id },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    extra =
      `\n\nHashtag não bateu com coleção. Salvei em "${collection.name}". ` +
      `Disponíveis: ${all.map((c) => `#${c.name}`).join(", ")}`;
  }

  await sendWhatsappReply(
    waId,
    `Salvo: ${sourceNames[source]} → ${collection.name}${extra}`,
  );
}

// Dispatcher used by the webhook for each incoming text message.
export async function handleIncomingWhatsappMessage(
  waId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (/^\/start\b/i.test(trimmed)) {
    const code = trimmed.replace(/^\/start\s*/i, "").trim() || undefined;
    await handleStart(waId, code);
    return;
  }
  if (/^\/unlink\b/i.test(trimmed)) {
    await handleUnlink(waId);
    return;
  }
  if (/^\/help\b/i.test(trimmed)) {
    await handleHelp(waId);
    return;
  }
  await handleSaveMessage(waId, trimmed);
}

// 6-character alphanumeric code, ambiguous chars (0/O, 1/I) excluded.
// Same alphabet as Telegram's, so users see a consistent code shape.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateWhatsappLinkCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return out;
}
