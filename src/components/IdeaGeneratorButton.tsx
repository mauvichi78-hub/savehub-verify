"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateIdeasFromCollectionAction } from "@/app/ideas/actions";
import { PLATFORM_LABELS, PLATFORM_ORDER } from "@/lib/idea-display";
import type { IdeaPlatform } from "@/lib/types";

type Props = {
  collectionId: string;
  // Disable when the collection has no items — Claude has nothing to riff on,
  // and the action throws on empty collections anyway.
  hasItems: boolean;
};

const COUNT_OPTIONS = [2, 3, 5, 8] as const;

export default function IdeaGeneratorButton({ collectionId, hasItems }: Props) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<IdeaPlatform>("instagram-reels");
  const [count, setCount] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // ESC closes the modal — basic dialog ergonomics.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await generateIdeasFromCollectionAction({
          collectionId,
          platform,
          count,
        });
        // Land on the gallery filtered by this collection so the new ideas
        // are immediately visible. revalidatePath in the action already
        // refreshed the cache.
        router.push(`/ideas?collection=${collectionId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro inesperado";
        setError(msg);
      }
    });
  }

  if (!hasItems) {
    // Same visual weight as the active button so the section doesn't shift,
    // but disabled with a hint about why.
    return (
      <button
        type="button"
        className="primary-button"
        disabled
        title="Adicione pelo menos um item à coleção pra gerar ideias"
        style={{ marginTop: 16 }}
      >
        Gerar ideias com IA
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="primary-button"
        onClick={() => setOpen(true)}
        style={{ marginTop: 16 }}
      >
        Gerar ideias com IA
      </button>

      {open && (
        <div
          className="idea-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="idea-modal-title"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="idea-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="idea-modal-title" className="idea-modal-title">
              Gerar ideias
            </h2>
            <p className="idea-modal-help">
              A IA vai analisar os itens dessa coleção e criar briefs prontos
              pra postar (hook, ângulo, estrutura, CTA, hashtags).
            </p>

            <div className="idea-modal-field">
              <label className="eyebrow" htmlFor="platform-select">
                Plataforma
              </label>
              <select
                id="platform-select"
                className="idea-modal-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as IdeaPlatform)}
                disabled={pending}
              >
                {PLATFORM_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="idea-modal-field">
              <span className="eyebrow">Quantas ideias</span>
              <div className="idea-modal-count-row">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`filter-chip${count === n ? " is-active" : ""}`}
                    onClick={() => setCount(n)}
                    disabled={pending}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="login-error">{error}</p>}

            <div className="idea-modal-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={submit}
                disabled={pending}
              >
                {pending ? "Gerando…" : "Gerar"}
              </button>
            </div>

            {pending && (
              <p className="idea-modal-progress">
                Conversando com a IA — costuma levar 5–15 segundos.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
