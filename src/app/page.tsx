import SaveHubApp from "@/components/SaveHubApp";
import { listCollectionNames, listItems } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { signOut } from "@/auth";

type SearchParams = Promise<{
  savedFromShare?: string;
  shareError?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [items, collections, user, params] = await Promise.all([
    listItems(),
    listCollectionNames(),
    getCurrentUser(),
    searchParams,
  ]);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  // Translate ?savedFromShare / ?shareError into a flash message the client
  // shows once via the toast on mount.
  const flash = params.savedFromShare
    ? "Conteúdo salvo via Compartilhar."
    : params.shareError === "missing-url"
      ? "Nenhuma URL detectada no conteúdo compartilhado."
      : params.shareError === "invalid-url"
        ? "URL compartilhada não é válida."
        : params.shareError === "save-failed"
          ? "Erro ao salvar via Compartilhar. Tente de novo."
          : null;

  return (
    <SaveHubApp
      items={items}
      collections={collections}
      user={user}
      signOutAction={handleSignOut}
      flashMessage={flash}
    />
  );
}
