/**
 * Page du Simulateur de Rentabilité Avancé
 * Permet de calculer le coût de revient précis d'une prestation
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { redirect } from "next/navigation";
import { getResources, getServiceRecipes } from "@/app/actions/simulator";
import { SimulatorClient } from "./SimulatorClient";

export default async function SimulatorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Récupération des données initiales
  const resources = await getResources();
  const serviceRecipes = await getServiceRecipes();

  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Simulateur de Rentabilité Avancé</h1>
        <p className="text-slate-500 mt-2">
          Calculez le coût de revient précis de vos prestations en tenant compte
          de tous les coûts (consommables, matériel, main d'œuvre, charges)
        </p>
      </div>

      <SimulatorClient
        initialResources={resources}
        initialServiceRecipes={serviceRecipes}
      />
    </div>
  );
}
