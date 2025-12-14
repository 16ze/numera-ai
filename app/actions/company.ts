"use server";

/**
 * Server Actions pour la gestion des entreprises
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
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
  logoUrl?: string | null;
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
      logoUrl?: string | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.siret !== undefined) updateData.siret = data.siret || null;
    if (data.apeCode !== undefined) updateData.apeCode = data.apeCode || null;
    if (data.vatNumber !== undefined)
      updateData.vatNumber = data.vatNumber || null;
    if (data.capital !== undefined) updateData.capital = data.capital || null;
    if (data.legalForm !== undefined)
      updateData.legalForm = data.legalForm || null;
    if (data.isAutoEntrepreneur !== undefined)
      updateData.isAutoEntrepreneur = data.isAutoEntrepreneur;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl || null;

    // Mise à jour de l'entreprise
    await prisma.company.update({
      where: { id: company.id },
      data: updateData,
    });

    console.log(`✅ Entreprise ${company.id} mise à jour avec succès`);

    // Revalidation des caches pour mettre à jour les pages concernées
    // IMPORTANT: Revalider /onboarding en premier pour éviter les boucles de redirection
    revalidatePath("/onboarding");
    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/invoices");

    return {
      success: true,
      message: "Informations de l'entreprise mises à jour avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'entreprise:", error);
    throw error;
  }
}

/**
 * Server Action pour mettre à jour les mots-clés de revenus de l'entreprise
 * Ces mots-clés permettent d'identifier quelles transactions INCOME sont du vrai CA
 *
 * @param keywords - Tableau de mots-clés (ex: ["STRIPE", "VRST", "VIR"])
 * @returns {Promise<{ success: boolean; message: string }>} Résultat de la mise à jour
 * @throws {Error} Si l'entreprise n'existe pas ou si l'utilisateur n'est pas connecté
 */
export async function updateRevenueKeywords(
  keywords: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    // Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    // Récupération de la première company de l'utilisateur
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    // Nettoyage des mots-clés : trim, suppression des doublons, conversion en majuscules
    const cleanedKeywords = Array.from(
      new Set(
        keywords.map((k) => k.trim().toUpperCase()).filter((k) => k.length > 0)
      )
    );

    // Stockage sous forme de chaîne séparée par des virgules
    const keywordsString =
      cleanedKeywords.length > 0 ? cleanedKeywords.join(",") : null;

    // Mise à jour de l'entreprise
    await prisma.company.update({
      where: { id: company.id },
      data: {
        revenueKeywords: keywordsString,
      },
    });

    console.log(
      `✅ Mots-clés de revenus mis à jour pour l'entreprise ${company.id}: ${keywordsString || "aucun"}`
    );

    // Revalidation des caches pour mettre à jour le dashboard
    revalidatePath("/");
    revalidatePath("/settings/revenue");

    return {
      success: true,
      message: `Mots-clés de revenus mis à jour (${cleanedKeywords.length} mot${cleanedKeywords.length > 1 ? "s" : ""}-clé${cleanedKeywords.length > 1 ? "s" : ""})`,
    };
  } catch (error) {
    console.error(
      "Erreur lors de la mise à jour des mots-clés de revenus:",
      error
    );
    throw error;
  }
}

/**
 * Server Action pour mettre à jour le taux de taxes de l'entreprise
 * Ce taux représente le pourcentage du CA à mettre de côté pour les taxes (URSSAF/Impôts)
 *
 * @param taxRate - Taux de taxes en pourcentage (ex: 22.0 pour 22%)
 * @returns {Promise<{ success: boolean; message: string }>} Résultat de la mise à jour
 * @throws {Error} Si l'entreprise n'existe pas, si l'utilisateur n'est pas connecté, ou si le taux est invalide
 */
export async function updateTaxRate(
  taxRate: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Validation du taux
    if (taxRate < 0 || taxRate > 50) {
      throw new Error("Le taux de taxes doit être entre 0% et 50%");
    }

    // Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    // Récupération de la première company de l'utilisateur
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    // Mise à jour de l'entreprise
    await prisma.company.update({
      where: { id: company.id },
      data: {
        taxRate,
      },
    });

    console.log(
      `✅ Taux de taxes mis à jour pour l'entreprise ${company.id}: ${taxRate}%`
    );

    // Revalidation des caches pour mettre à jour le dashboard
    revalidatePath("/");
    revalidatePath("/settings/taxes");

    return {
      success: true,
      message: `Taux de taxes mis à jour à ${taxRate}%`,
    };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du taux de taxes:", error);
    throw error;
  }
}
