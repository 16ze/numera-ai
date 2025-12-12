"use server";

/**
 * Server Actions pour la gestion des transactions
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { TransactionCategory, TransactionType } from "@prisma/client";

/**
 * Type pour une transaction avec ses relations
 */
export type TransactionWithCompany = {
  id: string;
  date: Date;
  amount: number;
  description: string | null;
  type: TransactionType;
  category: TransactionCategory;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  company: {
    id: string;
    name: string;
  };
};

/**
 * Récupère toutes les transactions de l'utilisateur connecté
 *
 * @returns {Promise<TransactionWithCompany[]>} Liste des transactions
 */
export async function getTransactions(): Promise<TransactionWithCompany[]> {
  try {
    // Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      return [];
    }

    const companyId = user.companies[0].id;

    // Récupération des transactions avec la company
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc", // Plus récentes en premier
      },
    });

    return transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
    }));
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des transactions:", error);
    throw new Error("Erreur lors de la récupération des transactions");
  }
}

