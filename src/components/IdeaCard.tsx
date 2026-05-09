import Link from "next/link";
import IdeaActions from "./IdeaActions";
import type { UIIdea } from "@/lib/types";
import { PLATFORM_LABELS } from "@/lib/idea-display";

const STATUS_LABEL: Record<UIIdea["status"], string> = {
  draft: "Rascunho",
  used: "Usada",
  discarded: "Descartada",
};

type Props = {
  idea: UIIdea;
};

export default function IdeaCard({ idea }: Props) {
  const platformLabel = PLATFORM_LABELS[idea.platform];
  const refCount = idea.sourceItemIds.length;

  return (
    <article className={`idea-card idea-card--${idea.status}`}>
      <header className="idea-card-head">
        <span className="idea-badge idea-badge--platform">{platformLabel}</span>
        <span className={`idea-badge idea-badge--status idea-badge--${idea.status}`}>
          {STATUS_LABEL[idea.status]}
        </span>
      </header>

      <h3 className="idea-card-title">{idea.title}</h3>

      {idea.hook && (
        <p className="idea-card-hook">{idea.hook}</p>
      )}

      {idea.angle && (
        <p className="idea-card-angle">
          <span className="eyebrow">Ângulo</span>
          {idea.angle}
        </p>
      )}

      {idea.structure.length > 0 && (
        <div className="idea-card-section">
          <span className="eyebrow">Estrutura</span>
          <ul className="idea-card-structure">
            {idea.structure.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {idea.cta && (
        <p className="idea-card-cta">
          <span className="eyebrow">CTA</span>
          {idea.cta}
        </p>
      )}

      {idea.hashtags.length > 0 && (
        <p className="idea-card-hashtags">
          {idea.hashtags.map((tag) => `#${tag}`).join("  ")}
        </p>
      )}

      <footer className="idea-card-foot">
        {idea.sourceCollection ? (
          <Link
            href={`/collections/${idea.sourceCollection.id}`}
            prefetch={false}
            className="idea-card-source-link"
          >
            <span className="eyebrow">Coleção</span>
            {idea.sourceCollection.name}
          </Link>
        ) : (
          <span className="idea-card-source-link idea-card-source-link--orphan">
            <span className="eyebrow">Coleção</span>
            (apagada)
          </span>
        )}
        <span className="idea-card-refs">
          {refCount} {refCount === 1 ? "referência" : "referências"}
        </span>
      </footer>

      <IdeaActions
        ideaId={idea.id}
        status={idea.status}
        notes={idea.notes}
      />
    </article>
  );
}
