import { getFileSystem } from "@/app/actions/folders";
import { getClients } from "@/app/actions/clients";
import { DocumentsPageClient } from "./DocumentsPageClient";

/**
 * Page de gestion des Documents - Explorateur de fichiers
 * Affiche les documents et dossiers avec navigation hiérarchique
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string }>;
}) {
  const params = await searchParams;
  const folderId = params.folderId || null;
  const fileSystem = await getFileSystem(folderId);
  const clients = await getClients();

  return (
    <DocumentsPageClient
      initialFileSystem={fileSystem}
      clients={clients}
      currentFolderId={folderId}
    />
  );
}
