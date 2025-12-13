"use client";

/**
 * Composant pour connecter un compte bancaire via Plaid Link
 */

import { useCallback, useState } from "react";
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
export function ConnectBankButton({ onSuccess }: ConnectBankButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Gère le succès de la connexion Plaid
   */
  const onSuccess = useCallback(
    async (publicToken: string) => {
      setIsLoading(true);
      try {
        await exchangePublicToken(publicToken);
        toast.success("Compte bancaire connecté avec succès !");
        onSuccess?.();
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
    [onSuccess]
  );

  /**
   * Configuration de Plaid Link
   */
  const config = {
    token: linkToken,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  /**
   * Initialise le Link Token et ouvre Plaid Link
   */
  const handleClick = async () => {
    if (!linkToken) {
      setIsLoading(true);
      try {
        const { linkToken: token } = await createLinkToken();
        setLinkToken(token);
        // Le useEffect ouvrira automatiquement Plaid Link
      } catch (error) {
        console.error("Erreur création Link Token:", error);
        toast.error("Erreur lors de l'initialisation");
        setIsLoading(false);
      }
    } else {
      open();
    }
  };

  // Ouvrir automatiquement Plaid Link quand le token est prêt
  if (linkToken && ready && !isLoading) {
    open();
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading || (linkToken !== null && !ready)}
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Connexion en cours...
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

