"use client";

/**
 * Composant pour connecter un compte bancaire via Plaid Link
 */

import { useCallback, useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { createLinkToken, exchangePublicToken } from "@/app/actions/bank";
import { Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Props du composant
 */
interface ConnectBankButtonProps {
  onSuccess?: () => void;
}

/**
 * Bouton pour lancer le flow Plaid Link
 */
export function ConnectBankButton({ onSuccess: onSuccessCallback }: ConnectBankButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Gère le succès de la connexion Plaid
   */
  const handlePlaidSuccess = useCallback(
    async (publicToken: string) => {
      console.log("✅ Plaid Link succès, échange du token...");
      setIsLoading(true);
      try {
        await exchangePublicToken(publicToken);
        toast.success("Compte bancaire connecté avec succès !");
        onSuccessCallback?.();
      } catch (error) {
        console.error("Erreur échange token:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Erreur lors de la connexion"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccessCallback]
  );

  /**
   * Gère la fermeture de Plaid Link
   */
  const handleExit = useCallback(() => {
    console.log("Plaid Link fermé");
    setIsLoading(false);
  }, []);

  /**
   * Configuration de Plaid Link
   */
  const config = {
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handleExit,
  };

  const { open, ready, error } = usePlaidLink(config);

  /**
   * Log l'état de Plaid Link pour debugging
   */
  useEffect(() => {
    console.log("📊 État Plaid Link:", { 
      linkToken: linkToken ? "✓" : "✗", 
      ready, 
      isLoading,
      error: error?.message 
    });
  }, [linkToken, ready, isLoading, error]);

  /**
   * Ouvre automatiquement Plaid Link quand le token est prêt
   */
  useEffect(() => {
    if (linkToken && ready && !isLoading) {
      console.log("🚀 Tentative d'ouverture de Plaid Link...");
      try {
        open();
        console.log("✅ Plaid Link.open() appelé avec succès");
      } catch (err) {
        console.error("❌ Erreur lors de l'appel à open():", err);
        toast.error("Erreur lors de l'ouverture de Plaid Link");
        setIsLoading(false);
      }
    }
  }, [linkToken, ready, isLoading, open]);

  /**
   * Initialise le Link Token et ouvre Plaid Link
   */
  const handleClick = async () => {
    if (isLoading) return;

    console.log("🔗 Demande de Link Token...");
    setIsLoading(true);
    
    try {
      const { linkToken: token } = await createLinkToken();
      console.log("✅ Link Token reçu:", token.substring(0, 20) + "...");
      setLinkToken(token);
      // L'useEffect ouvrira automatiquement Plaid Link
    } catch (error) {
      console.error("❌ Erreur création Link Token:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'initialisation"
      );
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {linkToken ? "Ouverture..." : "Connexion en cours..."}
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          Connecter un compte bancaire
        </>
      )}
    </Button>
  );
}

