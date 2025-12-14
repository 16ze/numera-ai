/**
 * Page des Transactions
 * Affiche la liste des transactions de l'utilisateur connecté
 */

import { getTransactions } from "../actions/transactions";
import Link from "next/link";
import { Receipt, Plus, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionCategory, TransactionType } from "@prisma/client";

/**
 * Fonction utilitaire pour formater le montant en euros
 */
function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Fonction utilitaire pour obtenir le label de la catégorie
 */
function getCategoryLabel(category: TransactionCategory): string {
  const labels: Record<TransactionCategory, string> = {
    TRANSPORT: "Transport",
    REPAS: "Repas",
    MATERIEL: "Matériel",
    PRESTATION: "Prestation",
    IMPOTS: "Impôts et taxes",
    SALAIRES: "Salaires",
    AUTRE: "Autre",
  };
  return labels[category] || category;
}

/**
 * Fonction utilitaire pour obtenir la couleur du badge selon le type
 */
function getTypeBadgeVariant(type: TransactionType): "default" | "secondary" | "outline" {
  return type === "INCOME" ? "default" : "secondary";
}

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
        <div className="flex gap-3">
          <Link href="/transactions/scan">
            <Button variant="outline">
              <Receipt className="mr-2 h-4 w-4" />
              Scanner un reçu
            </Button>
          </Link>
          <Link href="/transactions/import-pdf">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Importer un PDF
            </Button>
          </Link>
        </div>
      </div>

      {/* Tableau des transactions */}
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
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Date</TableHead>
                <TableHead className="min-w-[200px]">Description</TableHead>
                <TableHead className="min-w-[120px]">Catégorie</TableHead>
                <TableHead className="text-center min-w-[80px]">Type</TableHead>
                <TableHead className="text-right min-w-[100px]">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const formattedDate = new Date(transaction.date).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{formattedDate}</TableCell>
                    <TableCell>
                      {transaction.description || <span className="text-muted-foreground italic">Sans description</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(transaction.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getTypeBadgeVariant(transaction.type)}>
                        {transaction.type === "INCOME" ? "Recette" : "Dépense"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        transaction.type === "INCOME" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {formatMoney(transaction.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}


