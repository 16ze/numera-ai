/**
 * Page de configuration du taux de taxes
 * Permet de définir le pourcentage du CA à mettre de côté pour les taxes
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Receipt } from "lucide-react";
import { TaxRateClient } from "./TaxRateClient";

export default async function TaxConfigurationPage() {
  // Récupération de l'utilisateur connecté
  const user = await getCurrentUser();

  // Récupération de la première company de l'utilisateur
  const company = user.companies[0];

  if (!company) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Erreur</CardTitle>
            <CardDescription>
              Aucune entreprise trouvée. Veuillez contacter le support.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Récupération du taux de taxes actuel (par défaut 22.0)
  const currentTaxRate = company.taxRate ?? 22.0;

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-orange-100">
            <Receipt className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Configuration Fiscalité
            </h1>
            <p className="text-slate-600 mt-1">
              Définissez le pourcentage du CA à mettre de côté pour les taxes
            </p>
          </div>
        </div>
      </div>

      {/* Formulaire de configuration */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Radar à Taxes (Estimateur de charges)</CardTitle>
          <CardDescription>
            Ce taux représente le pourcentage de votre Chiffre d&apos;Affaires
            mensuel à mettre de côté pour les taxes (URSSAF/Impôts).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxRateClient initialTaxRate={currentTaxRate} />
        </CardContent>
      </Card>

      {/* Note informative */}
      <Card className="mt-8 bg-blue-50 border-blue-200 max-w-4xl">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-900 font-medium mb-1">
                Recommandations par statut
              </p>
              <p className="text-sm text-blue-700 mb-2">
                <strong>Auto-Entrepreneur de services :</strong> Nous recommandons
                22% (URSSAF + Impôts sur le revenu).
              </p>
              <p className="text-sm text-blue-700 mb-2">
                <strong>Auto-Entrepreneur de vente :</strong> Nous recommandons
                12% (URSSAF + Impôts sur le revenu).
              </p>
              <p className="text-sm text-blue-700">
                <strong>Note :</strong> Ces pourcentages sont des estimations.
                Consultez un expert-comptable pour des conseils personnalisés
                selon votre situation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
