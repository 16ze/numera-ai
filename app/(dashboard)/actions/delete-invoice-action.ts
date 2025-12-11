"use server";

/**
 * Server Action pour supprimer une facture
 * SÉCURITÉ : Vérifie que la facture appartient à l'entreprise de l'utilisateur connecté
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { revalidatePath } from "next/cache";

/**
 * Supprime une facture après vérification de sécurité
 * 
 * @param invoiceId - ID de la facture à supprimer
 * @returns {Promise<{ success: boolean; message: string }>} Résultat de la suppression
 * @throws {Error} Si la facture n'existe pas ou n'appartient pas à l'utilisateur
 */
export async function deleteInvoice(invoiceId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    // Récupération de la première company de l'utilisateur
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    // Vérification que la facture existe et appartient à l'entreprise de l'utilisateur
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        number: true,
        companyId: true,
      },
    });

    if (!invoice) {
      throw new Error("Facture non trouvée");
    }

    // SÉCURITÉ CRITIQUE : Vérifier que la facture appartient à l'entreprise de l'utilisateur
    if (invoice.companyId !== company.id) {
      throw new Error("Cette facture ne vous appartient pas");
    }

    // Suppression de la facture (les InvoiceRow seront supprimées automatiquement via onDelete: Cascade)
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });

    console.log(`✅ Facture ${invoice.number} supprimée avec succès`);

    // Revalidation du cache pour mettre à jour la liste des factures
    revalidatePath("/invoices");

    return {
      success: true,
      message: `Facture ${invoice.number} supprimée avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de la facture:", error);
    throw error;
  }
}

