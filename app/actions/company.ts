"use server";

/**
 * Server Actions pour la gestion des entreprises
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { revalidatePath } from "next/cache";

/**
 * Type pour les données de mise à jour d'entreprise
 */
export type CompanyUpdateData = {
  name?: string;
  address?: string;
  siret?: string;
  apeCode?: string;
  vatNumber?: string;
  capital?: string;
  legalForm?: string;
  isAutoEntrepreneur?: boolean;
};

/**
 * Server Action pour mettre à jour les détails de l'entreprise de l'utilisateur connecté
 * 
 * @param data - Données de mise à jour de l'entreprise
 * @returns {Promise<{ success: boolean; message: string }>} Résultat de la mise à jour
 * @throws {Error} Si l'entreprise n'existe pas ou si l'utilisateur n'est pas connecté
 */
export async function updateCompanyDetails(
  data: CompanyUpdateData
): Promise<{ success: boolean; message: string }> {
  try {
    // Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    // Récupération de la première company de l'utilisateur
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    // Préparation des données à mettre à jour (seulement les champs fournis)
    // Utilisation d'un objet avec types explicites pour éviter les problèmes de typage Prisma
    const updateData: {
      name?: string;
      address?: string | null;
      siret?: string | null;
      apeCode?: string | null;
      vatNumber?: string | null;
      capital?: string | null;
      legalForm?: string | null;
      isAutoEntrepreneur?: boolean;
    } = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.siret !== undefined) updateData.siret = data.siret || null;
    if (data.apeCode !== undefined) updateData.apeCode = data.apeCode || null;
    if (data.vatNumber !== undefined) updateData.vatNumber = data.vatNumber || null;
    if (data.capital !== undefined) updateData.capital = data.capital || null;
    if (data.legalForm !== undefined) updateData.legalForm = data.legalForm || null;
    if (data.isAutoEntrepreneur !== undefined) updateData.isAutoEntrepreneur = data.isAutoEntrepreneur;

    // Mise à jour de l'entreprise
    await prisma.company.update({
      where: { id: company.id },
      data: updateData,
    });

    console.log(`✅ Entreprise ${company.id} mise à jour avec succès`);

    // Revalidation des caches pour mettre à jour les pages concernées
    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/invoices");
    revalidatePath("/onboarding");

    return {
      success: true,
      message: "Informations de l'entreprise mises à jour avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'entreprise:", error);
    throw error;
  }
}

