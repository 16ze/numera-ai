"use client";

/**
 * Composant Dialog pour créer ou modifier un client
 *
 * Ce composant sert à la fois pour la création et la modification d'un client.
 * Il utilise le même formulaire, pré-rempli si c'est une modification.
 */

import { useState } from "react";
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
import { upsertClient, type ClientData } from "@/app/actions/clients";
import toast from "react-hot-toast";

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
    address?: string | null;
    siret?: string | null;
    vatIntra?: string | null;
  };
}

/**
 * Composant Dialog pour créer ou modifier un client
 */
export function ClientDialog({
  open,
  onOpenChange,
  initialData,
}: ClientDialogProps) {
  const isEditMode = !!initialData;

  // États des champs du formulaire
  const [formData, setFormData] = useState<ClientData>({
    name: initialData?.name || "",
    email: initialData?.email || "",
    address: initialData?.address || "",
    siret: initialData?.siret || "",
    vatIntra: initialData?.vatIntra || "",
  });

  const [isLoading, setIsLoading] = useState(false);

  /**
   * Gère le changement des champs du formulaire
   */
  const handleChange = (field: keyof ClientData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Réinitialise le formulaire quand le dialog s'ouvre/ferme
   */
  const resetForm = () => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email || "",
        address: initialData.address || "",
        siret: initialData.siret || "",
        vatIntra: initialData.vatIntra || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        address: "",
        siret: "",
        vatIntra: "",
      });
    }
  };

  /**
   * Gère la soumission du formulaire
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

      // Appel de la Server Action
      await upsertClient(formData, initialData?.id);

      toast.success(
        isEditMode
          ? "Client modifié avec succès"
          : "Client créé avec succès"
      );

      // Fermer le dialog et réinitialiser le formulaire
      onOpenChange(false);
      resetForm();
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

  // Réinitialiser le formulaire quand le dialog s'ouvre
  if (open && formData.name === "" && !initialData) {
    resetForm();
  }

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
            {/* Nom */}
            <div className="grid gap-2">
              <label
                htmlFor="name"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Nom <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                placeholder="Ex: Acme Corporation"
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
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
