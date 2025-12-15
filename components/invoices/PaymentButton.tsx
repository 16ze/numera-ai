"use client";

/**
 * Composant pour générer et afficher le lien de paiement Stripe
 * Gère aussi le retour de paiement avec toast/confetti
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { generatePaymentLink, markInvoiceAsPaid } from "@/app/actions/payments";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface PaymentButtonProps {
  invoiceId: string;
  paymentLink: string | null;
  invoiceStatus: string;
}

export function PaymentButton({
  invoiceId,
  paymentLink,
  invoiceStatus,
}: PaymentButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get("status") === "success";

  // Gestion du retour de paiement réussi
  useEffect(() => {
    if (paymentSuccess && invoiceStatus !== "PAID") {
      // Afficher un toast de succès
      toast.success("🎉 Paiement réussi !", {
        duration: 5000,
        icon: "✅",
      });
    }
  }, [paymentSuccess, invoiceStatus]);

  /**
   * Génère un nouveau lien de paiement ou utilise l'existant
   */
  const handleGeneratePaymentLink = async () => {
    setIsGenerating(true);
    try {
      let link = paymentLink;

      // Si le lien n'existe pas, le générer
      if (!link) {
        const result = await generatePaymentLink(invoiceId);
        link = result.paymentLink;
      }

      if (link) {
        // Rediriger vers le lien Stripe
        window.location.href = link;
      } else {
        toast.error("Erreur lors de la génération du lien de paiement");
      }
    } catch (error) {
      console.error("Erreur génération lien paiement:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la génération du lien de paiement"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Marque la facture comme payée (appel manuel après confirmation)
   */
  const handleMarkAsPaid = async () => {
    if (
      !confirm(
        "Confirmez-vous que cette facture a bien été payée ? Cette action est irréversible."
      )
    ) {
      return;
    }

    setIsMarkingPaid(true);
    try {
      await markInvoiceAsPaid(invoiceId);
      toast.success("✅ Facture marquée comme payée !");
      router.refresh(); // Recharger la page pour mettre à jour le statut
    } catch (error) {
      console.error("Erreur marquage facture payée:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors du marquage de la facture"
      );
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Si la facture est déjà payée, ne pas afficher le bouton
  if (invoiceStatus === "PAID") {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-semibold">Facture payée</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bouton principal : Générer/Payer */}
      <Button
        onClick={handleGeneratePaymentLink}
        disabled={isGenerating}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Génération du lien...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" />
            {paymentLink ? "💳 Payer en ligne" : "Générer lien de paiement"}
          </>
        )}
      </Button>

      {/* Message de retour de paiement */}
      {paymentSuccess && invoiceStatus !== "PAID" && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900 mb-1">
                🎉 Paiement réussi !
              </p>
              <p className="text-sm text-green-700 mb-3">
                Le paiement a été effectué avec succès. Cliquez sur le bouton
                ci-dessous pour marquer la facture comme payée.
              </p>
              <Button
                onClick={handleMarkAsPaid}
                disabled={isMarkingPaid}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                {isMarkingPaid ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marquer comme payée
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
