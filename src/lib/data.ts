import type { SavedItem, Source } from "./types";

// Local brand-colored placeholders served from /public/thumb/{source}.png.
// Stable, reliable and unmistakable per source. We'll swap to real og:image /
// oEmbed-fetched thumbnails once we add background enrichment of saved items.
export const thumbnails: Record<Source, string> = {
  youtube: "/thumb/youtube.png",
  instagram: "/thumb/instagram.png",
  tiktok: "/thumb/tiktok.png",
  twitter: "/thumb/twitter.png",
  whatsapp: "/thumb/whatsapp.png",
  telegram: "/thumb/telegram.png",
  web: "/thumb/web.png",
};

export const sourceNames: Record<Source, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X/Twitter",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  web: "Web",
};

export const sourceShort: Record<Source, string> = {
  youtube: "YT",
  instagram: "IG",
  tiktok: "TT",
  twitter: "X",
  whatsapp: "WA",
  telegram: "TG",
  web: "WEB",
};

export const sourceType: Record<Source, string> = {
  youtube: "Vídeo",
  instagram: "Post",
  tiktok: "Vídeo curto",
  twitter: "Post",
  whatsapp: "Mensagem",
  telegram: "Mensagem",
  web: "Link",
};

export const collections = ["Roteiros", "Referências", "Estudo", "Produtos"] as const;

export const seedItems: SavedItem[] = [
  {
    id: "yt-hooks",
    title: "Como transformar referências em roteiros curtos",
    source: "youtube",
    sourceLabel: "YouTube",
    collection: "Roteiros",
    type: "Vídeo",
    date: "Hoje",
    time: "",
    url: "https://youtube.com/watch?v=savehub",
    description: "Estrutura rápida para mapear gancho, promessa, prova e chamada a partir de vídeos salvos.",
    summary: "Bom material para criar um template de roteiro curto. A parte mais útil é separar a referência em intenção, mecanismo e formato final.",
    tags: ["roteiro", "shorts", "criador"],
    status: "Para usar",
    summarized: true,
    image: thumbnails.youtube,
  },
  {
    id: "ig-carousel",
    title: "Carrossel com layout editorial para lançamento",
    source: "instagram",
    sourceLabel: "Instagram",
    collection: "Referências",
    type: "Post",
    date: "Ontem",
    time: "",
    url: "https://instagram.com/p/savehub",
    description: "Referência visual com capa forte, ritmo de slides e CTA discreto no fechamento.",
    summary: "Salvar como exemplo de hierarquia: primeira tela com promessa direta, slides intermediários com contraste alto e última tela para ação.",
    tags: ["design", "carrossel", "lançamento"],
    status: "Revisar",
    summarized: true,
    image: thumbnails.instagram,
  },
  {
    id: "tt-hook",
    title: "TikTok com gancho forte para abertura de vídeo",
    source: "tiktok",
    sourceLabel: "TikTok",
    collection: "Roteiros",
    type: "Vídeo curto",
    date: "Hoje",
    time: "",
    url: "https://www.tiktok.com/@savehub/video/1234567890",
    description: "Referência de ritmo, legenda na tela e repetição de promessa nos primeiros segundos.",
    summary: "Boa referência para extrair estrutura de abertura: conflito imediato, promessa visual e CTA leve. No MVP, salvamos URL, thumbnail e notas; embed vem depois.",
    tags: ["tiktok", "gancho", "short-form"],
    status: "Para usar",
    summarized: true,
    image: thumbnails.tiktok,
  },
  {
    id: "tw-thread",
    title: "Thread sobre distribuição de conteúdo em múltiplas redes",
    source: "twitter",
    sourceLabel: "X/Twitter",
    collection: "Estudo",
    type: "Thread",
    date: "Hoje",
    time: "",
    url: "https://x.com/savehub/status/1234567890",
    description: "Sequência salva para virar checklist de distribuição e reaproveitamento de posts.",
    summary: "Útil para transformar uma thread em plano de ação. Começar com captura por link e, futuramente, enriquecer via X API se o custo fizer sentido.",
    tags: ["twitter", "thread", "distribuição"],
    status: "Revisar",
    summarized: true,
    image: thumbnails.twitter,
  },
  {
    id: "wa-audio",
    title: "Briefing de áudio recebido no grupo de clientes",
    source: "whatsapp",
    sourceLabel: "WhatsApp",
    collection: "Produtos",
    type: "Áudio",
    date: "Seg",
    time: "",
    url: "https://wa.me/savehub",
    description: "Mensagem encaminhada para o bot com pontos de dor, concorrentes e próximos passos.",
    summary: "Cliente quer reduzir dispersão de links e transformar pesquisas salvas em pauta semanal para social media.",
    tags: ["cliente", "briefing", "áudio"],
    status: "Para usar",
    summarized: true,
    image: thumbnails.whatsapp,
  },
  {
    id: "tg-channel",
    title: "Thread de canal com tendências para creators",
    source: "telegram",
    sourceLabel: "Telegram",
    collection: "Referências",
    type: "Canal",
    date: "Dom",
    time: "",
    url: "https://t.me/savehub_demo",
    description: "Post salvo de um canal com links, prints e observações para pauta de conteúdo.",
    summary: "Telegram deve entrar como fluxo de encaminhamento para bot: o usuário manda mensagens, links, fotos, documentos e áudios para o SaveHub organizar.",
    tags: ["telegram", "canal", "curadoria"],
    status: "Para usar",
    summarized: true,
    image: thumbnails.telegram,
  },
  {
    id: "web-report",
    title: "Relatório sobre consumo de vídeo social em 2026",
    source: "web",
    sourceLabel: "Web",
    collection: "Estudo",
    type: "Artigo",
    date: "12 abr",
    time: "",
    url: "https://example.com/video-social-2026",
    description: "Página longa com dados para embasar proposta de conteúdo always-on.",
    summary: "Usar os dados de frequência de consumo e retenção para justificar o plano Creator no pitch.",
    tags: ["pesquisa", "dados", "estratégia"],
    status: "Arquivado",
    summarized: false,
    image: thumbnails.web,
  },
];

export function detectSource(url: string): Source {
  const value = url.toLowerCase();
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
  if (value.includes("instagram.com")) return "instagram";
  if (value.includes("tiktok.com") || value.includes("vm.tiktok.com") || value.includes("vt.tiktok.com")) return "tiktok";
  if (value.includes("twitter.com") || value.includes("x.com")) return "twitter";
  if (value.includes("wa.me") || value.includes("whatsapp.com")) return "whatsapp";
  if (
    value.includes("t.me") ||
    value.includes("telegram.me") ||
    value.includes("telegram.org") ||
    value.startsWith("tg://")
  )
    return "telegram";
  return "web";
}

export function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
