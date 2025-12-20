"use client";

/**
 * Composant Client pour le Dashboard
 * Permet la mise à jour dynamique des données sans rechargement de page
 */

import type { DashboardData } from "@/app/(dashboard)/actions/dashboard";
import { AdvisorCard } from "@/components/dashboard/AdvisorCard";
import { BankBalanceCard } from "@/components/dashboard/BankBalanceCard";
import { BudgetCard } from "@/components/dashboard/BudgetCard";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { InteractiveCards } from "@/components/dashboard/InteractiveCards";
import { OverdueAlerts } from "@/components/dashboard/OverdueAlerts";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { TaxRadarCard } from "@/components/dashboard/TaxRadarCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface DashboardClientProps {
  initialData: DashboardData;
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const searchParams = useSearchParams();

  /**
   * Rafraîchit les données du Dashboard
   */
  const refreshData = async () => {
    try {
      setIsRefreshing(true);
      // Inclure les paramètres de date dans la requête
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      const url = new URL("/api/dashboard-data", window.location.origin);
      if (from) url.searchParams.set("from", from);
      if (to) url.searchParams.set("to", to);

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });
      if (response.ok) {
        const newData = await response.json();
        setData(newData);
      }
    } catch (error) {
      console.error("Erreur lors du rafraîchissement:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Rafraîchir automatiquement quand les paramètres de date changent
  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  /**
   * Écoute les changements et rafraîchit automatiquement le Dashboard
   */
  useEffect(() => {
    // Fonction de rafraîchissement
    const triggerRefresh = (source: string) => {
      console.log(`🔄 Rafraîchissement Dashboard déclenché par: ${source}`);
      refreshData();
    };

    // Méthode 1: BroadcastChannel pour communication inter-composants
    let channel: BroadcastChannel | null = null;
    const handleBroadcastMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "transaction-added" ||
        event.data?.type === "transaction-updated"
      ) {
        triggerRefresh("BroadcastChannel");
      }
    };

    try {
      channel = new BroadcastChannel("dashboard-updates");
      channel.addEventListener("message", handleBroadcastMessage);
    } catch (err) {
      console.warn("⚠️ BroadcastChannel non disponible:", err);
    }

    // Méthode 2: window.postMessage (fallback)
    const handlePostMessage = (event: MessageEvent) => {
      // Vérifier que le message vient de notre application (sécurité)
      if (
        event.data?.source === "ai-chat" &&
        (event.data?.type === "transaction-added" ||
          event.data?.type === "transaction-updated")
      ) {
        triggerRefresh("postMessage");
      }
    };
    window.addEventListener("message", handlePostMessage);

    // Méthode 3: Événement personnalisé
    const handleCustomEvent = (event: CustomEvent) => {
      if (
        event.detail?.type === "transaction-added" ||
        event.detail?.type === "transaction-updated"
      ) {
        triggerRefresh("CustomEvent");
      }
    };
    window.addEventListener(
      "dashboard-refresh",
      handleCustomEvent as EventListener
    );

    // Rafraîchir quand la page redevient visible (utilisateur revient sur l'onglet)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshData();
      }
    };

    // Rafraîchir quand la fenêtre reprend le focus
    const handleFocus = () => {
      refreshData();
    };

    // Polling réduit à 3 secondes pour vérifier les mises à jour plus rapidement
    const interval = setInterval(() => {
      refreshData();
    }, 3000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      // Nettoyer BroadcastChannel
      if (channel) {
        channel.removeEventListener("message", handleBroadcastMessage);
        channel.close();
      }
      // Nettoyer postMessage
      window.removeEventListener("message", handlePostMessage);
      // Nettoyer CustomEvent
      window.removeEventListener(
        "dashboard-refresh",
        handleCustomEvent as EventListener
      );
      // Nettoyer visibility et focus
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      // Nettoyer interval
      clearInterval(interval);
    };
  }, [refreshData, searchParams]);

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
        {isRefreshing && (
          <span className="text-sm text-muted-foreground">
            Actualisation...
          </span>
        )}
      </div>

      {/* Carte Conseil du CFO */}
      <AdvisorCard />

      {/* Alertes Factures en Retard - Le Bad Cop */}
      <OverdueAlerts />

      {/* Filtre de date */}
      <div className="flex items-center justify-end">
        <DateRangePicker />
      </div>

      {/* Cartes Interactives avec Dialog et graphiques */}
      <InteractiveCards
        totalRevenue={data.totalRevenue}
        totalExpenses={data.totalExpenses}
        netIncome={data.netIncome}
        annualRevenue={data.annualRevenue}
        historyData={data.historyData}
      />

      {/* Carte Radar à Taxes, Budget Mensuel et Soldes Bancaires - Côte à côte */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <TaxRadarCard
          netAvailable={data.netAvailable}
          taxAmount={data.taxAmount}
          taxRate={data.taxRate}
        />
        <BudgetCard
          totalExpenses={data.totalExpenses}
          monthlyBudget={data.monthlyBudget}
          budgetAlertThreshold={data.budgetAlertThreshold}
          budgetRemaining={data.budgetRemaining}
        />
        <BankBalanceCard bankAccounts={data.bankAccounts} />
      </div>

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

      {/* Prévisions de Trésorerie - Cash Flow Forecast */}
      <CashFlowChart
        forecastData={data.cashFlowForecast.forecastData}
        currentBalance={data.cashFlowForecast.currentBalance}
        burnRate={data.cashFlowForecast.burnRate}
        hasEnoughData={data.cashFlowForecast.hasEnoughData}
      />
    </div>
  );
}
