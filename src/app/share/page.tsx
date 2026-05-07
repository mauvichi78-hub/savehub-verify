import { redirect } from "next/navigation";
import ShareSaver from "@/components/ShareSaver";
import { listCollectionNames } from "@/lib/queries";

// Endpoint registered as share_target in the Web App Manifest. When the user
// shares from TikTok/Insta/YouTube etc on Android, the OS opens the PWA at
// `/share?url=…&text=…&title=…`. We extract a real URL, pick a destination
// collection (hashtag-aware), and hand off to a client component that runs
// the save with a visible loading state — saves can take a few seconds while
// metadata is fetched, and an empty white page during that gap looks broken.
//
// On iOS this route is also reachable directly (no Web Share Target API) via
// the documented Shortcut workaround that hits this URL.

const URL_REGEX = /https?:\/\/[^\s]+/i;
const HASHTAG_REGEX = /#([\p{L}\p{N}_-]+)/gu;

function extractAndValidateUrl(input: string): string | null {
  const match = input.match(URL_REGEX);
  if (!match) return null;
  const stripped = match[0].replace(/[.,;:!?)\]]+$/, "");
  try {
    const u = new URL(stripped);
    if (!u.hostname.includes(".")) return null;
    return stripped;
  } catch {
    return null;
  }
}

function extractHashtags(input: string): string[] {
  const out: string[] = [];
  for (const m of input.matchAll(HASHTAG_REGEX)) out.push(m[1]);
  return out;
}

// Match a hashtag to one of the user's existing collections, case- and
// accent-insensitive. Falls back to the default landing collection if no
// hashtag matches anything they already have.
function pickCollection(
  hashtags: string[],
  available: string[],
): string {
  if (hashtags.length === 0) return "Roteiros";
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  for (const tag of hashtags) {
    const match = available.find((c) => norm(c) === norm(tag));
    if (match) return match;
  }
  return "Roteiros";
}

type SearchParams = Promise<{
  url?: string;
  text?: string;
  title?: string;
}>;

export default async function SharePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { url, text, title } = await searchParams;

  // Some sender apps put the URL in `url`, others put it in `text` (the share
  // body). Try `url` first — if it's a valid URL, use it; otherwise fall back
  // to scanning `text` for one.
  const fromUrlField = url ? extractAndValidateUrl(url) : null;
  const candidate = fromUrlField ?? extractAndValidateUrl(text ?? "");

  if (!candidate) {
    // Distinguish "user shared something but it had no URL" from "user shared
    // a URL-shaped thing that didn't validate". Helps the homepage flash
    // message be specific.
    const hadAnyContent = (url ?? text ?? "").trim().length > 0;
    redirect(`/?shareError=${hadAnyContent ? "invalid-url" : "missing-url"}`);
  }

  const hashtags = extractHashtags(text ?? "");
  const userCollections = await listCollectionNames();
  const collection = pickCollection(hashtags, userCollections);

  return (
    <ShareSaver
      url={candidate}
      title={title?.trim() || undefined}
      collection={collection}
    />
  );
}
