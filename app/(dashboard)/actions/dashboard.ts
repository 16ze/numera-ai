/**
 * Server Actions pour le Dashboard
 * Récupère les données financières pour l'utilisateur connecté via Clerk
 */

import {
  getCashFlowForecast,
  type CashFlowForecast,
} from "@/app/actions/forecast";
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
 * Type pour un compte bancaire
 */
export type BankAccountData = {
  id: string;
  bankName: string;
  mask: string | null;
  currentBalance: number | null;
  currency: string;
};

/**
 * Type de retour de la Server Action
 */
export type DashboardData = {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  annualRevenue: number;
  taxAmount: number; // Montant des taxes estimées (CA * taxRate / 100)
  netAvailable: number; // Trésorerie réelle disponible après provisions taxes (CA - taxAmount)
  taxRate: number; // Taux de taxes configuré
  monthlyBudget: number; // Budget mensuel défini par l'utilisateur
  budgetAlertThreshold: number; // Seuil d'alerte : montant 'Reste à dépenser' minimum avant alerte rouge
  budgetUsedPercent: number; // Pourcentage du budget utilisé (totalExpenses / monthlyBudget) * 100
  budgetRemaining: number; // Reste disponible : monthlyBudget - totalExpenses
  bankAccounts: BankAccountData[]; // Liste des comptes bancaires connectés
  recentTransactions: RecentTransaction[];
  chartData: ChartDataPoint[];
  historyData: HistoryDataPoint[];
  cashFlowForecast: CashFlowForecast; // Prévisions de trésorerie
};

/**
 * Server Action pour récupérer les données du Dashboard
 * Utilise l'utilisateur authentifié via Clerk
 * @param from - Date de début (format YYYY-MM-DD) - optionnel
 * @param to - Date de fin (format YYYY-MM-DD) - optionnel
 */
export async function getDashboardData(
  from?: string,
  to?: string
): Promise<DashboardData> {
  try {
    // Récupération de l'utilisateur connecté via Clerk (redirige vers /sign-in si non connecté)
    let user;
    try {
      user = await getCurrentUser();
    } catch (authError) {
      // Vérifier si l'erreur vient du fait que le champ monthlyBudget n'existe pas encore
      const errorMessage =
        authError instanceof Error ? authError.message : String(authError);
      if (
        errorMessage.includes("monthlyBudget") ||
        errorMessage.includes("Migration requise")
      ) {
        console.error(
          "⚠️ Migration Prisma requise pour le champ 'monthlyBudget'. " +
            "Retour de données par défaut."
        );
        // Retourner des données par défaut si la migration n'a pas été appliquée
        return {
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
      }
      // Relancer l'erreur si ce n'est pas lié à monthlyBudget
      throw authError;
    }

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
        taxAmount: 0,
        netAvailable: 0,
        taxRate: 22.0,
        monthlyBudget: 0,
        budgetAlertThreshold: 100.0,
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
    }

    // Calcul des dates selon les paramètres fournis ou le mois en cours par défaut
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (from && to) {
      // Utiliser les dates fournies dans l'URL
      startDate = new Date(from + "T00:00:00.000Z");
      endDate = new Date(to + "T23:59:59.999Z");
      console.log(`📅 Période personnalisée : ${from} au ${to}`);
    } else {
      // Par défaut : mois en cours
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      console.log(
        `📅 Période par défaut : mois en cours (${startDate.toLocaleDateString()} au ${endDate.toLocaleDateString()})`
      );
    }

    // Validation des dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn("⚠️ Dates invalides, utilisation du mois en cours");
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Calcul des dates pour le graphique (période sélectionnée ou 30 derniers jours)
    const chartStartDate = from && to ? startDate : new Date(now);
    if (!from || !to) {
      chartStartDate.setDate(chartStartDate.getDate() - 30);
    }
    const chartEndDate = from && to ? endDate : now;

    // Récupération des transactions de la période sélectionnée
    const monthlyTransactions = await prisma.transaction.findMany({
      where: {
        companyId: company.id,
        date: {
          gte: startDate,
          lte: endDate,
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

    // Calcul des taxes et de la trésorerie réelle disponible
    const taxRate = company.taxRate ?? 22.0; // Par défaut 22%
    const taxAmount = (totalRevenue * taxRate) / 100;
    const netAvailable = totalRevenue - taxAmount;

    // Calcul du budget mensuel et des métriques associées
    // Gestion robuste des champs qui pourraient ne pas exister si la migration n'a pas été appliquée
    const monthlyBudget = (company as any).monthlyBudget ?? 0;
    const budgetAlertThreshold = (company as any).budgetAlertThreshold ?? 100.0;
    const budgetUsedPercent =
      monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;
    const budgetRemaining = monthlyBudget - totalExpenses;

    // Récupération des 5 dernières transactions de la période sélectionnée
    const recentTransactionsData = await prisma.transaction.findMany({
      where: {
        companyId: company.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
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

    // Récupération des transactions de la période pour le graphique
    const chartTransactions = await prisma.transaction.findMany({
      where: {
        companyId: company.id,
        date: {
          gte: chartStartDate,
          lte: chartEndDate,
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

    // Initialisation de tous les jours de la période avec 0
    const daysDiff = Math.ceil(
      (chartEndDate.getTime() - chartStartDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const daysToShow = Math.max(1, Math.min(daysDiff, 90)); // Limiter à 90 jours max pour les performances

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(chartStartDate);
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

    // Récupération des comptes bancaires connectés
    // Gestion robuste des champs qui pourraient ne pas exister si la migration n'a pas été appliquée
    let bankAccounts: BankAccountData[] = [];
    try {
      const bankAccountsData = await prisma.bankAccount.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          bankName: true,
          mask: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Récupération des champs optionnels avec gestion d'erreur
      bankAccounts = bankAccountsData.map((acc) => {
        const account = acc as any;
        return {
          id: account.id,
          bankName: account.bankName,
          mask: account.mask,
          currentBalance: account.currentBalance ?? null,
          currency: account.currency ?? "EUR",
        };
      });
    } catch (error) {
      console.warn(
        "⚠️ Erreur lors de la récupération des comptes bancaires:",
        error
      );
      // Retourner un tableau vide si erreur
      bankAccounts = [];
    }

    // Récupération des prévisions de trésorerie
    // Récupération des prévisions de trésorerie (avec gestion d'erreur pour éviter de casser le dashboard)
    let cashFlowForecast: CashFlowForecast;
    try {
      cashFlowForecast = await getCashFlowForecast();
    } catch (forecastError) {
      console.error(
        "Erreur lors de la récupération des prévisions:",
        forecastError
      );
      // On retourne des données vides pour les prévisions plutôt que de faire échouer tout le dashboard
      cashFlowForecast = {
        forecastData: [],
        currentBalance: 0,
        burnRate: 0,
        hasEnoughData: false,
      };
    }

    return {
      totalRevenue,
      totalExpenses,
      netIncome,
      bankAccounts,
      annualRevenue,
      taxAmount,
      netAvailable,
      taxRate,
      monthlyBudget,
      budgetAlertThreshold,
      budgetUsedPercent,
      budgetRemaining,
      recentTransactions,
      chartData,
      historyData,
      cashFlowForecast,
    };
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des données du dashboard:",
      error
    );
    // Au lieu de throw, on retourne des données par défaut pour éviter le 500
    return {
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
  }
  // Note: On ne déconnecte pas Prisma Client en Next.js car il est réutilisé entre les requêtes
}
