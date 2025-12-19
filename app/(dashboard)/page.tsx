import { getDashboardData } from "@/app/(dashboard)/actions/dashboard";
import { DashboardClient } from "./DashboardClient";

/**
 * Page Dashboard avec mise à jour dynamique
 * Les données initiales sont chargées côté serveur, puis le composant client
 * permet la mise à jour automatique sans rechargement de page
 */
export default async function DashboardPage() {
  try {
    // Chargement initial des données côté serveur
    const initialData = await getDashboardData();

    return <DashboardClient initialData={initialData} />;
  } catch (error) {
    console.error("Erreur lors du chargement du dashboard:", error);

    // En cas d'erreur, retourner des données par défaut pour éviter le crash
    const fallbackData = {
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
      annualRevenue: 0,
      taxAmount: 0,
      netAvailable: 0,
      taxRate: 22.0,
      monthlyBudget: 0,
      budgetUsedPercent: 0,
      budgetRemaining: 0,
      recentTransactions: [],
      chartData: [],
      historyData: [],
      cashFlowForecast: {
        forecastData: [],
        currentBalance: 0,
        burnRate: 0,
        hasEnoughData: false,
      },
    };

    return <DashboardClient initialData={fallbackData} />;
  }
}
