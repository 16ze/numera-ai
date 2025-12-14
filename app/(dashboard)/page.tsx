import { getDashboardData } from "@/app/(dashboard)/actions/dashboard";
import { AdvisorCard } from "@/components/dashboard/AdvisorCard";
import { InteractiveCards } from "@/components/dashboard/InteractiveCards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

      {/* Cartes Interactives avec Dialog et graphiques */}
      <InteractiveCards
        totalRevenue={data.totalRevenue}
        totalExpenses={data.totalExpenses}
        netIncome={data.netIncome}
        annualRevenue={data.annualRevenue}
        historyData={data.historyData}
      />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        {/* 2. GRAPHIQUE - Responsive */}
        <div className="lg:col-span-4">
          <RevenueChart data={data.chartData} />
        </div>

        {/* 3. TRANSACTIONS RECENTES */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Transactions Récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Wrapper pour scroll horizontal sur mobile */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Description</TableHead>
                    <TableHead className="text-right min-w-[100px]">
                      Montant
                    </TableHead>
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
                          t.type === "INCOME"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {t.type === "INCOME" ? "+" : "-"}
                        {formatMoney(Number(t.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
