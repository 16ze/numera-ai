"use server";

/**
 * Server Actions pour la gestion du budget mensuel
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Met à jour le budget mensuel et le seuil d'alerte de l'entreprise de l'utilisateur connecté
 * @param amount - Montant du budget mensuel (en euros)
 * @param threshold - Seuil d'alerte : montant 'Reste à dépenser' minimum avant alerte rouge (en euros)
 * @returns {Promise<{ success: boolean; message: string }>}
 */
export async function updateMonthlyBudget(
  amount: number,
  threshold: number = 100.0
): Promise<{ success: boolean; message: string }> {
  try {
    // Validation
    if (amount < 0) {
      throw new Error("Le budget mensuel ne peut pas être négatif");
    }

    if (threshold < 0) {
      throw new Error("Le seuil d'alerte ne peut pas être négatif");
    }

    // Récupération de l'utilisateur connecté
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // Mise à jour du budget mensuel et du seuil d'alerte
    await prisma.company.update({
      where: {
        id: company.id,
      },
      data: {
        monthlyBudget: amount,
        budgetAlertThreshold: threshold,
      },
    });

    // Revalidation du path du dashboard
    revalidatePath("/");

    return {
      success: true,
      message: `Budget mensuel mis à jour : ${amount.toFixed(2)} € (Seuil d'alerte : ${threshold.toFixed(2)} €)`,
    };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du budget:", error);

    // Vérifier si l'erreur vient du fait que les champs n'existent pas encore dans la base
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("monthlyBudget") ||
      errorMessage.includes("budgetAlertThreshold") ||
      errorMessage.includes("Unknown argument") ||
      errorMessage.includes("Unknown field")
    ) {
      throw new Error(
        "Les champs de budget n'existent pas encore dans la base de données. " +
          "Veuillez exécuter la migration Prisma : npx prisma db push"
      );
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la mise à jour du budget mensuel"
    );
  }
}
