import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import ItemEditor from "@/components/ItemEditor";
import { getItem, listCollectionsWithCounts } from "@/lib/queries";

type PageParams = Promise<{ id: string }>;

export default async function ItemDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;

  const [data, collections] = await Promise.all([
    getItem(id),
    listCollectionsWithCounts(),
  ]);

  if (!data) notFound();

  return (
    <main className="settings-shell">
      <header className="settings-header">
        {/* Back arrow always goes to the library home — that's where the
            primary entry point lives (pencil icon on each card). The browser
            back button still respects history if the user came from a
            different page (e.g., /collections/[id]). */}
        <Link
          href="/"
          className="icon-button"
          aria-label="Voltar pra biblioteca"
          prefetch={false}
        >
          <Icon name="arrow-left" />
        </Link>
        <div>
          <p className="eyebrow">Item</p>
          <h1>Editar</h1>
        </div>
      </header>

      <ItemEditor
        item={data.item}
        collectionId={data.collectionId}
        availableCollections={collections.map((c) => ({ id: c.id, name: c.name }))}
      />
    </main>
  );
}
