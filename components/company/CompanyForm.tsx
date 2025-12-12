"use client";

/**
 * Composant formulaire pour la configuration de l'entreprise
 * Réutilisable pour l'onboarding et les paramètres
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCompanyDetails, type CompanyUpdateData } from "@/app/actions/company";
import { Building2, MapPin, CreditCard, FileText, Scale } from "lucide-react";

/**
 * Props du formulaire
 */
interface CompanyFormProps {
  /** Données initiales de l'entreprise (pour pré-remplissage) */
  initialData?: {
    name?: string;
    address?: string;
    siret?: string;
    apeCode?: string;
    vatNumber?: string;
    capital?: string;
    legalForm?: string;
    isAutoEntrepreneur?: boolean;
  };
  /** URL de redirection après soumission (optionnel) */
  redirectTo?: string;
  /** Texte du bouton de soumission */
  submitButtonText?: string;
}

/**
 * Formulaire de configuration de l'entreprise
 */
export function CompanyForm({
  initialData,
  redirectTo,
  submitButtonText = "Enregistrer",
}: CompanyFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États des champs du formulaire
  const [formData, setFormData] = useState<CompanyUpdateData>({
    name: initialData?.name || "",
    address: initialData?.address || "",
    siret: initialData?.siret || "",
    apeCode: initialData?.apeCode || "",
    vatNumber: initialData?.vatNumber || "",
    capital: initialData?.capital || "",
    legalForm: initialData?.legalForm || "EI",
    isAutoEntrepreneur: initialData?.isAutoEntrepreneur ?? true,
  });

  /**
   * Gestion de la soumission du formulaire
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await updateCompanyDetails(formData);

      // Redirection si spécifiée
      if (redirectTo) {
        // Utiliser window.location pour forcer un rechargement complet de la page
        // Cela garantit que le layout dashboard verra les nouvelles données (SIRET)
        // après la mise à jour, évitant ainsi les boucles de redirection
        window.location.href = redirectTo;
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la mise à jour"
      );
      setIsLoading(false);
    }
  };

  /**
   * Gestion du changement des champs
   */
  const handleChange = (
    field: keyof CompanyUpdateData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Message d'erreur */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Informations de base */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle>Informations de base</CardTitle>
          </div>
          <CardDescription>
            Les informations principales de votre entreprise
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Nom de l&apos;entreprise <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Ma Société"
              required
            />
          </div>

          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              <MapPin className="inline h-4 w-4 mr-1" />
              Adresse
            </label>
            <Input
              id="address"
              type="text"
              value={formData.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="123 Rue de la République, 75001 Paris"
            />
          </div>
        </CardContent>
      </Card>

      {/* Informations légales */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-600" />
            <CardTitle>Informations légales</CardTitle>
          </div>
          <CardDescription>
            Données officielles de votre entreprise
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="legalForm"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Forme juridique
            </label>
            <select
              id="legalForm"
              value={formData.legalForm || ""}
              onChange={(e) => handleChange("legalForm", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="EI">Entreprise Individuelle (EI)</option>
              <option value="Auto-entrepreneur">Auto-entrepreneur</option>
              <option value="SARL">SARL</option>
              <option value="SAS">SAS</option>
              <option value="EURL">EURL</option>
              <option value="SA">SA</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="siret"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              <FileText className="inline h-4 w-4 mr-1" />
              SIRET
            </label>
            <Input
              id="siret"
              type="text"
              value={formData.siret || ""}
              onChange={(e) => handleChange("siret", e.target.value)}
              placeholder="12345678901234"
              maxLength={14}
            />
          </div>

          <div>
            <label
              htmlFor="apeCode"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Code APE / NAF
            </label>
            <Input
              id="apeCode"
              type="text"
              value={formData.apeCode || ""}
              onChange={(e) => handleChange("apeCode", e.target.value)}
              placeholder="6201Z"
            />
          </div>

          <div>
            <label
              htmlFor="vatNumber"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Numéro de TVA Intracommunautaire
            </label>
            <Input
              id="vatNumber"
              type="text"
              value={formData.vatNumber || ""}
              onChange={(e) => handleChange("vatNumber", e.target.value)}
              placeholder="FR12345678901"
            />
          </div>

          <div>
            <label
              htmlFor="capital"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              <CreditCard className="inline h-4 w-4 mr-1" />
              Capital social (€)
            </label>
            <Input
              id="capital"
              type="text"
              value={formData.capital || ""}
              onChange={(e) => handleChange("capital", e.target.value)}
              placeholder="1000"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="isAutoEntrepreneur"
              checked={formData.isAutoEntrepreneur}
              onChange={(e) =>
                handleChange("isAutoEntrepreneur", e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="isAutoEntrepreneur"
              className="text-sm font-medium text-slate-700"
            >
              Je suis auto-entrepreneur (TVA non applicable, art. 293 B du CGI)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Bouton de soumission */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading} size="lg">
          {isLoading ? "Enregistrement..." : submitButtonText}
        </Button>
      </div>
    </form>
  );
}

