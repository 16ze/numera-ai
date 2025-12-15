"use server";

/**
 * Server Actions pour le calcul de rentabilité et fixation de prix
 * Calcule le prix de vente recommandé en fonction des coûts, charges et marges
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { openai } from "@ai-sdk/openai";

/**
 * Résultat du calcul de prix d'un service
 */
export interface ServicePriceCalculation {
  // Coûts de base
  hourlyCost: number; // Coût horaire chargé (€/h)
  serviceCost: number; // Coût de revient du service (€)
  
  // Prix calculés
  minimumPrice: number; // Prix minimum conseillé (€)
  recommendedPrice: number; // Prix recommandé avec marge (€)
  
  // Métriques
  clientsNeededPerMonth: number; // Nombre de clients nécessaires par mois pour atteindre l'objectif
  monthlyHoursNeeded: number; // Heures de travail nécessaires par mois
  isRealistic: boolean; // Si le nombre de clients est réaliste (< 150h/mois)
  
  // Détails du calcul
  breakdown: {
    laborCost: number; // Coût main d'œuvre (durée * coût horaire)
    materialCost: number; // Coût matériel
    platformFees: number; // Frais de plateforme
    margin: number; // Marge de sécurité
    taxes: number; // Taxes (TVA/URSSAF estimées)
  };
}

/**
 * Calcule le prix de vente recommandé pour un service
 *
 * Logique mathématique :
 * 1. Calcule le Coût Horaire Chargé : (Salaire + Charges + Fixes) / (Heures Travaillées Réelles par mois)
 * 2. Prend en compte les vacances pour réduire le nombre d'heures annuelles disponibles
 * 3. Calcule le Coût de Revient : (Durée * Coût Horaire) + Matériel
 * 4. Ajoute la Marge de sécurité (par défaut 20%)
 * 5. Ajoute les Taxes (TVA/URSSAF)
 *
 * @param serviceId - ID du service à calculer
 * @param marginPercent - Marge de sécurité souhaitée (par défaut 20%)
 * @returns {Promise<ServicePriceCalculation>} Calcul détaillé du prix
 */
export async function calculateServicePrice(
  serviceId: string,
  marginPercent: number = 20
): Promise<ServicePriceCalculation> {
  try {
    // 1. Récupération de l'utilisateur et de l'entreprise
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // 2. Récupération du service
    const service = await prisma.serviceDefinition.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new Error("Service non trouvé");
    }

    if (service.companyId !== company.id) {
      throw new Error("Ce service ne vous appartient pas");
    }

    // 3. Récupération du profil de coûts
    const costProfile = await prisma.costProfile.findUnique({
      where: { companyId: company.id },
    });

    if (!costProfile) {
      throw new Error(
        "Veuillez d'abord configurer votre profil de coûts (charges fixes, salaire, etc.)"
      );
    }

    // 4. CALCUL DU COÛT HORAIRE CHARGÉ
    // ============================================

    // 4.1. Calcul du salaire brut (salaire net + charges sociales)
    const socialChargesAmount =
      costProfile.desiredMonthlySalary * (costProfile.socialChargesRate / 100);
    const grossSalary =
      costProfile.desiredMonthlySalary + socialChargesAmount;

    // 4.2. Coût total mensuel (salaire brut + charges fixes)
    const totalMonthlyCost = grossSalary + costProfile.monthlyFixedCosts;

    // 4.3. Calcul des heures travaillées réelles par mois
    // On prend en compte les vacances pour avoir le nombre réel d'heures disponibles
    const weeksPerYear = 52;
    const workingWeeksPerYear = weeksPerYear - costProfile.vacationWeeks;
    const workingDaysPerYear =
      workingWeeksPerYear * (costProfile.workingDaysPerMonth / (52 / 12));
    const workingHoursPerYear =
      workingDaysPerYear * costProfile.dailyHours;
    const workingHoursPerMonth = workingHoursPerYear / 12;

    // 4.4. Coût horaire chargé
    const hourlyCost = totalMonthlyCost / workingHoursPerMonth;

    // 5. CALCUL DU COÛT DE REVIENT DU SERVICE
    // ============================================

    // 5.1. Coût main d'œuvre (durée en heures * coût horaire)
    const laborCost = (service.durationMinutes / 60) * hourlyCost;

    // 5.2. Coût matériel
    const materialCost = service.materialCost;

    // 5.3. Coût de revient total (avant marge et taxes)
    const serviceCost = laborCost + materialCost;

    // 6. CALCUL DU PRIX DE VENTE
    // ============================================

    // 6.1. Prix avec marge de sécurité
    const marginAmount = serviceCost * (marginPercent / 100);
    const priceWithMargin = serviceCost + marginAmount;

    // 6.2. Frais de plateforme (si applicable)
    const platformFeesAmount =
      priceWithMargin * (service.platformFees / 100);
    const priceAfterPlatformFees = priceWithMargin + platformFeesAmount;

    // 6.3. Estimation des taxes (TVA/URSSAF)
    // Pour simplifier, on estime que les taxes représentent environ 10% du prix HT
    // (cela dépend du régime fiscal, mais c'est une approximation)
    const estimatedTaxes = priceAfterPlatformFees * 0.1;

    // 6.4. Prix minimum conseillé (coût de revient + marge minimale de 10%)
    const minimumMargin = serviceCost * 0.1;
    const minimumPrice = serviceCost + minimumMargin + platformFeesAmount;

    // 6.5. Prix recommandé (avec marge souhaitée)
    const recommendedPrice = priceAfterPlatformFees + estimatedTaxes;

    // 7. CALCUL DU NOMBRE DE CLIENTS NÉCESSAIRES
    // ============================================

    // 7.1. Revenu mensuel cible (salaire net souhaité)
    const targetMonthlyRevenue = costProfile.desiredMonthlySalary;

    // 7.2. Nombre de services à vendre par mois
    // On utilise le prix minimum pour être conservateur
    const servicesNeededPerMonth = Math.ceil(
      targetMonthlyRevenue / minimumPrice
    );

    // 7.3. Heures de travail nécessaires par mois
    const monthlyHoursNeeded =
      (servicesNeededPerMonth * service.durationMinutes) / 60;

    // 7.4. Vérification de la réalisme (alerte si > 150h/mois = risque de burnout)
    const isRealistic = monthlyHoursNeeded <= 150;

    // 8. RETOUR DU RÉSULTAT
    return {
      hourlyCost: Math.round(hourlyCost * 100) / 100,
      serviceCost: Math.round(serviceCost * 100) / 100,
      minimumPrice: Math.round(minimumPrice * 100) / 100,
      recommendedPrice: Math.round(recommendedPrice * 100) / 100,
      clientsNeededPerMonth: servicesNeededPerMonth,
      monthlyHoursNeeded: Math.round(monthlyHoursNeeded * 100) / 100,
      isRealistic,
      breakdown: {
        laborCost: Math.round(laborCost * 100) / 100,
        materialCost: Math.round(materialCost * 100) / 100,
        platformFees: Math.round(platformFeesAmount * 100) / 100,
        margin: Math.round(marginAmount * 100) / 100,
        taxes: Math.round(estimatedTaxes * 100) / 100,
      },
    };
  } catch (error) {
    console.error("Erreur lors du calcul du prix:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors du calcul du prix du service"
    );
  }
}

