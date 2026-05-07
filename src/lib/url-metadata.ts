// Fetches og:/twitter: metadata from a URL so saved items get a real title,
// thumbnail, and description instead of "{Source} salvo" + a generic icon.
//
// Defensive on purpose: external sites can be slow, return non-HTML, redirect
// forever, or block bots. Anything that goes wrong returns nulls — the caller
// falls back to the previous "${source} salvo" + thumbnails[source] behavior.

export type UrlMetadata = {
  title: string | null;
  image: string | null;
  description: string | null;
};

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024; // 512 KB of HTML is plenty to find <head> tags.

// Most sites either serve the same OG tags to bots and humans, or block
// obvious bot UAs. A real-browser UA gets us through the most common gates.
const USER_AGENT =
  "Mozilla/5.0 (compatible; SaveHubBot/1.0; +https://savehub.local) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const empty: UrlMetadata = { title: null, image: null, description: null };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return empty;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return empty;

  // YouTube serves a consent gate to non-cookied scrapers — its og: tags
  // come back empty. Use the public oEmbed endpoint instead.
  if (isYouTubeHost(parsed.hostname)) {
    const yt = await fetchYouTubeOEmbed(url);
    if (yt.title || yt.image) return yt;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
      },
    });

    if (!res.ok) return empty;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return empty;

    const html = await readCapped(res, MAX_BYTES);
    const head = sliceHead(html);

    return {
      title:
        firstMeta(head, ["og:title", "twitter:title"]) ??
        firstTitleTag(head) ??
        null,
      image: resolveUrl(
        firstMeta(head, ["og:image", "og:image:url", "twitter:image"]),
        parsed,
      ),
      description:
        firstMeta(head, ["og:description", "twitter:description", "description"]) ??
        null,
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(timeout);
  }
}

// Read at most `max` bytes of the response body and decode as text.
// Most sites put og: tags in <head> well within the first ~50 KB, so we don't
// need to download multi-MB pages.
async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  reader.cancel().catch(() => {});
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

function sliceHead(html: string): string {
  const end = html.search(/<\/head\s*>/i);
  return end > 0 ? html.slice(0, end) : html.slice(0, 64 * 1024);
}

function firstMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<meta\\s+[^>]*(?:property|name)\\s*=\\s*["']${escapeRe(name)}["'][^>]*>`,
      "i",
    );
    const tag = html.match(re)?.[0];
    if (!tag) continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    if (content) return decodeEntities(content.trim());
  }
  return null;
}

function firstTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].trim()).slice(0, 200) : null;
}

function resolveUrl(value: string | null, base: URL): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isYouTubeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "youtube.com" ||
    h.endsWith(".youtube.com") ||
    h === "youtu.be" ||
    h.endsWith(".youtu.be")
  );
}

async function fetchYouTubeOEmbed(url: string): Promise<UrlMetadata> {
  const empty: UrlMetadata = { title: null, image: null, description: null };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const endpoint =
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };
    return {
      title: data.title ?? null,
      image: data.thumbnail_url ?? null,
      // oEmbed has no description; author goes a long way for context.
      description: data.author_name ? `Por ${data.author_name}` : null,
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
