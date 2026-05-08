// UI-side labels for IdeaPlatform. Kept separate from lib/ideas.ts so
// client components can import these without dragging Anthropic / Prisma
// into the client bundle (lib/ideas.ts is server-only by virtue of its
// imports, even though it doesn't declare "server-only").

import type { IdeaPlatform } from "./types";

export const PLATFORM_LABELS: Record<IdeaPlatform, string> = {
  "instagram-reels": "Instagram Reels",
  "instagram-carousel": "Instagram Carrossel",
  "instagram-post": "Instagram Post",
  "youtube-short": "YouTube Short",
  "youtube-long": "YouTube Vídeo",
};

export const PLATFORM_ORDER: IdeaPlatform[] = [
  "instagram-reels",
  "instagram-carousel",
  "instagram-post",
  "youtube-short",
  "youtube-long",
];
