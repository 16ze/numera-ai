"use client";

/**
 * Composant Client pour la gestion des intégrations
 * Gère l'état et les interactions (connexion/déconnexion)
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectStripe, disconnectStripe, syncStripeTransactions } from "@/app/actions/integrations";
import type { IntegrationWithStatus } from "@/app/actions/integrations";
import { IntegrationProvider } from "@prisma/client";
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface IntegrationsClientProps {
  initialIntegrations: IntegrationWithStatus[];
}

export function IntegrationsClient({ initialIntegrations }: IntegrationsClientProps) {
  const [integrations, setIntegrations] = useState<IntegrationWithStatus[]>(initialIntegrations);
  const [stripeApiKey, setStripeApiKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const stripeIntegration = integrations.find(
    (i) => i.provider === IntegrationProvider.STRIPE
  );

  /**
   * Gère la connexion à Stripe
   */
  const handleConnectStripe = async () => {
    if (!stripeApiKey.trim()) {
      toast.error("Veuillez entrer une clé API Stripe");
      return;
    }

    setIsConnecting(true);
    try {
      await connectStripe(stripeApiKey.trim());
      toast.success("Stripe connecté avec succès !");
      setStripeApiKey("");
      
      // Recharger les intégrations
      const response = await fetch("/api/integrations");
      if (response.ok) {
        const updatedIntegrations = await response.json();
        setIntegrations(updatedIntegrations);
      }
    } catch (error) {
      console.error("Erreur connexion Stripe:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la connexion à Stripe"
      );
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Gère la déconnexion de Stripe
   */
  const handleDisconnectStripe = async () => {
    if (!confirm("Êtes-vous sûr de vouloir déconnecter Stripe ?")) {
      return;
    }

    setIsDisconnecting(true);
    try {
      await disconnectStripe();
      toast.success("Stripe déconnecté");
      
      // Recharger les intégrations
      const response = await fetch("/api/integrations");
      if (response.ok) {
        const updatedIntegrations = await response.json();
        setIntegrations(updatedIntegrations);
      }
    } catch (error) {
      console.error("Erreur déconnexion Stripe:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la déconnexion"
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  /**
   * Gère la synchronisation des transactions Stripe
   */
  const handleSyncStripe = async () => {
    setIsSyncing(true);
    try {
      const result = await syncStripeTransactions();
      toast.success(
        `Synchronisation réussie : ${result.syncedCount} transaction(s) importée(s)`
      );
    } catch (error) {
      console.error("Erreur synchronisation Stripe:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la synchronisation"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Carte Stripe */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">💳</span>
                Stripe
              </CardTitle>
              <CardDescription>
                Connectez votre compte Stripe pour importer automatiquement vos transactions
              </CardDescription>
            </div>
            {stripeIntegration && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Connecté</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stripeIntegration ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="stripe-api-key">Clé API Stripe (Restricted Key)</Label>
                <Input
                  id="stripe-api-key"
                  type="password"
                  placeholder="sk_live_... ou sk_test_..."
                  value={stripeApiKey}
                  onChange={(e) => setStripeApiKey(e.target.value)}
                  disabled={isConnecting}
                />
                <p className="text-xs text-muted-foreground">
                  Utilisez une Restricted Key avec les permissions : balance:read, charges:read
                </p>
              </div>
              <Button
                onClick={handleConnectStripe}
                disabled={isConnecting || !stripeApiKey.trim()}
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Connecter Stripe"
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Stripe est connecté</span>
                </div>
                {stripeIntegration.accountId && (
                  <p className="text-sm text-green-700 mt-1">
                    Account ID: {stripeIntegration.accountId}
                  </p>
                )}
                {stripeIntegration.lastSyncedAt && (
                  <p className="text-sm text-green-700 mt-1">
                    Dernière synchronisation:{" "}
                    {new Date(stripeIntegration.lastSyncedAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSyncStripe}
                  disabled={isSyncing}
                  variant="default"
                  className="flex-1"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Synchronisation...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Synchroniser Stripe
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDisconnectStripe}
                  disabled={isDisconnecting}
                  variant="outline"
                  className="flex-1"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Déconnexion...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Déconnecter
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Note informative */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-800">
            <strong>💡 Astuce :</strong> Pour créer une Restricted Key Stripe, allez dans{" "}
            <a
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-900"
            >
              Stripe Dashboard → Developers → API keys
            </a>
            . Créez une Restricted Key avec les permissions : <code className="bg-blue-100 px-1 rounded">balance:read</code> et <code className="bg-blue-100 px-1 rounded">charges:read</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
