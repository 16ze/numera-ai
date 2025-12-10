/**
 * Route API pour le chatbot financier
 * Utilise Vercel AI SDK avec streamText et des outils pour interroger la base de données
 */

import { openai } from "@ai-sdk/openai";
import { PrismaClient } from "@prisma/client";
import { streamText } from "ai";
import { z } from "zod";

const prisma = new PrismaClient();

/**
 * Fonction helper pour récupérer l'entreprise de l'utilisateur demo
 * Hardcodé pour demo@numera.ai en attendant l'authentification
 */
async function getDemoCompany() {
  try {
    console.log("🔍 Recherche de l'utilisateur demo@numera.ai");
    const user = await prisma.user.findUnique({
      where: { email: "demo@numera.ai" },
      include: {
        companies: true,
      },
    });

    if (!user) {
      console.error("❌ Utilisateur non trouvé");
      throw new Error("Utilisateur non trouvé");
    }

    if (!user.companies || user.companies.length === 0) {
      console.error("❌ Aucune entreprise trouvée pour l'utilisateur");
      throw new Error("Aucune entreprise trouvée pour l'utilisateur");
    }

    console.log("✅ Utilisateur et entreprise trouvés:", user.companies[0].id);
    return user.companies[0];
  } catch (error) {
    console.error("❌ Erreur dans getDemoCompany:", error);
    throw error;
  }
}

/**
 * Tool : getStats - Retourne le CA et les dépenses du mois en cours
 */
const getStatsTool = {
  description:
    "Récupère les statistiques financières du mois en cours : chiffre d'affaires, dépenses et résultat net.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      console.log("🔧 Tool getStats appelé");
      const company = await getDemoCompany();
      console.log("✅ Entreprise trouvée:", company.id);
      
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

      const monthlyTransactions = await prisma.transaction.findMany({
        where: {
          companyId: company.id,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      console.log(`📊 ${monthlyTransactions.length} transactions trouvées`);

      const totalRevenue = monthlyTransactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalExpenses = monthlyTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const netIncome = totalRevenue - totalExpenses;

      const result = {
        chiffreAffaires: totalRevenue,
        depenses: totalExpenses,
        resultatNet: netIncome,
        periode: `Mois de ${now.toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        })}`,
      };

      console.log("✅ getStats résultat:", result);
      return result;
    } catch (error) {
      console.error("❌ Erreur dans getStats:", error);
      throw error;
    }
  },
};

/**
 * Tool : getLastTransactions - Retourne les 5 dernières transactions
 */
const getLastTransactionsTool = {
  description:
    "Récupère les 5 dernières transactions (recettes et dépenses) de l'entreprise.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      console.log("🔧 Tool getLastTransactions appelé");
      const company = await getDemoCompany();

      const transactions = await prisma.transaction.findMany({
        where: {
          companyId: company.id,
        },
        orderBy: {
          date: "desc",
        },
        take: 5,
      });

      const result = transactions.map((t) => ({
        id: t.id,
        date: t.date.toLocaleDateString("fr-FR"),
        montant: Number(t.amount),
        description: t.description || "Sans description",
        type: t.type === "INCOME" ? "Recette" : "Dépense",
        categorie: t.category,
        statut: t.status === "COMPLETED" ? "Complétée" : "En attente",
      }));

      console.log("✅ getLastTransactions résultat:", result.length, "transactions");
      return result;
    } catch (error) {
      console.error("❌ Erreur dans getLastTransactions:", error);
      throw error;
    }
  },
};

/**
 * Tool : searchTransactions - Cherche des transactions par mot-clé
 */
const searchTransactionsTool = {
  description:
    "Recherche des transactions par mot-clé dans la description. Utile pour répondre à des questions comme 'combien j'ai payé en restaurant ?' ou 'quelles sont mes dépenses de transport ?'",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Mot-clé ou phrase à rechercher dans les descriptions des transactions"
      ),
  }),
  execute: async ({ query }: { query: string }) => {
    try {
      console.log("🔧 Tool searchTransactions appelé avec query:", query);
      const company = await getDemoCompany();

      const transactions = await prisma.transaction.findMany({
        where: {
          companyId: company.id,
          description: {
            contains: query,
            mode: "insensitive",
          },
        },
        orderBy: {
          date: "desc",
        },
        take: 20,
      });

      console.log(`📊 ${transactions.length} transactions trouvées pour "${query}"`);

      if (transactions.length === 0) {
        const result = {
          message: `Aucune transaction trouvée pour "${query}"`,
          transactions: [],
          total: 0,
        };
        console.log("✅ searchTransactions résultat (vide):", result);
        return result;
      }

      const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

      const result = {
        message: `${transactions.length} transaction(s) trouvée(s) pour "${query}"`,
        transactions: transactions.map((t) => ({
          date: t.date.toLocaleDateString("fr-FR"),
          montant: Number(t.amount),
          description: t.description || "Sans description",
          type: t.type === "INCOME" ? "Recette" : "Dépense",
          categorie: t.category,
        })),
        total: total,
      };

      console.log("✅ searchTransactions résultat:", result.transactions.length, "transactions, total:", total);
      return result;
    } catch (error) {
      console.error("❌ Erreur dans searchTransactions:", error);
      throw error;
    }
  },
};

/**
 * Handler POST pour la route API
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages manquants ou invalides" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Conversion des messages au format attendu par streamText
    const formattedMessages = messages.map(
      (msg: { role: string; content: string }) => {
        // Validation du role
        if (
          msg.role !== "user" &&
          msg.role !== "assistant" &&
          msg.role !== "system"
        ) {
          throw new Error(`Role invalide: ${msg.role}`);
        }
        return {
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        };
      }
    );

    console.log("🚀 Début streamText avec", formattedMessages.length, "messages");

    // Génération de la réponse avec streamText
    const result = await streamText({
      model: openai("gpt-4o"),
      system:
        "Tu es un Assistant CFO expert. Tu aides l'entrepreneur à gérer ses finances. Tu es poli, concis et précis. Tu as accès aux données de l'entreprise via des outils. Utilise les outils disponibles pour répondre aux questions sur les finances. Formate les montants en euros (ex: 1 234,56 €).",
      messages: formattedMessages,
      tools: {
        getStats: getStatsTool,
        getLastTransactions: getLastTransactionsTool,
        searchTransactions: searchTransactionsTool,
      },
      onError: (error) => {
        console.error("❌ Erreur dans streamText:", error);
      },
      onFinish: (result) => {
        console.log("✅ streamText terminé:", {
          finishReason: result.finishReason,
          usage: result.usage,
          toolCalls: result.toolCalls?.length || 0,
        });
      },
    });

    console.log("📤 Envoi de la réponse streamée");
    // Utiliser toTextStreamResponse qui retourne un format TextStream
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Erreur dans la route API chat:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({
        error: "Erreur lors de la génération de la réponse",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
