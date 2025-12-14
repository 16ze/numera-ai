"use client";

/**
 * Composant Dialog pour créer ou modifier un client
 *
 * Ce composant sert à la fois pour la création et la modification d'un client.
 * Il utilise le même formulaire, pré-rempli si c'est une modification.
 * Support B2B (Entreprise) et B2C (Particulier) avec champs conditionnels.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { upsertClient, type ClientData } from "@/app/actions/clients";
import toast from "react-hot-toast";

/**
 * Type de client : Particulier ou Entreprise
 */
type ClientType = "particulier" | "entreprise";

/**
 * Props du composant ClientDialog
 */
interface ClientDialogProps {
  /** Indique si le dialog est ouvert */
  open: boolean;
  /** Fonction appelée pour fermer le dialog */
  onOpenChange: (open: boolean) => void;
  /** Données initiales du client (si fournies, c'est une modification) */
  initialData?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    siret?: string | null;
    vatIntra?: string | null;
  };
  /** Callback appelé après une création/modification réussie */
  onSuccess?: () => void;
}

/**
 * Composant Dialog pour créer ou modifier un client
 */
export function ClientDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: ClientDialogProps) {
  const isEditMode = !!initialData;

  // État du type de client (Particulier/Entreprise)
  const [clientType, setClientType] = useState<ClientType>("particulier");

  // États des champs du formulaire
  const [formData, setFormData] = useState<ClientData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    siret: "",
    vatIntra: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  /**
   * Réinitialise le formulaire et le type de client quand le dialog s'ouvre/ferme
   */
  useEffect(() => {
    if (open) {
      if (initialData) {
        // Mode édition : pré-remplir avec les données du client
        setFormData({
          name: initialData.name || "",
          email: initialData.email || "",
          phone: initialData.phone || "",
          address: initialData.address || "",
          siret: initialData.siret || "",
          vatIntra: initialData.vatIntra || "",
        });
        // Déterminer le type selon les données existantes
        // Si le client a un SIRET ou une TVA, c'est une entreprise, sinon particulier
        if (initialData.siret || initialData.vatIntra) {
          setClientType("entreprise");
        } else {
          setClientType("particulier");
        }
      } else {
        // Mode création : formulaire vide, par défaut "particulier"
        setFormData({
          name: "",
          email: "",
          phone: "",
          address: "",
          siret: "",
          vatIntra: "",
        });
        setClientType("particulier");
      }
    }
  }, [open, initialData]);

  /**
   * Gère le changement des champs du formulaire
   */
  const handleChange = (field: keyof ClientData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Gère le changement de type de client (Particulier/Entreprise)
   * Si on passe à "particulier", on vide les champs SIRET et TVA
   */
  const handleClientTypeChange = (type: ClientType) => {
    setClientType(type);
    if (type === "particulier") {
      // Nettoyer les champs spécifiques aux entreprises
      setFormData((prev) => ({
        ...prev,
        siret: "",
        vatIntra: "",
      }));
    }
  };

  /**
   * Gère la soumission du formulaire
   * Pour les particuliers, on ne sauvegarde pas SIRET/TVA même s'ils sont remplis
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validation
      if (!formData.name.trim()) {
        toast.error("Le nom du client est obligatoire");
        setIsLoading(false);
        return;
      }

      // Préparation des données à envoyer
      // Si c'est un particulier, on force undefined pour SIRET/TVA (sera transformé en null dans la DB)
      // Cela permet de convertir une entreprise en particulier en vidant ces champs
      const dataToSubmit: ClientData = {
        name: formData.name.trim(),
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        // Pour les entreprises : on envoie la valeur (ou undefined si vide)
        // Pour les particuliers : on force undefined pour s'assurer que les champs sont vidés en DB
        siret:
          clientType === "entreprise"
            ? formData.siret?.trim() || undefined
            : undefined,
        vatIntra:
          clientType === "entreprise"
            ? formData.vatIntra?.trim() || undefined
            : undefined,
      };

      // Appel de la Server Action
      await upsertClient(dataToSubmit, initialData?.id);

      toast.success(
        isEditMode
          ? "Client modifié avec succès"
          : "Client créé avec succès"
      );

      // Appeler le callback de succès pour mettre à jour la liste
      onSuccess?.();

      // Fermer le dialog (le formulaire sera réinitialisé via useEffect à la prochaine ouverture)
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du client:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue lors de la sauvegarde"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Modifier le client" : "Nouveau client"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Modifiez les informations du client"
                : "Ajoutez un nouveau client à votre base de données"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Sélecteur Particulier/Entreprise */}
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">
                Type de client
              </label>
              <Tabs
                value={clientType}
                onValueChange={(value) =>
                  handleClientTypeChange(value as ClientType)
                }
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="particulier">Particulier</TabsTrigger>
                  <TabsTrigger value="entreprise">Entreprise</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Nom */}
            <div className="grid gap-2">
              <label
                htmlFor="name"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {clientType === "entreprise"
                  ? "Nom de l'entreprise"
                  : "Nom complet"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                placeholder={
                  clientType === "entreprise"
                    ? "Ex: Acme Corporation"
                    : "Ex: Jean Dupont"
                }
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="contact@example.com"
                value={formData.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>

            {/* Téléphone */}
            <div className="grid gap-2">
              <label
                htmlFor="phone"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Téléphone
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                value={formData.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>

            {/* Adresse */}
            <div className="grid gap-2">
              <label
                htmlFor="address"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Adresse
              </label>
              <Input
                id="address"
                placeholder="123 Rue de la République, 75001 Paris"
                value={formData.address || ""}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </div>

            {/* Champs spécifiques aux entreprises */}
            {clientType === "entreprise" && (
              <>
                {/* SIRET */}
                <div className="grid gap-2">
                  <label
                    htmlFor="siret"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    SIRET
                  </label>
                  <Input
                    id="siret"
                    placeholder="12345678901234"
                    value={formData.siret || ""}
                    onChange={(e) => handleChange("siret", e.target.value)}
                    maxLength={14}
                  />
                </div>

                {/* TVA Intracommunautaire */}
                <div className="grid gap-2">
                  <label
                    htmlFor="vatIntra"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    TVA Intracommunautaire
                  </label>
                  <Input
                    id="vatIntra"
                    placeholder="FR12345678901"
                    value={formData.vatIntra || ""}
                    onChange={(e) => handleChange("vatIntra", e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Enregistrement..."
                : isEditMode
                  ? "Modifier"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