/**
 * Met à jour ou crée le profil de coûts de l'entreprise
 *
 * @param data - Données du profil de coûts
 * @returns {Promise<{ success: true }>}
 */
export async function upsertCostProfile(data: {
  monthlyFixedCosts: number;
  desiredMonthlySalary: number;
  socialChargesRate: number;
  workingDaysPerMonth: number;
  dailyHours: number;
  vacationWeeks: number;
}): Promise<{ success: true }> {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    await prisma.costProfile.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        ...data,
      },
      update: data,
    });

    revalidatePath("/profitability");
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du profil de coûts:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la sauvegarde du profil de coûts"
    );
  }
}

/**
 * Crée ou met à jour une définition de service
 *
 * @param data - Données du service (sans id pour création, avec id pour mise à jour)
 * @returns {Promise<{ success: true; serviceId: string }>}
 */
export async function upsertServiceDefinition(data: {
  id?: string;
  name: string;
  durationMinutes: number;
  materialCost: number;
  platformFees: number;
}): Promise<{ success: true; serviceId: string }> {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // Pour la création, on doit utiliser create, pas upsert avec un ID temporaire
    if (data.id) {
      // Mise à jour
      const service = await prisma.serviceDefinition.update({
        where: { id: data.id },
        data: {
          name: data.name,
          durationMinutes: data.durationMinutes,
          materialCost: data.materialCost,
          platformFees: data.platformFees,
        },
      });
      revalidatePath("/profitability");
      return { success: true, serviceId: service.id };
    } else {
      // Création
      const service = await prisma.serviceDefinition.create({
        data: {
          companyId: company.id,
          name: data.name,
          durationMinutes: data.durationMinutes,
          materialCost: data.materialCost,
          platformFees: data.platformFees,
        },
      });
      revalidatePath("/profitability");
      return { success: true, serviceId: service.id };
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du service:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la sauvegarde du service"
    );
  }
}

/**
 * Récupère le profil de coûts de l'entreprise
 *
 * @returns {Promise<CostProfile | null>}
 */
export async function getCostProfile() {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      return null;
    }

    return await prisma.costProfile.findUnique({
      where: { companyId: company.id },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du profil de coûts:", error);
    return null;
  }
}

