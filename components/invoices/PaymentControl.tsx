"use client";

/**
 * Composant de contrôle pour la génération et la gestion des liens de paiement Stripe
 * Permet au vendeur de générer, voir et copier le lien pour l'envoyer à son client
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generatePaymentLink } from "@/app/actions/payments";
import { Link2, Copy, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

interface PaymentControlProps {
  invoiceId: string;
  initialPaymentLink: string | null;
}

export function PaymentControl({
  invoiceId,
  initialPaymentLink,
}: PaymentControlProps) {
  const [paymentLink, setPaymentLink] = useState<string | null>(
    initialPaymentLink
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  /**
   * Génère un nouveau lien de paiement
   */
  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const result = await generatePaymentLink(invoiceId);
      setPaymentLink(result.paymentLink);
      toast.success("✅ Lien de paiement généré avec succès !");
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
   * Copie le lien dans le presse-papier
   */
  const handleCopyLink = async () => {
    if (!paymentLink) return;

    try {
      await navigator.clipboard.writeText(paymentLink);
      setIsCopied(true);
      toast.success("✅ Lien copié dans le presse-papier !");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Erreur copie presse-papier:", error);
      toast.error("Erreur lors de la copie du lien");
    }
  };

  /**
   * Ouvre le lien dans un nouvel onglet
   */
  const handleViewLink = () => {
    if (!paymentLink) return;
    window.open(paymentLink, "_blank", "noopener,noreferrer");
  };

  // État initial : Pas de lien généré
  if (!paymentLink) {
    return (
      <div className="w-full">
        <Button
          onClick={handleGenerateLink}
          disabled={isGenerating}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-5 w-5" />
              Générer le lien de paiement
            </>
          )}
        </Button>
        <p className="text-xs text-slate-500 mt-2 text-center">
          Générez un lien sécurisé que vous pourrez envoyer à votre client
        </p>
      </div>
    );
  }

  // État : Lien généré
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={paymentLink}
          readOnly
          className="flex-1 font-mono text-sm bg-slate-50 border-slate-200"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          onClick={handleCopyLink}
          variant="outline"
          size="icon"
          className="shrink-0"
          title={isCopied ? "Copié !" : "Copier le lien"}
        >
          {isCopied ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          onClick={handleViewLink}
          variant="outline"
          size="icon"
          className="shrink-0"
          title="Voir le lien dans un nouvel onglet"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>✅ Lien généré - Copiez-le pour l'envoyer à votre client</span>
        <Button
          onClick={handleGenerateLink}
          variant="ghost"
          size="sm"
          disabled={isGenerating}
          className="h-auto p-1 text-xs"
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Régénérer"
          )}
        </Button>
      </div>
    </div>
  );
}
