/**
 * Page de gestion des Intégrations externes
 * Permet de connecter Stripe, PayPal, etc.
 */

import { getIntegrations } from "@/app/actions/integrations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const integrations = await getIntegrations();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Intégrations</h1>
        <p className="mt-2 text-muted-foreground">
          Connectez vos services externes pour synchroniser automatiquement vos transactions
        </p>
      </div>

      <IntegrationsClient initialIntegrations={integrations} />
    </div>
  );
}
