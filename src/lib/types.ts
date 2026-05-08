export type Source =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "twitter"
  | "whatsapp"
  | "telegram"
  | "web";

export type SavedItem = {
  id: string;
  title: string;
  source: Source;
  sourceLabel: string;
  collection: string;
  type: string;
  // Pre-formatted relative day ("Hoje", "Ontem", "Seg", "12 mai") for the
  // primary timestamp display.
  date: string;
  // Pre-formatted clock time as "HH:MM" — paired with `date` so same-day
  // items can be distinguished by save time.
  time: string;
  url: string;
  description: string;
  summary: string;
  tags: string[];
  status: string;
  summarized: boolean;
  image: string;
};

export type SortOption = "recent" | "source" | "collection";
export type FilterOption = Source | "all";

export type IdeaPlatform =
  | "instagram-reels"
  | "instagram-carousel"
  | "instagram-post"
  | "youtube-short"
  | "youtube-long";

export type IdeaStatus = "draft" | "used" | "discarded";

// UI-shaped Idea: arrays parsed out of the JSON-encoded SQLite columns.
export type UIIdea = {
  id: string;
  title: string;
  hook: string;
  angle: string;
  structure: string[];
  cta: string;
  hashtags: string[];
  platform: IdeaPlatform;
  status: IdeaStatus;
  notes: string;
  sourceCollection: { id: string; name: string } | null;
  sourceItemIds: string[];
  // Pre-formatted relative day, paired with createdAt for stable sort.
  date: string;
  createdAt: Date;
};
