/**
 * Page de paramètres de l'entreprise
 * Permet de modifier les informations de l'entreprise
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { CompanyForm } from "@/components/company/CompanyForm";
import { LogoUpload } from "@/components/company/LogoUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Download, Building2, FileDown, ChevronRight } from "lucide-react";
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

      {/* Upload Logo */}
      <Card className="max-w-4xl mb-6">
        <CardHeader>
          <CardTitle>Logo de l&apos;entreprise</CardTitle>
          <CardDescription>
            Le logo apparaîtra sur vos factures. Formats acceptés : JPEG, PNG, GIF, WebP (max 5MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUpload
            currentLogoUrl={company.logoUrl}
            companyName={company.name}
          />
        </CardContent>
      </Card>

      {/* Formulaire */}
      <div className="max-w-4xl">
        <CompanyForm
          initialData={initialData}
          submitButtonText="Enregistrer les modifications"
        />
      </div>

      {/* Section Export et Connexion Bancaire */}
      <div className="grid gap-4 md:grid-cols-2 mt-8">
        {/* Carte Export Comptable */}
        <Card className="hover:border-blue-300 transition-colors cursor-pointer">
          <Link href="/settings/export" className="block">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100">
                  <FileDown className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">
                    Export Comptable
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Téléchargez votre journal comptable au format CSV
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </CardContent>
          </Link>
        </Card>

        {/* Carte Connexion Bancaire */}
        <Card className="hover:border-green-300 transition-colors cursor-pointer">
          <Link href="/settings/bank" className="block">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100">
                  <Building2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">
                    Connexion Bancaire
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Connectez vos comptes pour synchroniser vos transactions automatiquement
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

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


