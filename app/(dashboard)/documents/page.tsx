import { getDocuments } from "@/app/actions/documents";
import { getClients } from "@/app/actions/clients";
import { DocumentsPageClient } from "./DocumentsPageClient";

/**
 * Page de gestion des Documents
 * Affiche les documents stockés et permet l'upload avec extraction de texte
 */
export default async function DocumentsPage() {
  const documents = await getDocuments();
  const clients = await getClients();

  return <DocumentsPageClient initialDocuments={documents} clients={clients} />;
}
