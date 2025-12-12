import { getDashboardData } from "@/app/(dashboard)/actions/dashboard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { AdvisorCard } from "@/components/dashboard/AdvisorCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Euro, TrendingDown, Wallet } from "lucide-react";

export default async function DashboardPage() {
  const data = await getDashboardData();

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="flex-1 space-y-4 p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Tableau de bord</h2>
      </div>

      {/* Carte Conseil du CFO */}
      <AdvisorCard />

      {/* 1. KPI CARDS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Chiffre d'Affaires
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatMoney(data.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">Ce mois-ci</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatMoney(data.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">Ce mois-ci</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Résultat Net</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                data.netIncome >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatMoney(data.netIncome)}
            </div>
            <p className="text-xs text-muted-foreground">Bénéfice estimé</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* 2. GRAPHIQUE */}
        <div className="col-span-4">
          <RevenueChart data={data.chartData} />
        </div>

        {/* 3. TRANSACTIONS RECENTES */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Transactions Récentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.date).toLocaleDateString("fr-FR")}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        t.type === "INCOME" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {t.type === "INCOME" ? "+" : "-"}
                      {formatMoney(Number(t.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
