/**
 * Page d'onboarding pour la configuration initiale de l'entreprise
 * Page épurée, centrée, sans sidebar
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { CompanyForm } from "@/components/company/CompanyForm";

/**
 * Page d'onboarding
 * Permet à l'utilisateur de configurer son entreprise lors de la première connexion
 */
export default async function OnboardingPage() {
  // Vérifier si l'utilisateur est connecté (redirige vers /sign-in si non)
  const user = await getCurrentUser();

  // Si l'utilisateur a déjà une entreprise configurée, rediriger vers le dashboard
  const company = user.companies[0];
  if (company && company.name !== "Ma Société") {
    redirect("/");
  }

  // Données initiales depuis l'entreprise existante (si elle existe)
  const initialData = company
    ? {
        name: company.name || "",
        address: company.address || "",
        siret: company.siret || "",
        apeCode: company.apeCode || "",
        vatNumber: company.vatNumber || "",
        capital: company.capital || "",
        legalForm: company.legalForm || "EI",
        isAutoEntrepreneur: company.isAutoEntrepreneur ?? true,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white mb-4">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Bienvenue ! Configurons votre entreprise
          </h1>
          <p className="text-lg text-slate-600">
            Remplissez ces informations pour commencer à gérer votre comptabilité
            avec Numera AI
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <CompanyForm
            initialData={initialData}
            redirectTo="/"
            submitButtonText="Créer mon entreprise"
          />
        </div>

        {/* Note de confidentialité */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Vos informations sont sécurisées et ne seront utilisées que pour
          générer vos factures légales.
        </p>
      </div>
    </div>
  );
}

