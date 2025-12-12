/**
 * Page de paramètres de l'entreprise
 * Permet de modifier les informations de l'entreprise
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { CompanyForm } from "@/components/company/CompanyForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Download } from "lucide-react";
import Link from "next/link";

/**
 * Page de paramètres
 * Affiche le formulaire pré-rempli avec les données actuelles de l'entreprise
 */
export default async function SettingsPage() {
  // Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
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

  // Données initiales de l'entreprise
  const initialData = {
    name: company.name || "",
    address: company.address || "",
    siret: company.siret || "",
    apeCode: company.apeCode || "",
    vatNumber: company.vatNumber || "",
    capital: company.capital || "",
    legalForm: company.legalForm || "EI",
    isAutoEntrepreneur: company.isAutoEntrepreneur ?? false,
  };

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Paramètres de l&apos;entreprise
            </h1>
            <p className="text-slate-600 mt-1">
              Modifiez les informations de votre entreprise à tout moment
            </p>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="max-w-4xl">
        <CompanyForm
          initialData={initialData}
          submitButtonText="Enregistrer les modifications"
        />
      </div>

      {/* Section Export Comptable */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Export Comptable</CardTitle>
          <CardDescription>
            Téléchargez votre journal comptable au format CSV pour votre expert-comptable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/export">
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Accéder à l&apos;export comptable
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Note informative */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
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
                À propos de ces informations
              </p>
              <p className="text-sm text-blue-700">
                Ces informations seront utilisées pour générer vos factures
                légalement conformes. Assurez-vous qu&apos;elles sont
                exactes et à jour.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


