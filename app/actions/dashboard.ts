/**
 * Server Actions pour le Dashboard
 * Récupère les données financières pour l'utilisateur connecté via Clerk
 */

import { prisma } from "@/app/lib/prisma";
import { getAuthUser } from "@/app/lib/auth-helper";

/**
 * Type pour les données du graphique
 */
export type ChartDataPoint = {
  date: string; // Format: "YYYY-MM-DD"
  recettes: number;
  depenses: number;
};

/**
 * Type pour une transaction récente
 */
export type RecentTransaction = {
  id: string;
  date: Date;
  amount: number;
  description: string | null;
  type: "INCOME" | "EXPENSE";
  category: string;
  status: "PENDING" | "COMPLETED";
};

/**
 * Type de retour de la Server Action
 */
export type DashboardData = {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  recentTransactions: RecentTransaction[];
  chartData: ChartDataPoint[];
};

/**
 * Server Action pour récupérer les données du Dashboard
 * Utilise l'utilisateur authentifié via Clerk
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    // Récupération de l'utilisateur connecté via Clerk
    const { company } = await getAuthUser();

    // Calcul des dates pour le mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Calcul des dates pour les 30 derniers jours (pour le graphique)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Récupération des transactions du mois en cours
    const monthlyTransactions = await prisma.transaction.findMany({
      where: {
        companyId: company.id,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Calcul des totaux du mois en cours
    const totalRevenue = monthlyTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = monthlyTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netIncome = totalRevenue - totalExpenses;

    // Récupération des 5 dernières transactions (toutes périodes confondues)
    const recentTransactionsData = await prisma.transaction.findMany({
      where: {
        companyId: company.id,
      },
      orderBy: {
        date: "desc",
      },
      take: 5,
    });

    const recentTransactions: RecentTransaction[] = recentTransactionsData.map(
      (t) => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount),
        description: t.description,
        type: t.type,
        category: t.category,
        status: t.status,
      })
    );

    // Récupération des transactions des 30 derniers jours pour le graphique
    const chartTransactions = await prisma.transaction.findMany({
      where: {
        companyId: company.id,
        date: {
          gte: thirtyDaysAgo,
          lte: now,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    // Préparation des données pour le graphique (groupées par jour)
    const chartDataMap = new Map<string, { recettes: number; depenses: number }>();

    // Initialisation de tous les jours des 30 derniers jours avec 0
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];
      chartDataMap.set(dateKey, { recettes: 0, depenses: 0 });
    }

    // Agrégation des transactions par jour
    chartTransactions.forEach((transaction) => {
      const dateKey = transaction.date.toISOString().split("T")[0];
      const existing = chartDataMap.get(dateKey) || { recettes: 0, depenses: 0 };

      if (transaction.type === "INCOME") {
        existing.recettes += Number(transaction.amount);
      } else {
        existing.depenses += Number(transaction.amount);
      }

      chartDataMap.set(dateKey, existing);
    });

    // Conversion en tableau trié
    const chartData: ChartDataPoint[] = Array.from(chartDataMap.entries())
      .map(([date, values]) => ({
        date,
        recettes: values.recettes,
        depenses: values.depenses,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenue,
      totalExpenses,
      netIncome,
      recentTransactions,
      chartData,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des données du dashboard:", error);
    throw error;
  }
  // Note: On ne déconnecte pas Prisma Client en Next.js car il est réutilisé entre les requêtes
}

