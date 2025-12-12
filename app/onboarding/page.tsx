"use client";

/**
 * Page d'onboarding pour la configuration initiale de l'entreprise
 * 
 * Cette page permet à l'utilisateur de configurer son entreprise lors de la première connexion.
 * Les informations collectées sont obligatoires pour générer des factures légales.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateCompanyDetails, type OnboardingCompanyData } from "@/app/actions/onboarding";

/**
 * Page d'onboarding
 * Formulaire de configuration de l'entreprise avec tous les champs légaux requis
 */
export default function OnboardingPage() {
  const router = useRouter();
  
  // États pour gérer les champs du formulaire
  const [formData, setFormData] = useState<OnboardingCompanyData>({
    name: "",
    siret: "",
    address: "",
    vatNumber: "",
    capital: "",
    legalForm: "",
    apeCode: "",
  });

  // États pour gérer le chargement et les erreurs
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Gestion du changement de valeur des champs
   * 
   * @param field - Nom du champ à mettre à jour
   * @param value - Nouvelle valeur du champ
   */
  const handleChange = (field: keyof OnboardingCompanyData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Réinitialiser l'erreur quand l'utilisateur modifie un champ
    if (error) {
      setError(null);
    }
  };

  /**
   * Gestion de la soumission du formulaire
   * 
   * @param e - Événement de soumission du formulaire
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Appel de la Server Action pour mettre à jour l'entreprise
      await updateCompanyDetails(formData);

      // Redirection vers le dashboard en cas de succès
      router.push("/");
    } catch (err) {
      // Gestion des erreurs avec message utilisateur
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'enregistrement"
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">
              Configurons votre entreprise 🚀
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Ces informations sont obligatoires pour générer vos factures légales.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Affichage des erreurs */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Nom de l'entreprise */}
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-slate-700"
                >
                  Nom de l'entreprise <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Ex: Ma Société SARL"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Forme Juridique */}
              <div className="space-y-2">
                <label
                  htmlFor="legalForm"
                  className="text-sm font-medium text-slate-700"
                >
                  Forme Juridique
                </label>
                <select
                  id="legalForm"
                  value={formData.legalForm}
                  onChange={(e) => handleChange("legalForm", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoading}
                >
                  <option value="">Sélectionner une forme juridique</option>
                  <option value="SAS">SAS (Société par Actions Simplifiée)</option>
                  <option value="SARL">SARL (Société à Responsabilité Limitée)</option>
                  <option value="SA">SA (Société Anonyme)</option>
                  <option value="EI">EI (Entreprise Individuelle)</option>
                  <option value="EURL">EURL (Entreprise Unipersonnelle à Responsabilité Limitée)</option>
                  <option value="SNC">SNC (Société en Nom Collectif)</option>
                  <option value="SASU">SASU (Société par Actions Simplifiée Unipersonnelle)</option>
                  <option value="Auto-entrepreneur">Auto-entrepreneur</option>
                </select>
              </div>

              {/* Capital */}
              <div className="space-y-2">
                <label
                  htmlFor="capital"
                  className="text-sm font-medium text-slate-700"
                >
                  Capital (en euros)
                </label>
                <Input
                  id="capital"
                  type="text"
                  value={formData.capital}
                  onChange={(e) => handleChange("capital", e.target.value)}
                  placeholder="Ex: 10000"
                  disabled={isLoading}
                />
              </div>

              {/* SIRET */}
              <div className="space-y-2">
                <label
                  htmlFor="siret"
                  className="text-sm font-medium text-slate-700"
                >
                  SIRET <span className="text-red-500">*</span>
                </label>
                <Input
                  id="siret"
                  type="text"
                  value={formData.siret}
                  onChange={(e) => handleChange("siret", e.target.value)}
                  placeholder="14 chiffres (ex: 12345678901234)"
                  maxLength={14}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Code APE */}
              <div className="space-y-2">
                <label
                  htmlFor="apeCode"
                  className="text-sm font-medium text-slate-700"
                >
                  Code APE (Code NAF)
                </label>
                <Input
                  id="apeCode"
                  type="text"
                  value={formData.apeCode}
                  onChange={(e) => handleChange("apeCode", e.target.value)}
                  placeholder="Ex: 6201Z"
                  maxLength={5}
                  disabled={isLoading}
                />
              </div>

              {/* Adresse Complète */}
              <div className="space-y-2">
                <label
                  htmlFor="address"
                  className="text-sm font-medium text-slate-700"
                >
                  Adresse Complète
                </label>
                <Input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Ex: 123 Rue Example, 75001 Paris"
                  disabled={isLoading}
                />
              </div>

              {/* Numéro TVA */}
              <div className="space-y-2">
                <label
                  htmlFor="vatNumber"
                  className="text-sm font-medium text-slate-700"
                >
                  Numéro TVA Intracommunautaire
                </label>
                <Input
                  id="vatNumber"
                  type="text"
                  value={formData.vatNumber}
                  onChange={(e) => handleChange("vatNumber", e.target.value)}
                  placeholder="Ex: FR12345678901"
                  disabled={isLoading}
                />
              </div>

              {/* Bouton de soumission */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? "Enregistrement..." : "Enregistrer et Commencer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
