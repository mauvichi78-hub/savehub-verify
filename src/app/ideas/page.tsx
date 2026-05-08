import Link from "next/link";
import { Icon } from "@/components/Icon";
import IdeasView from "@/components/IdeasView";
import {
  listCollectionsWithCounts,
  listIdeas,
} from "@/lib/queries";
import { PLATFORM_LABELS } from "@/lib/idea-display";
import type { IdeaPlatform, IdeaStatus } from "@/lib/types";

type SearchParams = Promise<{
  collection?: string;
  platform?: string;
  status?: string;
}>;

const VALID_STATUSES: IdeaStatus[] = ["draft", "used", "discarded"];

function coercePlatform(value: string | undefined): IdeaPlatform | undefined {
  if (!value) return undefined;
  return value in PLATFORM_LABELS ? (value as IdeaPlatform) : undefined;
}

function coerceStatus(value: string | undefined): IdeaStatus | undefined {
  if (!value) return undefined;
  return VALID_STATUSES.includes(value as IdeaStatus)
    ? (value as IdeaStatus)
    : undefined;
}

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const filters = {
    collectionId: raw.collection || undefined,
    platform: coercePlatform(raw.platform),
    status: coerceStatus(raw.status),
  };

  const [ideas, collections] = await Promise.all([
    listIdeas(filters),
    listCollectionsWithCounts(),
  ]);

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <Link
          href="/"
          className="icon-button"
          aria-label="Voltar"
          prefetch={false}
        >
          <Icon name="arrow-left" />
        </Link>
        <div>
          <p className="eyebrow">Conteúdo gerado por IA</p>
          <h1>Ideias</h1>
        </div>
      </header>

      <IdeasView
        ideas={ideas}
        collections={collections}
        active={{
          collection: filters.collectionId,
          platform: filters.platform,
          status: filters.status,
        }}
      />
    </main>
  );
}
