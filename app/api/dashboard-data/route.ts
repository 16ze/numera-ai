import { getDashboardData } from "@/app/(dashboard)/actions/dashboard";
import { NextResponse } from "next/server";

/**
 * Route API pour récupérer les données du Dashboard
 * Permet la mise à jour dynamique sans rechargement de page
 *
 * Note: L'authentification est gérée par getDashboardData() via getCurrentUser()
 */
export async function GET() {
  try {
    const data = await getDashboardData();

    // Headers pour éviter le cache côté client
    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des données du dashboard:",
      error
    );

    // Vérifier si l'erreur vient du fait que le champ monthlyBudget n'existe pas encore
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("monthlyBudget") ||
      errorMessage.includes("Unknown argument") ||
      errorMessage.includes("Unknown field")
    ) {
      console.error(
        "⚠️ Le champ 'monthlyBudget' n'existe pas encore dans la base de données. " +
          "Migration requise : npx prisma db push"
      );
      // Retourner des données par défaut pour éviter le crash
      return NextResponse.json({
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
      });
    }

    return NextResponse.json(
      { error: "Erreur lors de la récupération des données" },
      { status: 500 }
    );
  }
}
