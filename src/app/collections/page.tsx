import Link from "next/link";
import { Icon } from "@/components/Icon";
import CollectionsView from "@/components/CollectionsView";
import { listCollectionsWithCounts } from "@/lib/queries";

export default async function CollectionsPage() {
  const collections = await listCollectionsWithCounts();

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
          <p className="eyebrow">Biblioteca</p>
          <h1>Coleções</h1>
        </div>
      </header>

      <CollectionsView initialCollections={collections} />
    </main>
  );
}
