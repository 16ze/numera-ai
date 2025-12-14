import { getDashboardData } from "@/app/(dashboard)/actions/dashboard";
import { DashboardClient } from "./DashboardClient";

/**
 * Page Dashboard avec mise à jour dynamique
 * Les données initiales sont chargées côté serveur, puis le composant client
 * permet la mise à jour automatique sans rechargement de page
 */
export default async function DashboardPage() {
  // Chargement initial des données côté serveur
  const initialData = await getDashboardData();

  return <DashboardClient initialData={initialData} />;
}
