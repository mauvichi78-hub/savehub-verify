import Link from "next/link";
import IdeaCard from "./IdeaCard";
import type { CollectionSummary } from "@/lib/queries";
import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
} from "@/lib/idea-display";
import type { IdeaPlatform, IdeaStatus, UIIdea } from "@/lib/types";

const STATUS_ORDER: IdeaStatus[] = ["draft", "used", "discarded"];
const STATUS_LABEL: Record<IdeaStatus, string> = {
  draft: "Rascunho",
  used: "Usadas",
  discarded: "Descartadas",
};

type ActiveFilters = {
  collection?: string;
  platform?: IdeaPlatform;
  status?: IdeaStatus;
};

type Props = {
  ideas: UIIdea[];
  collections: CollectionSummary[];
  active: ActiveFilters;
};

// Build a /ideas href that flips one filter while keeping the others. Pass
// `value` as undefined to clear that filter (the "Todas" chip).
function buildHref(active: ActiveFilters, key: keyof ActiveFilters, value?: string): string {
  const params = new URLSearchParams();
  if (key !== "collection" && active.collection) params.set("collection", active.collection);
  if (key !== "platform" && active.platform) params.set("platform", active.platform);
  if (key !== "status" && active.status) params.set("status", active.status);
  if (value) params.set(key, value);
  const q = params.toString();
  return q ? `/ideas?${q}` : "/ideas";
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="idea-filter-row">
      <span className="eyebrow idea-filter-label">{label}</span>
      <div className="idea-filter-chips">{children}</div>
    </div>
  );
}

export default function IdeasView({ ideas, collections, active }: Props) {
  const totalLabel = `${ideas.length} ${ideas.length === 1 ? "ideia" : "ideias"}`;

  return (
    <div className="idea-view">
      <div className="idea-filters">
        <FilterRow label="Coleção">
          <Link
            href={buildHref(active, "collection", undefined)}
            className={`filter-chip${!active.collection ? " is-active" : ""}`}
            prefetch={false}
          >
            Todas
          </Link>
          {collections.map((c) => (
            <Link
              key={c.id}
              href={buildHref(active, "collection", c.id)}
              className={`filter-chip${active.collection === c.id ? " is-active" : ""}`}
              prefetch={false}
            >
              {c.name}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label="Plataforma">
          <Link
            href={buildHref(active, "platform", undefined)}
            className={`filter-chip${!active.platform ? " is-active" : ""}`}
            prefetch={false}
          >
            Todas
          </Link>
          {PLATFORM_ORDER.map((p) => (
            <Link
              key={p}
              href={buildHref(active, "platform", p)}
              className={`filter-chip${active.platform === p ? " is-active" : ""}`}
              prefetch={false}
            >
              {PLATFORM_LABELS[p]}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label="Status">
          <Link
            href={buildHref(active, "status", undefined)}
            className={`filter-chip${!active.status ? " is-active" : ""}`}
            prefetch={false}
          >
            Todas
          </Link>
          {STATUS_ORDER.map((s) => (
            <Link
              key={s}
              href={buildHref(active, "status", s)}
              className={`filter-chip${active.status === s ? " is-active" : ""}`}
              prefetch={false}
            >
              {STATUS_LABEL[s]}
            </Link>
          ))}
        </FilterRow>
      </div>

      <p className="idea-count">{totalLabel}</p>

      {ideas.length === 0 ? (
        <div className="idea-empty">
          <p>
            <strong>Nenhuma ideia ainda.</strong>
          </p>
          <p>
            Abra uma coleção e clique em <em>Gerar ideias</em> pra que a IA
            transforme o que você salvou em briefs prontos pra postar.
          </p>
        </div>
      ) : (
        <div className="idea-grid">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}
