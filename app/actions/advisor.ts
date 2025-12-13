"use server";

/**
 * Server Action pour obtenir des conseils financiers intelligents via OpenAI
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

/**
 * Obtient un conseil financier personnalisé basé sur les données de l'entreprise
 * Utilise OpenAI GPT-4o pour analyser les statistiques et donner un conseil stratégique
 *
 * @returns {Promise<string>} Le conseil généré par l'IA
 * @throws {Error} Si l'utilisateur n'est pas connecté ou en cas d'erreur
 */
export async function getFinancialAdvice(): Promise<string> {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    // 2. Calcul de la période du mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 3. Récupération des statistiques du mois en cours
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { date: "desc" },
    });

    // Calcul du CA et des dépenses
    const income = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netResult = income - expenses;

    // 4. Récupération des 5 dernières transactions pour le contexte
    const recentTransactions = await prisma.transaction.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: 5,
    });

    // 5. Récupération du nombre de factures et leur statut
    const invoices = await prisma.invoice.findMany({
      where: { companyId },
      select: { status: true },
    });

    const invoiceStats = {
      total: invoices.length,
      draft: invoices.filter((i) => i.status === "DRAFT").length,
      sent: invoices.filter((i) => i.status === "SENT").length,
      paid: invoices.filter((i) => i.status === "PAID").length,
    };

    // 6. Préparation des données pour l'IA
    const monthName = startOfMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    
    const recentTransactionsText = recentTransactions
      .map((t) => {
        const date = t.date.toLocaleDateString("fr-FR");
        const type = t.type === "INCOME" ? "Recette" : "Dépense";
        return `- ${date}: ${type} de ${t.amount}€ (${t.description})`;
      })
      .join("\n");

    // 7. Génération du conseil via OpenAI
    const prompt = `Tu es le CFO virtuel d'une petite entreprise. Analyse ces données financières de ${monthName} et donne UN SEUL conseil court, percutant et stratégique (maximum 2 phrases).

📊 DONNÉES FINANCIÈRES :
- Chiffre d'affaires : ${income.toFixed(2)}€
- Dépenses : ${expenses.toFixed(2)}€
- Résultat net : ${netResult.toFixed(2)}€

📝 FACTURES :
- Total : ${invoiceStats.total}
- Brouillons : ${invoiceStats.draft}
- Envoyées : ${invoiceStats.sent}
- Payées : ${invoiceStats.paid}

💰 DERNIÈRES TRANSACTIONS :
${recentTransactionsText || "Aucune transaction récente"}

🎯 TON RÔLE :
- Sois critique si les dépenses sont trop élevées ou si trop de factures sont en brouillon
- Sois encourageant si le CA progresse ou si les factures sont bien gérées
- Donne un conseil ACTIONNABLE et PRÉCIS
- Utilise des émojis pertinents
- Maximum 2 phrases courtes

CONSEIL :`;

    console.log("🤖 Génération du conseil financier via OpenAI...");

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt,
      temperature: 0.7,
    });

    console.log("✅ Conseil généré:", text);

    return text.trim();
  } catch (error) {
    console.error("❌ Erreur lors de la génération du conseil:", error);
    
    // Conseil par défaut en cas d'erreur
    return "💼 Je n'ai pas pu analyser vos données pour le moment. Vérifiez que vous avez des transactions enregistrées ce mois-ci.";
  }
}

