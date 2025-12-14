/**
 * Page des Transactions
 * Affiche la liste des transactions de l'utilisateur connecté avec gestion complète
 */

import { getTransactions } from "../actions/transactions";
import { TransactionsPageClient } from "./TransactionsPageClient";
import Link from "next/link";
import { Receipt, Plus, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Page des Transactions
 */
export default async function TransactionsPage() {
  // Récupération des transactions (redirige vers /sign-in si non connecté)
  const transactions = await getTransactions();

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes Transactions</h1>
          <p className="mt-2 text-muted-foreground">
            Gérez toutes vos transactions (recettes et dépenses)
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/transactions/scan">
            <Button variant="outline">
              <Receipt className="mr-2 h-4 w-4" />
              Scanner un reçu
            </Button>
          </Link>
          <Link href="/transactions/import-pdf">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Importer un PDF
            </Button>
          </Link>
          <Link href="/transactions/import-csv">
            <Button>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Importer un CSV
            </Button>
          </Link>
        </div>
      </div>

      {/* Tableau des transactions avec gestion complète */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Receipt className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2">Aucune transaction pour le moment</CardTitle>
            <CardDescription className="max-w-md mb-6">
              Commencez par scanner un reçu ou demandez à l&apos;IA d&apos;ajouter une transaction.
            </CardDescription>
            <Link href="/transactions/scan">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Scanner un reçu
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <TransactionsPageClient initialTransactions={transactions} />
      )}
    </div>
  );
}


