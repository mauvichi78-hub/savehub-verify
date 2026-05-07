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
