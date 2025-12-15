"use server";

/**
 * Server Actions pour les Prévisions de Trésorerie (Cash Flow Forecast)
 * Calcule les projections de trésorerie sur 6 mois
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";

/**
 * Type pour un point de données de prévision
 */
export type ForecastDataPoint = {
  date: string; // Format: "Jan", "Fév", etc.
  solde: number; // Solde prévu en euros
  type: "real" | "projected"; // "real" pour le passé, "projected" pour le futur
  month: number; // Mois (0-11)
  year: number; // Année
};

/**
 * Type de retour de la Server Action
 */
export type CashFlowForecast = {
  forecastData: ForecastDataPoint[];
  currentBalance: number; // Solde actuel
  burnRate: number; // Dépenses moyennes mensuelles
  hasEnoughData: boolean; // Indique si on a assez de données pour une projection fiable
};

/**
 * Calcule les prévisions de trésorerie sur 6 mois
 *
 * Méthodologie :
 * 1. Burn Rate : Moyenne mensuelle des dépenses des 3 derniers mois
 * 2. Entrées futures : Factures SENT classées par mois selon dueDate
 * 3. Solde actuel : Somme totale Income - Expense depuis le début
 * 4. Projection : Pour chaque mois futur, Nouveau Solde = Ancien Solde - Burn Rate + Factures dues
 *
 * @returns {Promise<CashFlowForecast>} Données de prévision
 */
export async function getCashFlowForecast(): Promise<CashFlowForecast> {
  try {
    // Récupération de l'utilisateur connecté
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      console.warn("⚠️ Aucune company trouvée, retour de projection vide");
      return {
        forecastData: [],
        currentBalance: 0,
        burnRate: 0,
        hasEnoughData: false,
      };
    }

    const companyId = company.id;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Récupération des transactions des 3 derniers mois pour calculer le Burn Rate
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const lastThreeMonthsTransactions = await prisma.transaction.findMany({
      where: {
        companyId,
        date: {
          gte: threeMonthsAgo,
          lte: now,
        },
      },
    });

    // Calcul du Burn Rate (moyenne mensuelle des dépenses sur 3 mois)
    const monthlyExpenses: number[] = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59
      );

      const monthExpense = lastThreeMonthsTransactions
        .filter(
          (t) =>
            t.type === "EXPENSE" &&
            t.date >= monthStart &&
            t.date <= monthEnd
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);

      monthlyExpenses.push(Math.abs(monthExpense)); // Valeur absolue pour les dépenses
    }

    // Burn Rate = moyenne des dépenses mensuelles
    const burnRate =
      monthlyExpenses.length > 0
        ? monthlyExpenses.reduce((a, b) => a + b, 0) / monthlyExpenses.length
        : 0;

    // 2. Récupération des factures SENT (non payées) pour les entrées futures
    const sentInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: "SENT", // Factures envoyées mais pas encore payées
      },
      include: {
        rows: true, // Pour calculer le montant total
      },
    });

    // Calcul du montant total de chaque facture et classement par mois selon dueDate
    const invoicesByMonth = new Map<string, number>(); // Clé: "YYYY-MM", Valeur: montant total

    sentInvoices.forEach((invoice) => {
      if (invoice.dueDate) {
        const dueDate = new Date(invoice.dueDate);
        const monthKey = `${dueDate.getFullYear()}-${String(
          dueDate.getMonth() + 1
        ).padStart(2, "0")}`;

        // Calcul du montant TTC de la facture
        const invoiceTotal = invoice.rows.reduce((sum, row) => {
          const lineTotal = Number(row.quantity) * Number(row.unitPrice);
          const vatAmount = lineTotal * (Number(row.vatRate) / 100);
          return sum + lineTotal + vatAmount;
        }, 0);

        const existing = invoicesByMonth.get(monthKey) || 0;
        invoicesByMonth.set(monthKey, existing + invoiceTotal);
      }
    });

    // 3. Calcul du solde actuel (somme totale Income - Expense depuis le début)
    const allTransactions = await prisma.transaction.findMany({
      where: {
        companyId,
      },
    });

    const totalIncome = allTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = allTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const currentBalance = totalIncome - totalExpense;

    // 4. Construction des données de prévision
    const forecastData: ForecastDataPoint[] = [];
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

    // Ajout des 3 derniers mois (réels)
    for (let i = 2; i >= 0; i--) {
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

      // Calcul du solde réel pour ce mois
      const monthIncome = allTransactions
        .filter(
          (t) =>
            t.type === "INCOME" &&
            t.date >= monthStart &&
            t.date <= monthEnd
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const monthExpense = allTransactions
        .filter(
          (t) =>
            t.type === "EXPENSE" &&
            t.date >= monthStart &&
            t.date <= monthEnd
        )
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      // Solde cumulé jusqu'à ce mois
      const cumulativeIncome = allTransactions
        .filter(
          (t) => t.type === "INCOME" && t.date <= monthEnd
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const cumulativeExpense = allTransactions
        .filter(
          (t) => t.type === "EXPENSE" && t.date <= monthEnd
        )
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      const monthBalance = cumulativeIncome - cumulativeExpense;

      forecastData.push({
        date: monthNames[targetDate.getMonth()],
        solde: monthBalance,
        type: "real",
        month: targetDate.getMonth(),
        year: targetDate.getFullYear(),
      });
    }

    // Projection sur 6 mois futurs
    let projectedBalance = currentBalance;

    for (let i = 1; i <= 6; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = `${futureDate.getFullYear()}-${String(
        futureDate.getMonth() + 1
      ).padStart(2, "0")}`;

      // Factures dues ce mois
      const invoicesDueThisMonth = invoicesByMonth.get(monthKey) || 0;

      // Nouveau solde = Ancien solde - Burn Rate + Factures dues
      projectedBalance =
        projectedBalance - burnRate + invoicesDueThisMonth;

      forecastData.push({
        date: monthNames[futureDate.getMonth()],
        solde: Math.round(projectedBalance * 100) / 100, // Arrondi à 2 décimales
        type: "projected",
        month: futureDate.getMonth(),
        year: futureDate.getFullYear(),
      });
    }

    // Vérification si on a assez de données (au moins 2 mois de dépenses)
    const hasEnoughData = monthlyExpenses.length >= 2;

    console.log(
      `📊 Prévisions calculées : Solde actuel=${currentBalance}€, Burn Rate=${burnRate}€/mois, ${forecastData.length} points`
    );

    return {
      forecastData,
      currentBalance,
      burnRate,
      hasEnoughData,
    };
  } catch (error) {
    console.error("❌ Erreur lors du calcul des prévisions:", error);
    // Retourner des données par défaut au lieu de throw pour éviter de casser le dashboard
    return {
      forecastData: [],
      currentBalance: 0,
      burnRate: 0,
      hasEnoughData: false,
    };
  }
}
