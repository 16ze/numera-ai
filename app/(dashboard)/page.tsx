import { getDashboardData } from "@/app/(dashboard)/actions/dashboard";
import { DashboardClient } from "./DashboardClient";

/**
 * Page Dashboard avec mise à jour dynamique
 * Les données initiales sont chargées côté serveur, puis le composant client
 * permet la mise à jour automatique sans rechargement de page
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  try {
    // Extraction des paramètres de date depuis l'URL (Next.js 16: searchParams est une Promise)
    const params = await searchParams;
    const from = params?.from;
    const to = params?.to;

    // Chargement initial des données côté serveur avec les dates de l'URL
    const initialData = await getDashboardData(from, to);

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
      budgetAlertThreshold: 100.0,
      budgetUsedPercent: 0,
      budgetRemaining: 0,
      bankAccounts: [],
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
