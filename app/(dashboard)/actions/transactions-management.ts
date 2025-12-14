"use server";

/**
 * Server Actions pour la gestion des transactions
 *
 * Ce module permet de :
 * - Mettre à jour une transaction
 * - Supprimer une transaction unique
 * - Supprimer plusieurs transactions en lot
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Schéma Zod pour valider les données de mise à jour d'une transaction
 */
const UpdateTransactionSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z
    .number()
    .refine((val) => val !== 0, {
      message: "Le montant ne peut pas être égal à 0",
    })
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  category: z.nativeEnum(TransactionCategory).optional(),
  type: z.nativeEnum(TransactionType).optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
});

/**
 * Met à jour une transaction
 *
 * @param id - ID de la transaction à mettre à jour
 * @param data - Données à mettre à jour
 * @returns {Promise<{ success: true }>} Succès de la mise à jour
 * @throws {Error} Si la transaction n'existe pas, si l'utilisateur n'a pas les droits, ou en cas d'erreur
 */
export async function updateTransaction(
  id: string,
  data: z.infer<typeof UpdateTransactionSchema>
): Promise<{ success: true }> {
  try {
    // 1. Valider les données
    const validatedData = UpdateTransactionSchema.parse(data);

    // 2. Récupérer l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    // 3. Vérifier que la transaction existe et appartient à l'utilisateur
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!existingTransaction) {
      throw new Error(
        "Transaction non trouvée ou vous n'avez pas les droits pour la modifier"
      );
    }

    // 4. Préparer les données de mise à jour
    const updateData: {
      description?: string;
      amount?: number;
      date?: Date;
      category?: TransactionCategory;
      type?: TransactionType;
      status?: TransactionStatus;
    } = {};

    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    if (validatedData.amount !== undefined) {
      updateData.amount = validatedData.amount;
    }

    if (validatedData.date !== undefined) {
      const transactionDate = new Date(validatedData.date + "T00:00:00.000Z");
      if (isNaN(transactionDate.getTime())) {
        throw new Error("Date invalide");
      }
      updateData.date = transactionDate;
    }

    if (validatedData.category !== undefined) {
      updateData.category = validatedData.category;
    }

    if (validatedData.type !== undefined) {
      updateData.type = validatedData.type;
    }

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    // 5. Mettre à jour la transaction
    console.log(`💾 Mise à jour de la transaction ${id}...`);

    await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Transaction mise à jour avec succès: ${id}`);

    // 6. Revalider le cache
    revalidatePath("/transactions");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour de la transaction:", error);

    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((issue) => issue.message)
        .join(", ");
      throw new Error(`Données invalides: ${errorMessages}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Une erreur inattendue s'est produite lors de la mise à jour"
    );
  }
}

/**
 * Supprime une transaction unique
 *
 * @param id - ID de la transaction à supprimer
 * @returns {Promise<{ success: true }>} Succès de la suppression
 * @throws {Error} Si la transaction n'existe pas, si l'utilisateur n'a pas les droits, ou en cas d'erreur
 */
export async function deleteTransaction(
  id: string
): Promise<{ success: true }> {
  try {
    // 1. Récupérer l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    // 2. Vérifier que la transaction existe et appartient à l'utilisateur
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!existingTransaction) {
      throw new Error(
        "Transaction non trouvée ou vous n'avez pas les droits pour la supprimer"
      );
    }

    // 3. Supprimer la transaction
    console.log(`🗑️ Suppression de la transaction ${id}...`);

    await prisma.transaction.delete({
      where: { id },
    });

    console.log(`✅ Transaction supprimée avec succès: ${id}`);

    // 4. Revalider le cache
    revalidatePath("/transactions");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("❌ Erreur lors de la suppression de la transaction:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Une erreur inattendue s'est produite lors de la suppression"
    );
  }
}

/**
 * Supprime plusieurs transactions en lot
 *
 * @param ids - Tableau d'IDs de transactions à supprimer
 * @returns {Promise<{ success: true; count: number }>} Succès avec le nombre de transactions supprimées
 * @throws {Error} Si aucune transaction n'est trouvée, si l'utilisateur n'a pas les droits, ou en cas d'erreur
 */
export async function deleteManyTransactions(
  ids: string[]
): Promise<{ success: true; count: number }> {
  try {
    if (!ids || ids.length === 0) {
      throw new Error("Aucune transaction sélectionnée");
    }

    // 1. Dédupliquer les IDs pour éviter les problèmes
    const uniqueIds = Array.from(
      new Set(ids.filter((id) => id && id.trim() !== ""))
    );

    if (uniqueIds.length === 0) {
      throw new Error("Aucun ID de transaction valide fourni");
    }

    // 2. Récupérer l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    // 3. Vérifier que toutes les transactions existent et appartiennent à l'utilisateur
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: uniqueIds },
        companyId,
      },
      select: { id: true },
    });

    const existingIds = new Set(existingTransactions.map((tx) => tx.id));
    const missingIds = uniqueIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      console.warn(
        `⚠️ ${missingIds.length} transaction(s) non trouvée(s) ou sans droits:`,
        missingIds
      );
      throw new Error(
        `Certaines transactions n'existent pas ou vous n'avez pas les droits pour les supprimer (${missingIds.length} transaction(s) concernée(s))`
      );
    }

    // 4. Supprimer les transactions
    console.log(`🗑️ Suppression de ${uniqueIds.length} transaction(s)...`);

    const result = await prisma.transaction.deleteMany({
      where: {
        id: { in: uniqueIds },
        companyId,
      },
    });

    console.log(`✅ ${result.count} transaction(s) supprimée(s) avec succès`);

    // 5. Revalider le cache
    revalidatePath("/transactions");
    revalidatePath("/");

    return {
      success: true,
      count: result.count,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la suppression des transactions:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Une erreur inattendue s'est produite lors de la suppression"
    );
  }
}
