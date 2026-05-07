"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { saveItemAction } from "@/app/actions";
import { detectSource, normalize, sourceNames, sourceShort } from "@/lib/data";
import type { FilterOption, SavedItem, Source, SortOption } from "@/lib/types";

const sourceFilters: { id: FilterOption; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "youtube", label: "YouTube" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "twitter", label: "Twitter" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "web", label: "Web" },
];

type NavTarget = "library" | "collections" | "ideas" | "profile";

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null;

type Props = {
  items: SavedItem[];
  collections: string[];
  user: SessionUser;
  signOutAction: () => void | Promise<void>;
  flashMessage?: string | null;
};

export default function SaveHubApp({
  items,
  collections,
  user,
  signOutAction,
  flashMessage,
}: Props) {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const [nav, setNav] = useState<NavTarget>("library");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCollection, setNewCollection] = useState<string>(collections[0] ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toastTimer = useRef<number | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  // Refs to the inline media players in the detail panel. Used by the Abrir
  // button so it triggers playback in-place instead of opening a new tab
  // (which on Safari just shows a blank page for OGG voice notes).
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Keep activeId valid when the items list changes (after a save).
  useEffect(() => {
    if (items.length === 0) {
      setActiveId("");
      return;
    }
    if (!items.some((i) => i.id === activeId)) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

  // Keep collection picker value valid as the list of collections evolves.
  useEffect(() => {
    if (collections.length === 0) return;
    if (!collections.includes(newCollection)) {
      setNewCollection(collections[0]);
    }
  }, [collections, newCollection]);

  // Body scroll lock + focus when sheet opens.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = sheetOpen ? "hidden" : "";
    if (sheetOpen) {
      requestAnimationFrame(() => urlInputRef.current?.focus());
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  // ESC closes sheet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && sheetOpen) setSheetOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Surface server-side flash messages (e.g. after a /share redirect) once
  // via the regular toast, then strip the query string so a refresh doesn't
  // re-trigger it.
  useEffect(() => {
    if (!flashMessage) return;
    showToast(flashMessage);
    const url = new URL(window.location.href);
    url.searchParams.delete("savedFromShare");
    url.searchParams.delete("shareError");
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
    // showToast is stable enough; we want this to run exactly once per mount
    // when a flash is present. Re-runs on flash change are correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashMessage]);

  const filteredItems = useMemo(() => {
    let list = [...items];
    if (filter !== "all") list = list.filter((i) => i.source === filter);
    const q = normalize(query.trim());
    if (q) {
      list = list.filter((item) => {
        const haystack = normalize(
          `${item.title} ${item.description} ${item.collection} ${item.tags.join(" ")}`,
        );
        return haystack.includes(q);
      });
    }
    if (sort === "source") list.sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel));
    if (sort === "collection") list.sort((a, b) => a.collection.localeCompare(b.collection));
    return list;
  }, [items, filter, query, sort]);

  const activeItem =
    items.find((i) => i.id === activeId) ?? filteredItems[0] ?? items[0] ?? null;

  const savedCount = items.length;
  const summaryCount = items.filter((i) => i.summarized).length;
  const queueCount = items.filter((i) => i.status === "Para usar").length;

  const detectedSource: Source = newUrl ? detectSource(newUrl) : "web";

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }

  function handleNavClick(target: NavTarget) {
    setNav(target);
    if (target !== "library") {
      showToast("Área marcada para a próxima versão.");
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newUrl) return;

    const submission = {
      url: newUrl,
      title: newTitle,
      collection: newCollection || collections[0] || "Roteiros",
    };

    startTransition(async () => {
      try {
        await saveItemAction(submission);
        setNewUrl("");
        setNewTitle("");
        setSheetOpen(false);
        showToast("Conteúdo salvo no SaveHub.");
      } catch (err) {
        console.error(err);
        showToast("Erro ao salvar. Tente novamente.");
      }
    });
  }

  return (
    <>
      <div className="app-shell">
        <aside className="rail" aria-label="Navegação principal">
          <a className="brand" href="#" aria-label="SaveHub">
            <span className="brand-mark">S</span>
            <span className="brand-name">SaveHub</span>
          </a>

          <nav className="rail-nav">
            <button
              className={`rail-item${nav === "library" ? " is-active" : ""}`}
              type="button"
              onClick={() => handleNavClick("library")}
            >
              <Icon name="archive" />
              <span>Biblioteca</span>
            </button>
            <Link
              href="/collections"
              prefetch={false}
              className="rail-item"
            >
              <Icon name="layers" />
              <span>Coleções</span>
            </Link>
            <button
              className={`rail-item${nav === "ideas" ? " is-active" : ""}`}
              type="button"
              onClick={() => handleNavClick("ideas")}
            >
              <Icon name="sparkles" />
              <span>Ideias</span>
            </button>
            <button
              className={`rail-item${nav === "profile" ? " is-active" : ""}`}
              type="button"
              onClick={() => handleNavClick("profile")}
            >
              <Icon name="user" />
              <span>Perfil</span>
            </button>
          </nav>

          {user && (
            <div className="rail-profile">
              <div
                className={`rail-avatar${user.image ? "" : " placeholder"}`}
                title={user.email ?? undefined}
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name ?? ""} />
                ) : (
                  <span>{(user.name ?? user.email ?? "?")[0]?.toUpperCase()}</span>
                )}
              </div>
              <form action={signOutAction}>
                <button className="rail-logout" type="submit">
                  Sair
                </button>
              </form>
            </div>
          )}
        </aside>

        <main className="workspace">
          <header className="topbar">
            <div className="title-block">
              <p className="eyebrow">Minha biblioteca</p>
              <h1>SaveHub</h1>
            </div>

            <div className="top-actions">
              <Link
                href="/settings"
                className="icon-button"
                aria-label="Configurações"
                prefetch={false}
              >
                <Icon name="settings" />
              </Link>
              <button className="icon-button" type="button" aria-label="Sincronizar">
                <Icon name="refresh" />
              </button>
              <button
                className="primary-button"
                type="button"
                aria-label="Salvar conteúdo"
                onClick={() => setSheetOpen(true)}
              >
                <Icon name="plus" />
                <span>Salvar</span>
              </button>
            </div>
          </header>

          <section className="command-strip" aria-label="Busca e filtros">
            <label className="search-box" htmlFor="searchInput">
              <Icon name="search" />
              <input
                id="searchInput"
                type="search"
                placeholder="Buscar título, tag ou coleção"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            <div className="source-filters" role="tablist" aria-label="Fonte">
              {sourceFilters.map((f) => (
                <button
                  key={f.id}
                  className={`filter-chip${filter === f.id ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          <section className="summary-row" aria-label="Resumo da biblioteca">
            <article className="metric">
              <span className="metric-label">Salvos</span>
              <strong>{savedCount}</strong>
            </article>
            <article className="metric">
              <span className="metric-label">Resumidos</span>
              <strong>{summaryCount}</strong>
            </article>
            <article className="metric">
              <span className="metric-label">Para usar</span>
              <strong>{queueCount}</strong>
            </article>
            <article className="metric metric-accent">
              <span className="metric-label">Plano</span>
              <strong>Creator</strong>
            </article>
          </section>

          <section className="collections-band" aria-label="Coleções">
            <div className="section-heading">
              <h2>Coleções</h2>
              <button className="text-button" type="button">
                Ver todas
              </button>
            </div>

            <div className="collections-list">
              {collections.map((collection) => {
                const count = items.filter((i) => i.collection === collection).length;
                return (
                  <button
                    key={collection}
                    className="collection-card"
                    type="button"
                    onClick={() => setQuery(collection)}
                  >
                    <strong>{collection}</strong>
                    <span>
                      {count} {count === 1 ? "item" : "itens"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="library-layout" aria-label="Conteúdos salvos">
            <div className="content-column">
              <div className="section-heading">
                <h2>Recentes</h2>
                <label className="select-control">
                  <span className="sr-only">Ordenação</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="source">Por fonte</option>
                    <option value="collection">Por coleção</option>
                  </select>
                </label>
              </div>

              <div className="content-list">
                {filteredItems.map((item) => (
                  <article
                    key={item.id}
                    className={`media-card${item.id === activeItem?.id ? " is-active" : ""}`}
                    tabIndex={0}
                    aria-label={item.title}
                    onClick={() => setActiveId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setActiveId(item.id);
                    }}
                  >
                    <div className="thumb">
                      {/* Three render paths for the thumbnail:
                          1. Has image -> use it
                          2. Telegram photo without image -> derive proxy URL
                             (backfill for items saved before saveMediaForUser
                             populated `image`)
                          3. Telegram audio/video without image -> show a
                             centered icon so the slot doesn't look broken
                             (audio/video bytes can't render in <img>) */}
                      {(() => {
                        const src =
                          item.image ||
                          (item.type === "Foto"
                            ? `/api/telegram/file/${item.id}`
                            : "");
                        if (src) {
                          return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt="" loading="lazy" />
                          );
                        }
                        const audioKind =
                          item.type === "Voice" || item.type === "Áudio";
                        const videoKind =
                          item.type === "Vídeo" || item.type === "Vídeo redondo";
                        if (audioKind || videoKind) {
                          return (
                            <div className="thumb-placeholder" aria-hidden="true">
                              <Icon name={audioKind ? "mic" : "film"} />
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <span className="source-badge">{sourceShort[item.source]}</span>
                      {item.source === "youtube" && <span className="play-badge">▶</span>}
                    </div>
                    <div className="media-body">
                      <div className="media-meta">
                        <span>{item.sourceLabel}</span>
                        <span>•</span>
                        <span>{item.type}</span>
                        <span>•</span>
                        <span>
                          {item.date}
                          {item.time ? ` ${item.time}` : ""}
                        </span>
                      </div>
                      <h3 className="media-title">{item.title}</h3>
                      <p className="media-description">{item.description}</p>
                      <div className="media-tags">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button
                        className="quick-action"
                        type="button"
                        aria-label="Compartilhar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon name="share" />
                      </button>
                      {/* Direct edit link on every card so mobile users (where
                          the detail-panel is hidden via CSS at <=760px) still
                          have a path into /items/[id]. stopPropagation keeps
                          the parent card's setActiveId from firing. */}
                      <Link
                        href={`/items/${item.id}`}
                        prefetch={false}
                        className="quick-action"
                        aria-label="Editar"
                        title="Editar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon name="edit" />
                      </Link>
                      <button
                        className="quick-action"
                        type="button"
                        aria-label="Fixar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon name="bookmark" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {filteredItems.length === 0 && (
                <p className="empty-state">Nenhum conteúdo encontrado.</p>
              )}
            </div>

            <aside className="detail-panel" aria-label="Detalhe do conteúdo">
              {activeItem && (
                <>
                  <div className="detail-cover">
                    {(() => {
                      // Same render-time fallback for photos as the card
                      // thumb. For audio/video items, embed a real player so
                      // the user can listen / watch without leaving the
                      // detail panel — replaces the empty grey rectangle.
                      const src =
                        activeItem.image ||
                        (activeItem.type === "Foto"
                          ? `/api/telegram/file/${activeItem.id}`
                          : "");
                      if (src) {
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" />
                        );
                      }
                      const proxyUrl = `/api/telegram/file/${activeItem.id}`;
                      const audioKind =
                        activeItem.type === "Voice" ||
                        activeItem.type === "Áudio";
                      const videoKind =
                        activeItem.type === "Vídeo" ||
                        activeItem.type === "Vídeo redondo";
                      if (audioKind) {
                        return (
                          <div className="detail-cover-media">
                            <div className="thumb-placeholder">
                              <Icon name="mic" />
                            </div>
                            <audio
                              ref={audioRef}
                              src={proxyUrl}
                              controls
                              preload="none"
                            />
                          </div>
                        );
                      }
                      if (videoKind) {
                        return (
                          <video
                            ref={videoRef}
                            src={proxyUrl}
                            controls
                            playsInline
                            preload="metadata"
                          />
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="detail-meta">
                    <span className="source-pill">
                      <span className={`source-dot source-${activeItem.source}`}></span>
                      {activeItem.sourceLabel}
                    </span>
                    <span>{activeItem.collection}</span>
                    <span>
                      {activeItem.date}
                      {activeItem.time ? ` ${activeItem.time}` : ""}
                    </span>
                  </div>
                  <h2>{activeItem.title}</h2>
                  <p className="detail-summary">{activeItem.description}</p>
                  <div className="media-tags">
                    {activeItem.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="ai-box">
                    <h3>Resumo IA</h3>
                    <p>{activeItem.summary}</p>
                  </div>
                  <div className="quick-actions">
                    {(() => {
                      // For Telegram audio/video items, "Abrir" plays the
                      // inline player above instead of opening a new tab —
                      // new tabs render the proxy URL directly which Safari
                      // can't play (OGG/Opus voice notes) and Chrome shows
                      // as a barebones <audio> control without the SaveHub
                      // chrome.
                      const isAudio =
                        activeItem.type === "Voice" || activeItem.type === "Áudio";
                      const isVideo =
                        activeItem.type === "Vídeo" ||
                        activeItem.type === "Vídeo redondo";
                      if (isAudio || isVideo) {
                        return (
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                              const el = isAudio
                                ? audioRef.current
                                : videoRef.current;
                              if (!el) return;
                              el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                              el.play().catch((e) =>
                                console.warn("[player] play() rejected:", e),
                              );
                            }}
                          >
                            <Icon name={isAudio ? "mic" : "film"} />
                            <span>Tocar</span>
                          </button>
                        );
                      }
                      return (
                        <a
                          className="primary-button"
                          href={activeItem.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Icon name="share" />
                          <span>Abrir</span>
                        </a>
                      );
                    })()}
                    <Link
                      href={`/items/${activeItem.id}`}
                      prefetch={false}
                      className="icon-button"
                      aria-label="Editar item"
                      title="Editar"
                    >
                      <Icon name="edit" />
                    </Link>
                    <button className="icon-button" type="button" aria-label="Fixar">
                      <Icon name="bookmark" />
                    </button>
                  </div>
                </>
              )}
            </aside>
          </section>
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Navegação inferior">
        <button
          className={`mobile-nav-item${nav === "library" ? " is-active" : ""}`}
          type="button"
          onClick={() => handleNavClick("library")}
        >
          <Icon name="archive" />
          <span>Biblioteca</span>
        </button>
        <button
          className={`mobile-nav-item${nav === "collections" ? " is-active" : ""}`}
          type="button"
          onClick={() => handleNavClick("collections")}
        >
          <Icon name="layers" />
          <span>Coleções</span>
        </button>
        <button
          className={`mobile-nav-item${nav === "ideas" ? " is-active" : ""}`}
          type="button"
          onClick={() => handleNavClick("ideas")}
        >
          <Icon name="sparkles" />
          <span>Ideias</span>
        </button>
        <button
          className={`mobile-nav-item${nav === "profile" ? " is-active" : ""}`}
          type="button"
          onClick={() => handleNavClick("profile")}
        >
          <Icon name="user" />
          <span>Perfil</span>
        </button>
      </nav>

      {sheetOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} />
          <section
            className="save-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saveSheetTitle"
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <div>
                <p className="eyebrow">Novo conteúdo</p>
                <h2 id="saveSheetTitle">Salvar no hub</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar"
                onClick={() => setSheetOpen(false)}
              >
                <Icon name="x" />
              </button>
            </div>

            <form className="save-form" onSubmit={handleSubmit}>
              <label>
                <span>Link</span>
                <input
                  ref={urlInputRef}
                  type="url"
                  placeholder="https://..."
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </label>

              <label>
                <span>Título</span>
                <input
                  type="text"
                  placeholder="Nome do conteúdo"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </label>

              <label>
                <span>Coleção</span>
                <select
                  value={newCollection}
                  onChange={(e) => setNewCollection(e.target.value)}
                >
                  {collections.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>

              <div className="detected-source">
                <span className={`source-dot source-${detectedSource}`}></span>
                <span>Fonte detectada: {sourceNames[detectedSource]}</span>
              </div>

              <button className="primary-button full" type="submit" disabled={pending}>
                <Icon name="bookmark" />
                <span>{pending ? "Salvando..." : "Salvar conteúdo"}</span>
              </button>
            </form>
          </section>
        </>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}
