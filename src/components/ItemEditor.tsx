"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import {
  deleteItemAction,
  updateItem,
} from "@/app/items/[id]/actions";
import type { SavedItem } from "@/lib/types";

type Props = {
  item: SavedItem;
  collectionId: string;
  availableCollections: Array<{ id: string; name: string }>;
};

const STATUSES = ["Para usar", "Em uso", "Arquivado"] as const;

export default function ItemEditor({
  item,
  collectionId,
  availableCollections,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [summary, setSummary] = useState(
    item.summary === "Resumindo..." ? "" : item.summary,
  );
  // Tags are stored JSON-encoded as a string[] in the DB but exposed to the
  // form as a comma-separated string for less-friction editing.
  const [tagsRaw, setTagsRaw] = useState(item.tags.join(", "));
  const [collId, setCollId] = useState(collectionId);
  const [status, setStatus] = useState<string>(item.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateItem({
        itemId: item.id,
        title,
        description,
        summary,
        collectionId: collId,
        status,
        tagsRaw,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Stay on the page so the user can keep tweaking, but refresh data.
      router.refresh();
    });
  }

  function handleDelete() {
    const ok = confirm(
      `Apagar permanentemente "${item.title}"?\n\nNão dá pra desfazer.`,
    );
    if (!ok) return;
    startTransition(async () => {
      // Server action redirects to the parent collection on success.
      await deleteItemAction(item.id);
    });
  }

  return (
    <>
      {/* Header card with thumbnail, source meta, and the original URL */}
      <article className="tg-card">
        <div className="tg-row" style={{ gap: 14, alignItems: "flex-start" }}>
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              width={80}
              height={80}
              style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
            />
          )}
          <div className="tg-text" style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>
              {item.sourceLabel} • {item.date}
              {item.time ? ` ${item.time}` : ""} • {item.type}
            </p>
            <p style={{ wordBreak: "break-all", fontSize: 13, color: "var(--text-muted, #555)" }}>
              <a href={item.url || "#"} target="_blank" rel="noreferrer">
                {item.url || "(sem URL)"}
              </a>
            </p>
          </div>
        </div>
      </article>

      {/* Inline media preview for Telegram media items. The `type` field on
          a SavedItem is set to one of these strings only when the item came
          from a Telegram media handler (saveMediaForUser); other sources
          carry generic types like "Vídeo", "Post", "Mensagem", "Link" via
          sourceType[]. We only embed when type matches a media kind we know
          how to render — Documento stays as a plain link. */}
      <MediaPreview type={item.type} url={item.url} title={item.title} />

      {/* Edit form */}
      <form onSubmit={handleSave} style={{ marginTop: 16 }}>
        <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Título">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className="tg-code"
              style={inputStyle}
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              className="tg-code"
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </Field>

          <Field
            label="Resumo (IA)"
            hint="Você pode reescrever o que a IA gerou. Vazio = a IA reescreve no próximo save."
          >
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={2000}
              rows={4}
              className="tg-code"
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </Field>

          <Field label="Tags" hint="Separadas por vírgula. Sem # — só o nome.">
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              className="tg-code"
              style={inputStyle}
              placeholder="estudo, referência, video"
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Coleção">
              <select
                value={collId}
                onChange={(e) => setCollId(e.target.value)}
                className="tg-code"
                style={inputStyle}
              >
                {availableCollections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="tg-code"
                style={inputStyle}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {error && (
            <p className="login-error" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              className="text-button"
              onClick={handleDelete}
              disabled={pending}
              style={{ color: "#dc2626" }}
            >
              Apagar item
            </button>
            <button type="submit" className="primary-button" disabled={pending}>
              {pending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}

// Renders the actual media inline so the user doesn't have to click the URL
// (which currently triggers a download or opens a new tab without the SaveHub
// chrome). Only fires for Telegram-uploaded media kinds; everything else
// falls through to the URL link in the header card above.
function MediaPreview({
  type,
  url,
  title,
}: {
  type: string;
  url: string;
  title: string;
}) {
  if (!url) return null;

  // These exact strings are produced by saveMediaForUser in lib/telegram.ts.
  // If new media kinds are added there, mirror them here.
  const isImage = type === "Foto";
  const isVideo = type === "Vídeo" || type === "Vídeo redondo";
  const isAudio = type === "Áudio" || type === "Voice";

  if (!isImage && !isVideo && !isAudio) return null;

  const wrapStyle: React.CSSProperties = { marginTop: 12 };

  if (isImage) {
    return (
      <article className="tg-card" style={wrapStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          style={{ maxWidth: "100%", height: "auto", borderRadius: 8, display: "block" }}
        />
      </article>
    );
  }

  if (isVideo) {
    return (
      <article className="tg-card" style={wrapStyle}>
        <video
          src={url}
          controls
          playsInline
          style={{ width: "100%", borderRadius: 8, display: "block" }}
        />
      </article>
    );
  }

  // Audio: voice notes from Telegram are OGG/Opus. Safari (desktop + iOS)
  // historically struggled with OGG; modern Safari handles Opus in WebM but
  // not always in OGG containers. If playback fails, the controls element
  // still shows and at least the user can right-click → download.
  // Mic icon header keeps the visual identity consistent with the library
  // card thumb and the homepage detail-cover, so the user immediately reads
  // the kind without scanning labels.
  return (
    <article className="tg-card" style={wrapStyle}>
      <div className="tg-row" style={{ alignItems: "center", gap: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "linear-gradient(135deg, #2563eb 0%, #0cf2a7 100%)",
            color: "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="mic" />
        </div>
        <audio
          src={url}
          controls
          style={{ flex: 1, minWidth: 0, display: "block" }}
        />
      </div>
    </article>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span
        className="eyebrow"
        style={{ display: "block", marginBottom: 4, fontSize: 11 }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          className="tg-help"
          style={{ display: "block", marginTop: 4, fontSize: 12 }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 15,
  boxSizing: "border-box",
};
