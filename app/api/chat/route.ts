/**
 * Route API pour le chatbot financier
 * Utilise Vercel AI SDK avec streamText et des outils pour interroger la base de données
 */

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

/**
 * Fonction helper pour récupérer l'entreprise de l'utilisateur demo
 * Hardcodé pour demo@numera.ai en attendant l'authentification
 */
async function getDemoCompany() {
  const user = await prisma.user.findUnique({
    where: { email: "demo@numera.ai" },
    include: {
      companies: true,
    },
  });

  if (!user || !user.companies || user.companies.length === 0) {
    throw new Error("Utilisateur ou entreprise non trouvée");
  }

  return user.companies[0];
}

/**
 * Tool : getStats - Retourne le CA et les dépenses du mois en cours
 */
const getStatsTool = {
  description:
    "Récupère les statistiques financières du mois en cours : chiffre d'affaires, dépenses et résultat net.",
  parameters: z.object({}),
  execute: async () => {
    const company = await getDemoCompany();
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

    const totalRevenue = monthlyTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = monthlyTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netIncome = totalRevenue - totalExpenses;

    return {
      chiffreAffaires: totalRevenue,
      depenses: totalExpenses,
      resultatNet: netIncome,
      periode: `Mois de ${now.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      })}`,
    };
  },
};

/**
 * Tool : getLastTransactions - Retourne les 5 dernières transactions
 */
const getLastTransactionsTool = {
  description:
    "Récupère les 5 dernières transactions (recettes et dépenses) de l'entreprise.",
  parameters: z.object({}),
  execute: async () => {
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

    return transactions.map((t) => ({
      id: t.id,
      date: t.date.toLocaleDateString("fr-FR"),
      montant: Number(t.amount),
      description: t.description || "Sans description",
      type: t.type === "INCOME" ? "Recette" : "Dépense",
      categorie: t.category,
      statut: t.status === "COMPLETED" ? "Complétée" : "En attente",
    }));
  },
};

/**
 * Tool : searchTransactions - Cherche des transactions par mot-clé
 */
const searchTransactionsTool = {
  description:
    "Recherche des transactions par mot-clé dans la description. Utile pour répondre à des questions comme 'combien j'ai payé en restaurant ?' ou 'quelles sont mes dépenses de transport ?'",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Mot-clé ou phrase à rechercher dans les descriptions des transactions"
      ),
  }),
  execute: async ({ query }: { query: string }) => {
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

    if (transactions.length === 0) {
      return {
        message: `Aucune transaction trouvée pour "${query}"`,
        transactions: [],
        total: 0,
      };
    }

    const total = transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    return {
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
  },
};

/**
 * Handler POST pour la route API
 */
export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Conversion des messages au format attendu par streamText
    const formattedMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content,
    }));

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
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Erreur dans la route API chat:", error);
    return new Response(
      JSON.stringify({ error: "Erreur lors de la génération de la réponse" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

