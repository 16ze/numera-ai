/**
 * Page du Simulateur de Rentabilité
 * Permet de calculer le prix de vente recommandé en fonction des coûts
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { redirect } from "next/navigation";
import { getCostProfile, getServices } from "@/app/actions/profitability";
import { ProfitabilitySimulator } from "./ProfitabilitySimulator";

export default async function ProfitabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Récupération des données initiales
  const costProfile = await getCostProfile();
  const services = await getServices();

  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Simulateur de Rentabilité</h1>
        <p className="text-slate-500 mt-2">
          Calculez le prix de vente optimal de vos services en fonction de vos
          coûts réels
        </p>
      </div>

      <ProfitabilitySimulator
        initialCostProfile={costProfile}
        initialServices={services}
      />
    </div>
  );
}