/**
 * Récupère tous les services de l'entreprise
 *
 * @returns {Promise<ServiceDefinition[]>}
 */
export async function getServices() {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      return [];
    }

    return await prisma.serviceDefinition.findMany({
      where: { companyId: company.id },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des services:", error);
    return [];
  }
}

/**
 * Analyse la rentabilité avec l'IA (GPT-4o)
 * Agit comme un expert comptable bienveillant pour donner des conseils
 *
 * @param calculation - Résultat du calcul de prix
 * @param costProfile - Profil de coûts
 * @param service - Définition du service
 * @returns {Promise<string>} Analyse textuelle de l'IA
 */
export async function analyzeProfitability(
  calculation: ServicePriceCalculation,
  costProfile: {
    monthlyFixedCosts: number;
    desiredMonthlySalary: number;
    socialChargesRate: number;
    workingDaysPerMonth: number;
    dailyHours: number;
    vacationWeeks: number;
  },
  service: {
    name: string;
    durationMinutes: number;
    materialCost: number;
    platformFees: number;
  }
): Promise<string> {
  try {
    // Vérification de la clé API OpenAI
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Clé API OpenAI non configurée");
    }

    // Construction du prompt pour l'IA
    const prompt = `Agis comme un expert comptable bienveillant et expérimenté. Analyse cette simulation de prix pour un entrepreneur.

CONTEXTE :
- Service : ${service.name}
- Durée : ${service.durationMinutes} minutes
- Coût matériel : ${service.materialCost.toFixed(2)} €
- Frais plateforme : ${service.platformFees}%

PROFIL DE COÛTS :
- Charges fixes mensuelles : ${costProfile.monthlyFixedCosts.toFixed(2)} €
- Salaire net souhaité : ${costProfile.desiredMonthlySalary.toFixed(2)} €/mois
- Charges sociales : ${costProfile.socialChargesRate}%
- Jours travaillés/mois : ${costProfile.workingDaysPerMonth}
- Heures/jour : ${costProfile.dailyHours}
- Semaines de congés/an : ${costProfile.vacationWeeks}

RÉSULTATS DU CALCUL :
- Coût horaire chargé : ${calculation.hourlyCost.toFixed(2)} €/h
- Coût de revient du service : ${calculation.serviceCost.toFixed(2)} €
- Prix minimum conseillé : ${calculation.minimumPrice.toFixed(2)} €
- Prix recommandé : ${calculation.recommendedPrice.toFixed(2)} €
- Clients nécessaires/mois : ${calculation.clientsNeededPerMonth}
- Heures de travail/mois : ${calculation.monthlyHoursNeeded.toFixed(1)}h
- Réaliste ? ${calculation.isRealistic ? "Oui" : "Non (risque de burnout)"}

DÉCOMPOSITION :
- Main d'œuvre : ${calculation.breakdown.laborCost.toFixed(2)} €
- Matériel : ${calculation.breakdown.materialCost.toFixed(2)} €
- Frais plateforme : ${calculation.breakdown.platformFees.toFixed(2)} €
- Marge : ${calculation.breakdown.margin.toFixed(2)} €
- Taxes estimées : ${calculation.breakdown.taxes.toFixed(2)} €

ANALYSE DEMANDÉE :
1. Est-ce que le prix de vente suggéré (${calculation.recommendedPrice.toFixed(2)} €) est réaliste par rapport au marché ?
2. Si le nombre de clients requis par mois (${calculation.clientsNeededPerMonth}) est trop élevé (plus de 150h de travail = ${calculation.monthlyHoursNeeded.toFixed(1)}h), alerte l'utilisateur qu'il va au burnout.
3. Donne 3 conseils concrets pour optimiser la rentabilité :
   - Augmenter le prix ? De combien ?
   - Réduire les frais ? Lesquels ?
   - Optimiser le temps de prestation ?
   - Autres suggestions pertinentes

Ton : Bienveillant, professionnel, concret. Utilise des exemples chiffrés. Sois encourageant mais réaliste.`;

    // Utilisation de l'API OpenAI via le SDK AI
    const { generateText } = await import("ai");
    
    const { text: analysis } = await generateText({
      model: openai("gpt-4o"),
      system: "Tu es un expert comptable bienveillant et expérimenté. Tu aides les entrepreneurs à fixer leurs prix de manière réaliste et rentable. Tu donnes des conseils concrets, chiffrés et actionnables.",
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 1000,
    });

    if (!analysis) {
      throw new Error("L'IA n'a pas pu générer d'analyse");
    }

    return analysis;
  } catch (error) {
    console.error("Erreur lors de l'analyse IA:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de l'analyse de la rentabilité"
    );
  }
}
