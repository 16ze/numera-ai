/**
 * Page Dashboard - Vue d'ensemble financière
 * Affiche les KPIs, graphiques et transactions récentes
 */

import { getDashboardData } from "@/app/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

/**
 * Formatage monétaire en EUR (format français)
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Formatage de date (format français)
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Obtention du label de catégorie en français
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    TRANSPORT: "Transport",
    REPAS: "Repas",
    MATERIEL: "Matériel",
    PRESTATION: "Prestation",
    IMPOTS: "Impôts",
    SALAIRES: "Salaires",
    AUTRE: "Autre",
  };
  return labels[category] || category;
}

/**
 * Composant principal de la page Dashboard
 */
export default async function DashboardPage() {
  // Récupération des données via Server Action
  const data = await getDashboardData();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Vue d'ensemble de votre activité financière
          </p>
        </div>

        {/* Cartes KPI */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Chiffre d'affaires */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Chiffre d'affaires
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ce mois
              </p>
            </CardContent>
          </Card>

          {/* Dépenses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dépenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ce mois
              </p>
            </CardContent>
          </Card>

          {/* Résultat net */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Résultat net</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  data.netIncome >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(data.netIncome)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.netIncome >= 0 ? "Bénéfice" : "Déficit"} ce mois
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Graphique Recettes vs Dépenses */}
        <Card>
          <CardHeader>
            <CardTitle>Recettes vs Dépenses (30 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return formatDate(date);
                  }}
                />
                <Legend />
                <Bar
                  dataKey="recettes"
                  fill="#22c55e"
                  name="Recettes"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="depenses"
                  fill="#ef4444"
                  name="Dépenses"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tableau des transactions récentes */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions récentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucune transaction
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {formatDate(transaction.date)}
                      </TableCell>
                      <TableCell>
                        {transaction.description || "Sans description"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCategoryLabel(transaction.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.type === "INCOME"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {transaction.type === "INCOME" ? "Recette" : "Dépense"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.status === "COMPLETED"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {transaction.status === "COMPLETED"
                            ? "Complétée"
                            : "En attente"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          transaction.type === "INCOME"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
