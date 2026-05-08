import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import IdeaGeneratorButton from "@/components/IdeaGeneratorButton";
import { listItemsInCollection } from "@/lib/queries";

type PageParams = Promise<{ id: string }>;

export default async function CollectionDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof listItemsInCollection>>;
  try {
    data = await listItemsInCollection(id);
  } catch {
    // Either the id is bogus or the collection belongs to a different user.
    // Either way, surface as 404 so we don't leak existence/ownership info.
    notFound();
  }

  const { collection, items } = data;

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <Link
          href="/collections"
          className="icon-button"
          aria-label="Voltar pra coleções"
          prefetch={false}
        >
          <Icon name="arrow-left" />
        </Link>
        <div>
          <p className="eyebrow">Coleção</p>
          <h1>{collection.name}</h1>
        </div>
      </header>

      <p className="settings-help">
        {items.length} {items.length === 1 ? "item" : "itens"} nessa coleção.
      </p>

      <IdeaGeneratorButton
        collectionId={collection.id}
        hasItems={items.length > 0}
      />

      {items.length === 0 ? (
        <p className="settings-help" style={{ marginTop: 16 }}>
          Nada salvo aqui ainda. Mande um link pelo bot com{" "}
          <code className="tg-code">#{collection.name}</code> ou pela página
          principal.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => (
            <li key={item.id} className="tg-card">
              <div className="tg-row" style={{ gap: 12, alignItems: "flex-start" }}>
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt=""
                    width={64}
                    height={64}
                    style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                  />
                )}
                <div className="tg-text" style={{ flex: 1, minWidth: 0 }}>
                  <p className="eyebrow" style={{ marginBottom: 2 }}>
                    {item.sourceLabel} • {item.date}
                    {item.time ? ` ${item.time}` : ""}
                  </p>
                  <strong style={{ display: "block", fontSize: 15 }}>
                    <a
                      href={item.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {item.title}
                    </a>
                  </strong>
                  {item.summary && item.summary !== "Resumindo..." && (
                    <p className="tg-help" style={{ marginTop: 4 }}>
                      {item.summary}
                    </p>
                  )}
                  <p style={{ marginTop: 6 }}>
                    <Link
                      href={`/items/${item.id}`}
                      prefetch={false}
                      className="text-button"
                      style={{ fontSize: 12 }}
                    >
                      Editar
                    </Link>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
