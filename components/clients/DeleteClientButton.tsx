"use client";

/**
 * Composant bouton de suppression de client
 *
 * Retourne un DropdownMenuItem pour supprimer un client.
 * Gère la confirmation et l'affichage des erreurs.
 */

import { useState } from "react";
import { deleteClient } from "@/app/actions/clients";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Props du composant DeleteClientButton
 */
interface DeleteClientButtonProps {
  /** ID du client à supprimer */
  clientId: string;
  /** Nom du client (pour le message de confirmation) */
  clientName: string;
  /** Fonction appelée après suppression réussie */
  onDeleted?: () => void;
}

/**
 * Composant bouton de suppression de client
 * Retourne les éléments du menu (séparateur + item) à intégrer dans un DropdownMenu
 */
export function DeleteClientButton({
  clientId,
  clientName,
  onDeleted,
}: DeleteClientButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Gère la suppression du client
   */
  const handleDelete = async () => {
    // Confirmation
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer le client "${clientName}" ?\n\nCette action est irréversible.`
      )
    ) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteClient(clientId);
      toast.success(`Client "${clientName}" supprimé avec succès`);
      onDeleted?.(); // Recharger la liste
    } catch (error) {
      console.error("Erreur lors de la suppression du client:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue lors de la suppression"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-red-600 focus:text-red-600"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {isDeleting ? "Suppression..." : "Supprimer"}
      </DropdownMenuItem>
    </>
  );
}
