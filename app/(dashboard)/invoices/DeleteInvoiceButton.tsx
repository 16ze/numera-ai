"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteInvoice } from "../actions/invoices";

/**
 * Composant client pour le bouton de suppression de facture
 * Inclut une confirmation avant suppression
 */
export function DeleteInvoiceButton({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    // Confirmation avant suppression
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer la facture ${invoiceNumber} ?\n\nCette action est irréversible.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteInvoice(invoiceId);
      // Recharger la page pour mettre à jour la liste
      router.refresh();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert(error instanceof Error ? error.message : "Erreur lors de la suppression de la facture");
      setIsDeleting(false);
    }
  };

  return (
    <Button
      onClick={handleDelete}
      disabled={isDeleting}
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
      title={`Supprimer la facture ${invoiceNumber}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}


