/**
 * Page de gestion des comptes bancaires connectés via Plaid
 * Permet de connecter un compte bancaire et de synchroniser les transactions
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { getBankAccounts } from "@/app/actions/bank";
import { BankAccountsClient } from "./BankAccountsClient";
import { PlaidNotConfigured } from "@/components/bank/PlaidNotConfigured";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default async function BankAccountsPage() {
  // Vérifier si Plaid est configuré
  const isPlaidConfigured = 
    process.env.PLAID_CLIENT_ID && 
    process.env.PLAID_SECRET;

  // Si Plaid n'est pas configuré, afficher la page d'aide
  if (!isPlaidConfigured) {
    return <PlaidNotConfigured />;
  }

  // Récupération de l'utilisateur connecté
  const user = await getCurrentUser();

  // Récupération des comptes bancaires
  const bankAccounts = await getBankAccounts();

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-green-100">
            <Building2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Connexion Bancaire
            </h1>
            <p className="text-slate-600 mt-1">
              Connectez vos comptes bancaires pour synchroniser automatiquement vos transactions
            </p>
          </div>
        </div>
      </div>

      {/* Composant client pour gérer les comptes */}
      <BankAccountsClient initialBankAccounts={bankAccounts} />

      {/* Note informative */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-900 font-medium mb-1">
                Sécurité et confidentialité
              </p>
              <p className="text-sm text-blue-700">
                Vos données bancaires sont sécurisées par Plaid, certifié par les plus grandes banques.
                Nous n&apos;avons jamais accès à vos identifiants bancaires.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

