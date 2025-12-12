"use server";

/**
 * Server Actions pour l'onboarding des entreprises
 * 
 * Ce module contient les actions spécifiques à la configuration initiale
 * de l'entreprise lors de la première connexion de l'utilisateur.
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { revalidatePath } from "next/cache";

/**
 * Type pour les données de mise à jour d'entreprise lors de l'onboarding
 */
export type OnboardingCompanyData = {
  name: string;
  siret: string;
  address?: string;
  vatNumber?: string;
  capital?: string;
  legalForm?: string;
  apeCode?: string;
};

/**
 * Server Action pour mettre à jour les détails de l'entreprise lors de l'onboarding
 * 
 * Cette fonction est appelée lors de la première configuration de l'entreprise.
 * Elle met à jour les informations de base nécessaires pour commencer à utiliser l'application.
 * 
 * @param data - Données de l'entreprise à mettre à jour
 * @returns {Promise<{ success: true }>} Succès de la mise à jour
 * @throws {Error} Si l'utilisateur n'est pas connecté, si l'entreprise n'existe pas, ou en cas d'erreur Prisma
 * 
 * @example
 * ```typescript
 * const result = await updateCompanyDetails({
 *   name: "Ma Société",
 *   siret: "12345678901234",
 *   address: "123 Rue Example",
 *   legalForm: "SARL"
 * });
 * ```
 */
export async function updateCompanyDetails(
  data: OnboardingCompanyData
): Promise<{ success: true }> {
  try {
    // 1. Récupération de l'utilisateur connecté
    // getCurrentUser() redirige automatiquement vers /sign-in si non connecté
    const user = await getCurrentUser();

    // 2. Vérification de l'existence d'une entreprise pour cet utilisateur
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    // 3. Préparation des données à mettre à jour
    // Conversion des valeurs vides en null pour Prisma
    const updateData: {
      name: string;
      siret: string;
      address?: string | null;
      vatNumber?: string | null;
      capital?: string | null;
      legalForm?: string | null;
      apeCode?: string | null;
    } = {
      name: data.name.trim(),
      siret: data.siret.trim(),
      address: data.address?.trim() || null,
      vatNumber: data.vatNumber?.trim() || null,
      capital: data.capital?.trim() || null,
      legalForm: data.legalForm?.trim() || null,
      apeCode: data.apeCode?.trim() || null,
    };

    // 4. Validation des champs obligatoires
    if (!updateData.name || updateData.name.length === 0) {
      throw new Error("Le nom de l'entreprise est obligatoire");
    }

    if (!updateData.siret || updateData.siret.length === 0) {
      throw new Error("Le SIRET est obligatoire");
    }

    // 5. Mise à jour de l'entreprise dans Prisma
    await prisma.company.update({
      where: { id: company.id },
      data: updateData,
    });

    console.log(`✅ Entreprise ${company.id} mise à jour avec succès lors de l'onboarding`);

    // 6. Revalidation des caches pour mettre à jour les pages concernées
    // Revalidation de la page d'accueil pour que le layout dashboard détecte le SIRET
    revalidatePath("/");

    // 7. Retour du succès
    return { success: true };
  } catch (error) {
    // Gestion des erreurs avec logging détaillé
    console.error("❌ Erreur lors de la mise à jour de l'entreprise (onboarding):", error);

    // Si c'est une erreur Prisma, on la transforme en message plus lisible
    if (error instanceof Error) {
      // Erreur de validation Prisma
      if (error.message.includes("Unique constraint")) {
        throw new Error("Un SIRET avec cette valeur existe déjà");
      }
      // Propagation de l'erreur avec le message original
      throw error;
    }

    // Erreur inconnue
    throw new Error("Une erreur inattendue s'est produite lors de la mise à jour de l'entreprise");
  }
}

