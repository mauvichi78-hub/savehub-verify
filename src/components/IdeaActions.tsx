"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteIdeaAction,
  updateIdeaNotesAction,
  updateIdeaStatusAction,
} from "@/app/ideas/actions";
import type { IdeaStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: IdeaStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "used", label: "Usada" },
  { value: "discarded", label: "Descartada" },
];

type Props = {
  ideaId: string;
  status: IdeaStatus;
  notes: string;
};

// Tabs at the bottom of an IdeaCard:
//   • Status chips (instant) — single-click switch.
//   • Notes textarea (debounced auto-save) — silent save on blur or 1.5s
//     idle, no Salvar button to make the user think.
//   • Delete (confirmed) — hard delete; we don't have a soft-delete column.
export default function IdeaActions({ ideaId, status, notes }: Props) {
  const [localStatus, setLocalStatus] = useState<IdeaStatus>(status);
  const [localNotes, setLocalNotes] = useState<string>(notes);
  // The last persisted notes value — used to detect unsaved changes.
  const lastSavedNotes = useRef<string>(notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const debounceRef = useRef<number | null>(null);

  function changeStatus(next: IdeaStatus) {
    if (next === localStatus) return;
    const prev = localStatus;
    setLocalStatus(next); // optimistic
    setError(null);
    startTransition(async () => {
      try {
        await updateIdeaStatusAction({ ideaId, status: next });
        // revalidatePath in the action will refresh the server tree, but the
        // status badge in the parent IdeaCard is only re-rendered on
        // navigation. Force a refresh so the badge updates inline.
        router.refresh();
      } catch (e) {
        setLocalStatus(prev); // rollback
        setError(e instanceof Error ? e.message : "Erro ao mudar status");
      }
    });
  }

  // Persist notes if they differ from what was last saved. Used by both
  // blur and the debounce timer.
  function flushNotes(value: string) {
    if (value === lastSavedNotes.current) return;
    setSavingNotes(true);
    setError(null);
    updateIdeaNotesAction({ ideaId, notes: value })
      .then(() => {
        lastSavedNotes.current = value;
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Erro ao salvar nota");
      })
      .finally(() => setSavingNotes(false));
  }

  function onNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setLocalNotes(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => flushNotes(value), 1500);
  }

  function onNotesBlur() {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    flushNotes(localNotes);
  }

  // Flush a pending debounce on unmount so notes typed but not yet saved
  // (because the user navigated away fast) don't get lost.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        // Best-effort: fire-and-forget. We can't await on cleanup.
        if (lastSavedNotes.current !== localNotes) {
          void updateIdeaNotesAction({ ideaId, notes: localNotes }).catch(
            () => {},
          );
        }
      }
    };
    // We deliberately want the *latest* localNotes captured at unmount,
    // so the cleanup function reads from a stable closure that re-runs
    // on every change. Linter would complain about ideaId; harmless here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId, localNotes]);

  function onDelete() {
    if (!confirm("Apagar esta ideia? Esta ação não tem volta.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteIdeaAction(ideaId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao apagar");
      }
    });
  }

  const notesDirty = localNotes !== lastSavedNotes.current;

  return (
    <div className="idea-actions">
      <div className="idea-actions-status" role="group" aria-label="Status">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`filter-chip${localStatus === opt.value ? " is-active" : ""}`}
            onClick={() => changeStatus(opt.value)}
            disabled={pending}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <label className="idea-actions-notes-label">
        <span className="eyebrow">Notas</span>
        <textarea
          className="idea-actions-notes"
          value={localNotes}
          onChange={onNotesChange}
          onBlur={onNotesBlur}
          placeholder="Suas anotações sobre essa ideia (rascunho de roteiro, decisões, links extras…)"
          rows={3}
          maxLength={4000}
          disabled={pending}
        />
        <span className="idea-actions-notes-status">
          {savingNotes
            ? "Salvando…"
            : notesDirty
            ? "Alterações não salvas"
            : ""}
        </span>
      </label>

      {error && <p className="login-error">{error}</p>}

      <div className="idea-actions-foot">
        <button
          type="button"
          className="idea-delete-btn"
          onClick={onDelete}
          disabled={pending}
        >
          Apagar ideia
        </button>
      </div>
    </div>
  );
}
