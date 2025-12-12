"use client";

/**
 * Composant InvoiceActions
 * Permet de changer le statut d'une facture (Valider, Marquer comme payée, etc.)
 */

import { useState } from "react";
import { updateInvoiceStatus } from "@/app/(dashboard)/actions/invoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatus } from "@prisma/client";
import { CheckCircle2, DollarSign, RotateCcw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

/**
 * Props du composant InvoiceActions
 */
interface InvoiceActionsProps {
  /** ID de la facture */
  invoiceId: string;
  /** Statut actuel de la facture */
  currentStatus: InvoiceStatus;
}

/**
 * Composant pour gérer les actions sur une facture (changement de statut)
 */
export function InvoiceActions({
  invoiceId,
  currentStatus,
}: InvoiceActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Gère le changement de statut de la facture
   */
  const handleStatusChange = async (newStatus: "SENT" | "PAID" | "DRAFT") => {
    setIsLoading(true);

    try {
      await updateInvoiceStatus(invoiceId, newStatus);
      toast.success(
        newStatus === "SENT"
          ? "Facture validée et envoyée"
          : newStatus === "PAID"
            ? "Facture marquée comme payée"
            : "Facture remise en brouillon"
      );
      // Rafraîchir la page pour afficher le nouveau statut
      router.refresh();
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue lors du changement de statut"
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Retourne la configuration du badge selon le statut
   */
  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200">
            Brouillon
          </Badge>
        );
      case "SENT":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
            Envoyée
          </Badge>
        );
      case "PAID":
        return (
          <Badge className="bg-green-600 hover:bg-green-700 text-white">
            Payée
          </Badge>
        );
      case "OVERDUE":
        return (
          <Badge className="bg-red-600 hover:bg-red-700 text-white">
            En retard
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
            Annulée
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Badge du statut actuel */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Statut :</span>
        {getStatusBadge(currentStatus)}
      </div>

      {/* Boutons d'action selon le statut */}
      {currentStatus === "DRAFT" && (
        <Button
          onClick={() => handleStatusChange("SENT")}
          disabled={isLoading}
          size="sm"
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Valider la facture
        </Button>
      )}

      {currentStatus === "SENT" && (
        <Button
          onClick={() => handleStatusChange("PAID")}
          disabled={isLoading}
          size="sm"
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DollarSign className="h-4 w-4" />
          )}
          Marquer comme Payée
        </Button>
      )}

      {currentStatus === "PAID" && (
        <Button
          onClick={() => handleStatusChange("SENT")}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Remettre en attente
        </Button>
      )}

      {(currentStatus === "OVERDUE" || currentStatus === "CANCELLED") && (
        <p className="text-xs text-muted-foreground italic">
          Aucune action disponible pour ce statut
        </p>
      )}
    </div>
  );
}

