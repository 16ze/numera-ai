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
      model: openai("gpt-4o-mini"), // Optimisation coûts : analyse JSON → mini
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

/**
 * Interface pour les données de simulation de rentabilité
 */
export interface SimulationData {
  sellingPrice: number;
  totalCost: number;
  breakdown: {
    suppliesCost: number;
    equipmentCost: number;
    laborCost: number;
    overheadCost: number;
  };
  currentMargin?: number;
  marginPercent?: number;
}

/**
 * Interface pour le résultat du conseil de rentabilité
 */
export interface ProfitabilityAdvice {
  score: number; // Note sur 10
  analysis: string; // Analyse franche
  actions: string[]; // 3 actions concrètes
}

/**
 * Obtient un conseil business personnalisé basé sur l'analyse de rentabilité
 * Utilise OpenAI GPT-4o pour analyser la structure de coûts et donner des conseils stratégiques
 *
 * @param data - Données de simulation de rentabilité
 * @returns {Promise<ProfitabilityAdvice>} Le conseil généré par l'IA
 * @throws {Error} Si l'utilisateur n'est pas connecté ou en cas d'erreur
 */
export async function getProfitabilityAdvice(
  data: SimulationData
): Promise<ProfitabilityAdvice> {
  try {
    console.log("🤖 Génération du conseil business via OpenAI...");

    // Préparation du prompt pour GPT-4o
    const prompt = `Tu es un Business Coach expert pour entrepreneurs. Analyse cette structure de coût d'une prestation de service.

📊 DONNÉES DE RENTABILITÉ :
- Prix de Vente: ${data.sellingPrice.toFixed(2)} €
- Coût de Revient: ${data.totalCost.toFixed(2)} €
- Marge actuelle: ${data.currentMargin !== undefined ? data.currentMargin.toFixed(2) + " €" : "Non calculée"} (${data.marginPercent !== undefined ? data.marginPercent.toFixed(1) + "%" : "N/A"})

💰 DÉTAIL DES COÛTS :
- Consommables (Matière): ${data.breakdown.suppliesCost.toFixed(2)} €
- Matériel (Amortissement): ${data.breakdown.equipmentCost.toFixed(2)} €
- Main d'œuvre: ${data.breakdown.laborCost.toFixed(2)} €
- Charges fixes: ${data.breakdown.overheadCost.toFixed(2)} €

🎯 TON RÔLE :
Tu dois analyser cette structure de coût et donner un conseil business stratégique.

📝 FORMAT DE RÉPONSE (JSON strict) :
{
  "score": <nombre entre 0 et 10>,
  "analysis": "<analyse franche en 2-3 phrases. Sois direct et critique si nécessaire. Ex: 'Tu passes trop de temps' ou 'Tes produits sont trop chers' ou 'Bravo, ta structure est solide'>",
  "actions": [
    "<action concrète 1. Ex: 'Augmente ton prix de 5€'>",
    "<action concrète 2. Ex: 'Négocie tes consommables avec ton fournisseur'>",
    "<action concrète 3. Ex: 'Réduis la durée de 15min'>"
  ]
}

🔍 CRITÈRES D'ANALYSE :
- Si marge < 0 : Score 0-3, analyse critique, actions urgentes
- Si marge 0-10% : Score 4-6, analyse préoccupante, actions d'optimisation
- Si marge 10-20% : Score 7-8, analyse positive mais améliorable
- Si marge > 20% : Score 9-10, analyse très positive, actions de croissance

💡 ACTIONS CONCRÈTES :
- Doivent être ACTIONNABLES (ex: "Augmente de 5€", pas "Augmente le prix")
- Doivent être SPÉCIFIQUES (montants, durées, pourcentages)
- Doivent être PRIORITAIRES (les 3 plus impactantes)

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"), // Optimisation coûts : analyse JSON → mini
      prompt,
      temperature: 0.7,
      maxTokens: 500,
    });

    console.log("✅ Conseil généré:", text);

    // Parser la réponse JSON
    try {
      // Nettoyer le texte pour extraire le JSON (enlever markdown si présent)
      let jsonText = text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```\n?/g, "");
      }

      const advice: ProfitabilityAdvice = JSON.parse(jsonText);

      // Validation des données
      if (
        typeof advice.score !== "number" ||
        advice.score < 0 ||
        advice.score > 10
      ) {
        throw new Error("Score invalide");
      }

      if (
        !Array.isArray(advice.actions) ||
        advice.actions.length !== 3
      ) {
        throw new Error("Actions invalides");
      }

      if (typeof advice.analysis !== "string" || advice.analysis.length === 0) {
        throw new Error("Analyse invalide");
      }

      return advice;
    } catch (parseError) {
      console.error("❌ Erreur lors du parsing JSON:", parseError);
      console.error("Texte reçu:", text);
      // Retourner un conseil par défaut en cas d'erreur de parsing
      return {
        score: 5,
        analysis:
          "Je n'ai pas pu analyser précisément votre structure de coûts. Vérifiez que tous les champs sont correctement remplis.",
        actions: [
          "Vérifiez que tous vos coûts sont bien renseignés",
          "Assurez-vous d'avoir configuré un prix de vente",
          "Contactez le support si le problème persiste",
        ],
      };
    }
  } catch (error) {
    console.error("❌ Erreur lors de la génération du conseil:", error);

    // Conseil par défaut en cas d'erreur
    return {
      score: 5,
      analysis:
        "Une erreur est survenue lors de l'analyse. Veuillez réessayer.",
      actions: [
        "Vérifiez votre connexion internet",
        "Réessayez dans quelques instants",
        "Contactez le support si le problème persiste",
      ],
    };
  }
}

