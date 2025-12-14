/**
 * Server Actions pour le Dashboard
 * Récupère les données financières pour l'utilisateur connecté via Clerk
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";

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
 * Type pour les données historiques mensuelles
 */
export type HistoryDataPoint = {
  name: string; // Format: "Jan", "Fév", etc.
  income: number;
  expense: number;
  net: number;
};

/**
 * Type de retour de la Server Action
 */
export type DashboardData = {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  annualRevenue: number;
  recentTransactions: RecentTransaction[];
  chartData: ChartDataPoint[];
  historyData: HistoryDataPoint[];
};

/**
 * Server Action pour récupérer les données du Dashboard
 * Utilise l'utilisateur authentifié via Clerk
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    // Récupération de l'utilisateur connecté via Clerk (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    // Récupération de la première company de l'utilisateur
    // Si l'utilisateur vient d'être créé, il aura déjà une company "Ma Société"
    const company = user.companies[0];

    // Protection : si pas de company (cas rare), on retourne des zéros
    if (!company) {
      console.warn(
        `⚠️ Utilisateur ${user.id} sans company, retour de données vides`
      );
      return {
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
        annualRevenue: 0,
        recentTransactions: [],
        chartData: [],
        historyData: [],
      };
    }

    // Calcul des dates pour le mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

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
    // Filtrage du CA selon les revenueKeywords si définis
    const revenueKeywords = company.revenueKeywords
      ? company.revenueKeywords.split(",").map((k) => k.trim().toUpperCase())
      : [];

    // Si des mots-clés sont définis, filtrer les transactions INCOME
    const revenueTransactions =
      revenueKeywords.length > 0
        ? monthlyTransactions.filter((t) => {
            if (t.type !== "INCOME") return false;
            if (!t.description) return false;
            const descriptionUpper = t.description.toUpperCase();
            return revenueKeywords.some((keyword) =>
              descriptionUpper.includes(keyword)
            );
          })
        : monthlyTransactions.filter((t) => t.type === "INCOME");

    const totalRevenue = revenueTransactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

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
    const chartDataMap = new Map<
      string,
      { recettes: number; depenses: number }
    >();

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
      const existing = chartDataMap.get(dateKey) || {
        recettes: 0,
        depenses: 0,
      };

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

    // Calcul du CA Annuel (du 1er janvier de l'année en cours à aujourd'hui)
    const startOfYear = new Date(now.getFullYear(), 0, 1); // 1er janvier
    const allAnnualTransactions = await prisma.transaction.findMany({
      where: {
        companyId: company.id,
        type: "INCOME",
        date: {
          gte: startOfYear,
          lte: now,
        },
      },
    });

    // Filtrage selon les revenueKeywords si définis
    const annualRevenueTransactions =
      revenueKeywords.length > 0
        ? allAnnualTransactions.filter((t) => {
            if (!t.description) return false;
            const descriptionUpper = t.description.toUpperCase();
            return revenueKeywords.some((keyword) =>
              descriptionUpper.includes(keyword)
            );
          })
        : allAnnualTransactions;

    const annualRevenue = annualRevenueTransactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    // Calcul de l'historique des 12 derniers mois
    const historyData: HistoryDataPoint[] = [];
    const monthNames = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Jun",
      "Jul",
      "Aoû",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];

    // Pour chaque mois des 12 derniers mois
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        1
      );
      const monthEnd = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      // Récupération des transactions du mois
      const monthTransactions = await prisma.transaction.findMany({
        where: {
          companyId: company.id,
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      // Filtrage des recettes selon les revenueKeywords si définis
      const monthIncomeTransactions =
        revenueKeywords.length > 0
          ? monthTransactions.filter((t) => {
              if (t.type !== "INCOME") return false;
              if (!t.description) return false;
              const descriptionUpper = t.description.toUpperCase();
              return revenueKeywords.some((keyword) =>
                descriptionUpper.includes(keyword)
              );
            })
          : monthTransactions.filter((t) => t.type === "INCOME");

      const monthIncome = monthIncomeTransactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );

      const monthExpense = monthTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const monthNet = monthIncome - monthExpense;

      historyData.push({
        name: monthNames[targetDate.getMonth()],
        income: monthIncome,
        expense: monthExpense,
        net: monthNet,
      });
    }

    return {
      totalRevenue,
      totalExpenses,
      netIncome,
      annualRevenue,
      recentTransactions,
      chartData,
      historyData,
    };
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des données du dashboard:",
      error
    );
    throw error;
  }
  // Note: On ne déconnecte pas Prisma Client en Next.js car il est réutilisé entre les requêtes
}
