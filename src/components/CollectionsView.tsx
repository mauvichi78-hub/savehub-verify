"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import {
  createCollection,
  deleteCollection,
  renameCollection,
} from "@/app/collections/actions";
import type { CollectionSummary } from "@/lib/queries";

type Props = {
  initialCollections: CollectionSummary[];
};

// Client-side row state for inline rename. Stays local — server actions
// handle persistence and trigger revalidatePath, so we let Next refresh the
// initialCollections prop on its own after mutations.
type RowEditState = { id: string; draft: string } | null;

export default function CollectionsView({ initialCollections }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<RowEditState>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flashError(msg: string | null) {
    setError(msg);
    if (msg) {
      // Auto-clear after 4s so a stale error doesn't stick around when the
      // user starts another action.
      window.setTimeout(() => setError((cur) => (cur === msg ? null : cur)), 4000);
    }
  }

  function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createCollection(name);
      if (!result.ok) {
        flashError(result.error);
        return;
      }
      setNewName("");
      setCreating(false);
      flashError(null);
    });
  }

  function handleRenameSubmit(id: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || editing.id !== id) return;
    const name = editing.draft.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await renameCollection(id, name);
      if (!result.ok) {
        flashError(result.error);
        return;
      }
      setEditing(null);
      flashError(null);
    });
  }

  function handleDelete(c: CollectionSummary) {
    const message =
      c.itemCount === 0
        ? `Apagar a coleção "${c.name}"?`
        : `Apagar a coleção "${c.name}"?\n\nIsso também apaga ${c.itemCount} ${
            c.itemCount === 1 ? "item dentro dela" : "itens dentro dela"
          }. Não dá pra desfazer.`;
    if (!confirm(message)) return;

    startTransition(async () => {
      const result = await deleteCollection(c.id);
      if (!result.ok) {
        flashError(result.error);
        return;
      }
      flashError(null);
    });
  }

  return (
    <section aria-label="Suas coleções">
      <div className="section-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2>Suas coleções ({initialCollections.length})</h2>
        {!creating && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setCreating(true);
              flashError(null);
            }}
            disabled={pending}
          >
            <Icon name="plus" />
            <span>Nova coleção</span>
          </button>
        )}
      </div>

      <p className="settings-help">
        As coleções organizam o que você salva. Ao mandar um link pelo bot, use
        <code className="tg-code"> #NomeDaColeção</code> pra escolher onde cai.
      </p>

      {error && (
        <p className="login-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {creating && (
        <form onSubmit={handleCreateSubmit} className="tg-card" style={{ marginTop: 16 }}>
          <div className="tg-row" style={{ gap: 12 }}>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da coleção (ex: Vídeos pra Gravar)"
              maxLength={40}
              className="tg-code"
              style={{ flex: 1, padding: "10px 12px", fontSize: 15 }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
            />
            <button type="submit" className="primary-button" disabled={pending || !newName.trim()}>
              Criar
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              disabled={pending}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {initialCollections.length === 0 && !creating && (
          <p className="settings-help">
            Você não tem coleções ainda. Cria a primeira aí em cima.
          </p>
        )}

        {initialCollections.map((c) => (
          <article key={c.id} className="tg-card">
            <div className="tg-row" style={{ alignItems: "center", gap: 12 }}>
              <div
                className="tg-icon"
                aria-hidden="true"
                style={{ background: "linear-gradient(135deg, #0cf2a7, #2563eb)", color: "white" }}
              >
                <Icon name="layers" />
              </div>

              <div className="tg-text" style={{ flex: 1, minWidth: 0 }}>
                {editing?.id === c.id ? (
                  <form onSubmit={(e) => handleRenameSubmit(c.id, e)}>
                    <input
                      autoFocus
                      type="text"
                      value={editing.draft}
                      onChange={(e) => setEditing({ id: c.id, draft: e.target.value })}
                      maxLength={40}
                      className="tg-code"
                      style={{ width: "100%", padding: "8px 10px", fontSize: 16 }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button type="submit" className="primary-button" disabled={pending || !editing.draft.trim()}>
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setEditing(null)}
                        disabled={pending}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <Link
                      href={`/collections/${c.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                      prefetch={false}
                    >
                      <strong style={{ fontSize: 16 }}>{c.name}</strong>
                    </Link>
                    <p className="tg-help" style={{ marginTop: 2 }}>
                      {c.itemCount} {c.itemCount === 1 ? "item" : "itens"}
                    </p>
                  </>
                )}
              </div>

              {editing?.id !== c.id && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setEditing({ id: c.id, draft: c.name });
                      flashError(null);
                    }}
                    disabled={pending}
                    aria-label={`Renomear ${c.name}`}
                    title="Renomear"
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => handleDelete(c)}
                    disabled={pending}
                    aria-label={`Apagar ${c.name}`}
                    title="Apagar"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
