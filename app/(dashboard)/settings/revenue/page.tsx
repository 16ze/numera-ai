/**
 * Page de configuration du Chiffre d'Affaires
 * Permet de définir les mots-clés qui identifient les transactions comme du vrai CA
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { RevenueKeywordsClient } from "./RevenueKeywordsClient";

export default async function RevenueConfigurationPage() {
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

  // Récupération des mots-clés actuels (séparés par des virgules)
  const currentKeywords = company.revenueKeywords
    ? company.revenueKeywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : [];

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-green-100">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Configuration du Chiffre d&apos;Affaires
            </h1>
            <p className="text-slate-600 mt-1">
              Définissez les mots-clés qui identifient les transactions comme du
              vrai CA
            </p>
          </div>
        </div>
      </div>

      {/* Formulaire de configuration */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Mots-clés de revenus</CardTitle>
          <CardDescription>
            Seules les transactions INCOME contenant ces mots-clés dans leur
            description seront comptées comme Chiffre d&apos;Affaires dans le
            Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueKeywordsClient initialKeywords={currentKeywords} />
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
                Comment ça fonctionne ?
              </p>
              <p className="text-sm text-blue-700 mb-2">
                Par défaut, toutes les transactions de type INCOME sont comptées
                comme CA. Cependant, certaines entrées d&apos;argent ne sont pas
                du CA (ex: apport personnel, remboursement, etc.).
              </p>
              <p className="text-sm text-blue-700 mb-2">
                En définissant des mots-clés (ex: &quot;STRIPE&quot;,
                &quot;VRST&quot;, &quot;VIR&quot;), vous pouvez filtrer
                uniquement les transactions qui contiennent ces mots dans leur
                description. La recherche est insensible à la casse.
              </p>
              <p className="text-sm text-blue-700">
                <strong>Exemple :</strong> Si vous ajoutez &quot;STRIPE&quot; et
                &quot;VRST&quot;, seules les transactions INCOME avec
                &quot;STRIPE&quot; ou &quot;VRST&quot; dans la description
                seront comptées comme CA.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
