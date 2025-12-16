"use server";

/**
 * Server Actions pour le Simulateur de Rentabilité Avancé
 * Calcule le coût de revient précis d'une prestation en tenant compte de tous les coûts
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Résultat du calcul de rentabilité d'un service
 */
export interface ServiceProfitabilityResult {
  // Coûts détaillés
  suppliesCost: number; // Coût des consommables
  equipmentCost: number; // Coût d'amortissement du matériel
  laborCost: number; // Coût de la main d'œuvre
  overheadCost: number; // Quote-part des charges fixes
  totalCost: number; // Coût de revient total (break-even)

  // Détails pour affichage
  breakdown: {
    supplies: Array<{
      name: string;
      quantityUsed: number;
      unitCost: number;
      totalCost: number;
    }>;
    equipment: Array<{
      name: string;
      costPerService: number;
    }>;
    overhead: {
      totalMonthlyFixed: number;
      estimatedMonthlyServices: number;
      costPerService: number;
    };
  };

  // Calculs de marge (si prix de vente fourni)
  sellingPrice?: number;
  netMargin?: number;
  marginPercent?: number;
}

/**
 * Calcule la rentabilité précise d'un service
 *
 * Algorithme :
 * 1. Coût Consommables : (Prix d'achat / Quantité totale) * Quantité utilisée
 * 2. Coût Matériel : Prix d'achat / (Durée de vie * 4.33 * Utilisations/semaine)
 * 3. Coût Main d'Œuvre : (Temps en minutes / 60) * Coût horaire
 * 4. Coût Charges Fixes : Total mensuel / Nombre estimé de prestations/mois
 *
 * @param serviceRecipeId - ID de la recette de service
 * @param sellingPrice - Prix de vente envisagé (optionnel, pour calculer la marge)
 * @returns {Promise<ServiceProfitabilityResult>} Résultat détaillé du calcul
 */
export async function calculateServiceProfitability(
  serviceRecipeId: string,
  sellingPrice?: number
): Promise<ServiceProfitabilityResult> {
  try {
    // 1. Récupération de l'utilisateur et de l'entreprise
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // 2. Récupération de la recette de service avec toutes ses relations
    const serviceRecipe = await prisma.serviceRecipe.findUnique({
      where: { id: serviceRecipeId },
      include: {
        suppliesUsed: {
          include: {
            supply: true,
          },
        },
        equipmentUsed: {
          include: {
            equipment: true,
          },
        },
      },
    });

    if (!serviceRecipe) {
      throw new Error("Recette de service non trouvée");
    }

    if (serviceRecipe.companyId !== company.id) {
      throw new Error("Cette recette ne vous appartient pas");
    }

    // 3. CALCUL DU COÛT DES CONSOMMABLES
    // ============================================
    let suppliesCost = 0;
    const suppliesBreakdown = serviceRecipe.suppliesUsed.map(
      (serviceSupply) => {
        const supply = serviceSupply.supply;
        const unitCost = supply.purchasePrice / supply.totalQuantity; // Coût unitaire
        const totalCost = unitCost * serviceSupply.quantityUsed; // Coût pour cette quantité

        suppliesCost += totalCost;

        return {
          name: supply.name,
          quantityUsed: serviceSupply.quantityUsed,
          unitCost: Math.round(unitCost * 10000) / 10000, // 4 décimales
          totalCost: Math.round(totalCost * 100) / 100,
        };
      }
    );

    // 4. CALCUL DU COÛT D'AMORTISSEMENT DU MATÉRIEL
    // ============================================
    let equipmentCost = 0;
    const equipmentBreakdown = serviceRecipe.equipmentUsed.map(
      (serviceEquipment) => {
        const equipment = serviceEquipment.equipment;
        // Coût par prestation = Prix / (Durée de vie en mois * 4.33 semaines/mois * Utilisations/semaine)
        const costPerService =
          equipment.purchasePrice /
          (equipment.lifespanMonths * 4.33 * equipment.weeklyUses);

        equipmentCost += costPerService;

        return {
          name: equipment.name,
          costPerService: Math.round(costPerService * 100) / 100,
        };
      }
    );

    // 5. CALCUL DU COÛT DE LA MAIN D'ŒUVRE
    // ============================================
    const laborCost =
      (serviceRecipe.laborTimeMinutes / 60) * serviceRecipe.laborHourlyCost;

    // 6. CALCUL DU COÛT DES CHARGES FIXES (ALLOCATION)
    // ============================================
    // Récupération des charges fixes (type FIXED uniquement)
    const fixedOverheads = await prisma.overhead.findMany({
      where: {
        companyId: company.id,
        category: "FIXED",
      },
    });

    const totalMonthlyFixedCosts = fixedOverheads.reduce(
      (sum, overhead) => sum + overhead.monthlyCost,
      0
    );

    // Estimation du nombre de prestations par mois
    // Basé sur le temps de travail disponible et la durée du service
    // On suppose 20 jours/mois * 7h/jour = 140h/mois disponibles
    const monthlyWorkingHours = 140; // Heures de travail disponibles par mois
    const serviceDurationHours = serviceRecipe.laborTimeMinutes / 60;
    const estimatedMonthlyServices =
      serviceDurationHours > 0
        ? Math.floor(monthlyWorkingHours / serviceDurationHours)
        : 0;

    const overheadCostPerService =
      estimatedMonthlyServices > 0
        ? totalMonthlyFixedCosts / estimatedMonthlyServices
        : 0;

    // 7. CALCUL DU COÛT DE REVIENT TOTAL
    // ============================================
    const totalCost =
      suppliesCost + equipmentCost + laborCost + overheadCostPerService;

    // 8. CALCUL DE LA MARGE (si prix de vente fourni)
    // ============================================
    let netMargin: number | undefined;
    let marginPercent: number | undefined;

    if (sellingPrice !== undefined && sellingPrice !== null) {
      netMargin = sellingPrice - totalCost;
      marginPercent = totalCost > 0 ? (netMargin / sellingPrice) * 100 : 0;
    }

    // 9. RETOUR DU RÉSULTAT
    return {
      suppliesCost: Math.round(suppliesCost * 100) / 100,
      equipmentCost: Math.round(equipmentCost * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      overheadCost: Math.round(overheadCostPerService * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown: {
        supplies: suppliesBreakdown,
        equipment: equipmentBreakdown,
        overhead: {
          totalMonthlyFixed: Math.round(totalMonthlyFixedCosts * 100) / 100,
          estimatedMonthlyServices,
          costPerService: Math.round(overheadCostPerService * 100) / 100,
        },
      },
      sellingPrice,
      netMargin:
        netMargin !== undefined ? Math.round(netMargin * 100) / 100 : undefined,
      marginPercent:
        marginPercent !== undefined
          ? Math.round(marginPercent * 100) / 100
          : undefined,
    };
  } catch (error) {
    console.error("Erreur lors du calcul de rentabilité:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors du calcul de rentabilité du service"
    );
  }
}

/**
 * Récupère toutes les ressources (supplies, equipment, overheads) de l'entreprise
 */
export async function getResources() {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      return {
        supplies: [],
        equipment: [],
        overheads: [],
      };
    }

    const [supplies, equipment, overheads] = await Promise.all([
      prisma.supply.findMany({
        where: { companyId: company.id },
        orderBy: { name: "asc" },
      }),
      prisma.equipment.findMany({
        where: { companyId: company.id },
        orderBy: { name: "asc" },
      }),
      prisma.overhead.findMany({
        where: { companyId: company.id },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      supplies,
      equipment,
      overheads,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des ressources:", error);
    return {
      supplies: [],
      equipment: [],
      overheads: [],
    };
  }
}

/**
 * Récupère toutes les recettes de service de l'entreprise
 */
export async function getServiceRecipes() {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      return [];
    }

    return await prisma.serviceRecipe.findMany({
      where: { companyId: company.id },
      include: {
        suppliesUsed: {
          include: {
            supply: true,
          },
        },
        equipmentUsed: {
          include: {
            equipment: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des recettes:", error);
    return [];
  }
}

/**
 * Calcule la rentabilité globale de toutes les prestations
 * @param sellingPrices - Objet avec les prix de vente par recette ID { [recipeId]: price }
 * @returns Résultat agrégé de toutes les prestations
 */
export async function calculateGlobalProfitability(sellingPrices?: {
  [recipeId: string]: number;
}) {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // Récupérer toutes les recettes
    const recipes = await prisma.serviceRecipe.findMany({
      where: { companyId: company.id },
      include: {
        suppliesUsed: {
          include: {
            supply: true,
          },
        },
        equipmentUsed: {
          include: {
            equipment: true,
          },
        },
      },
    });

    if (recipes.length === 0) {
      return {
        totalCost: 0,
        totalRevenue: 0,
        totalMargin: 0,
        averageMarginPercent: 0,
        recipesCount: 0,
        breakdown: [],
      };
    }

    let totalCost = 0;
    let totalRevenue = 0;
    const breakdown: Array<{
      recipeId: string;
      recipeName: string;
      cost: number;
      revenue: number;
      margin: number;
      marginPercent: number;
    }> = [];

    // Calculer pour chaque recette
    for (const recipe of recipes) {
      const recipeResult = await calculateServiceProfitability(
        recipe.id,
        sellingPrices?.[recipe.id]
      );

      totalCost += recipeResult.totalCost;
      if (recipeResult.sellingPrice) {
        totalRevenue += recipeResult.sellingPrice;
      }

      breakdown.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        cost: recipeResult.totalCost,
        revenue: recipeResult.sellingPrice || 0,
        margin: recipeResult.netMargin || -recipeResult.totalCost,
        marginPercent: recipeResult.marginPercent || 0,
      });
    }

    const totalMargin = totalRevenue - totalCost;
    const averageMarginPercent =
      totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      averageMarginPercent: Math.round(averageMarginPercent * 100) / 100,
      recipesCount: recipes.length,
      breakdown,
    };
  } catch (error) {
    console.error("Erreur lors du calcul global:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors du calcul de rentabilité globale"
    );
  }
}

/**
 * Crée ou met à jour une ressource (Supply, Equipment, Overhead)
 */
export async function upsertResource(
  type: "supply" | "equipment" | "overhead",
  data: any
) {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    const commonData = {
      companyId: company.id,
      ...data,
    };

    if (type === "supply") {
      if (data.id) {
        await prisma.supply.update({
          where: { id: data.id },
          data: {
            name: data.name,
            supplier: data.supplier,
            purchasePrice: data.purchasePrice,
            totalQuantity: data.totalQuantity,
            unit: data.unit,
          },
        });
      } else {
        await prisma.supply.create({
          data: commonData,
        });
      }
    } else if (type === "equipment") {
      if (data.id) {
        await prisma.equipment.update({
          where: { id: data.id },
          data: {
            name: data.name,
            supplier: data.supplier,
            purchasePrice: data.purchasePrice,
            lifespanMonths: data.lifespanMonths,
            weeklyUses: data.weeklyUses,
          },
        });
      } else {
        await prisma.equipment.create({
          data: commonData,
        });
      }
    } else if (type === "overhead") {
      if (data.id) {
        await prisma.overhead.update({
          where: { id: data.id },
          data: {
            name: data.name,
            monthlyCost: data.monthlyCost,
            category: data.category,
          },
        });
      } else {
        await prisma.overhead.create({
          data: commonData,
        });
      }
    }

    revalidatePath("/simulator");
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de la ressource:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la sauvegarde de la ressource"
    );
  }
}

/**
 * Crée ou met à jour une recette de service
 */
export async function upsertServiceRecipe(data: {
  id?: string;
  name: string;
  laborTimeMinutes: number;
  laborHourlyCost: number;
  supplyIds?: Array<{ supplyId: string; quantityUsed: number }>;
  equipmentIds?: string[];
}) {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    if (data.id) {
      // Mise à jour
      const serviceRecipe = await prisma.serviceRecipe.update({
        where: { id: data.id },
        data: {
          name: data.name,
          laborTimeMinutes: data.laborTimeMinutes,
          laborHourlyCost: data.laborHourlyCost,
        },
      });

      // Mise à jour des consommables
      if (data.supplyIds) {
        // Supprimer les anciennes relations
        await prisma.serviceSupply.deleteMany({
          where: { serviceRecipeId: data.id },
        });

        // Créer les nouvelles relations
        await prisma.serviceSupply.createMany({
          data: data.supplyIds.map((s) => ({
            serviceRecipeId: data.id!,
            supplyId: s.supplyId,
            quantityUsed: s.quantityUsed,
          })),
        });
      }

      // Mise à jour du matériel
      if (data.equipmentIds) {
        // Supprimer les anciennes relations
        await prisma.serviceEquipment.deleteMany({
          where: { serviceRecipeId: data.id },
        });

        // Créer les nouvelles relations
        await prisma.serviceEquipment.createMany({
          data: data.equipmentIds.map((equipmentId) => ({
            serviceRecipeId: data.id!,
            equipmentId,
          })),
        });
      }

      revalidatePath("/simulator");
      return { success: true, serviceRecipeId: serviceRecipe.id };
    } else {
      // Création
      const serviceRecipe = await prisma.serviceRecipe.create({
        data: {
          companyId: company.id,
          name: data.name,
          laborTimeMinutes: data.laborTimeMinutes,
          laborHourlyCost: data.laborHourlyCost,
        },
      });

      // Création des relations consommables
      if (data.supplyIds && data.supplyIds.length > 0) {
        await prisma.serviceSupply.createMany({
          data: data.supplyIds.map((s) => ({
            serviceRecipeId: serviceRecipe.id,
            supplyId: s.supplyId,
            quantityUsed: s.quantityUsed,
          })),
        });
      }

      // Création des relations matériel
      if (data.equipmentIds && data.equipmentIds.length > 0) {
        await prisma.serviceEquipment.createMany({
          data: data.equipmentIds.map((equipmentId) => ({
            serviceRecipeId: serviceRecipe.id,
            equipmentId,
          })),
        });
      }

      revalidatePath("/simulator");
      return { success: true, serviceRecipeId: serviceRecipe.id };
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de la recette:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la sauvegarde de la recette"
    );
  }
}

/**
 * Supprime une ressource (Supply, Equipment, Overhead)
 */
export async function deleteResource(
  type: "supply" | "equipment" | "overhead",
  id: string
) {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // Vérifier que la ressource appartient à l'entreprise
    if (type === "supply") {
      const supply = await prisma.supply.findUnique({
        where: { id },
      });
      if (!supply || supply.companyId !== company.id) {
        throw new Error("Ressource non trouvée ou non autorisée");
      }
      // Supprimer les relations dans ServiceSupply
      await prisma.serviceSupply.deleteMany({
        where: { supplyId: id },
      });
      await prisma.supply.delete({
        where: { id },
      });
    } else if (type === "equipment") {
      const equipment = await prisma.equipment.findUnique({
        where: { id },
      });
      if (!equipment || equipment.companyId !== company.id) {
        throw new Error("Ressource non trouvée ou non autorisée");
      }
      // Supprimer les relations dans ServiceEquipment
      await prisma.serviceEquipment.deleteMany({
        where: { equipmentId: id },
      });
      await prisma.equipment.delete({
        where: { id },
      });
    } else if (type === "overhead") {
      const overhead = await prisma.overhead.findUnique({
        where: { id },
      });
      if (!overhead || overhead.companyId !== company.id) {
        throw new Error("Ressource non trouvée ou non autorisée");
      }
      await prisma.overhead.delete({
        where: { id },
      });
    }

    revalidatePath("/simulator");
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression de la ressource:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la suppression de la ressource"
    );
  }
}

/**
 * Supprime une recette de service
 */
export async function deleteServiceRecipe(id: string) {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // Vérifier que la recette appartient à l'entreprise
    const serviceRecipe = await prisma.serviceRecipe.findUnique({
      where: { id },
    });

    if (!serviceRecipe || serviceRecipe.companyId !== company.id) {
      throw new Error("Recette non trouvée ou non autorisée");
    }

    // Supprimer les relations
    await prisma.serviceSupply.deleteMany({
      where: { serviceRecipeId: id },
    });
    await prisma.serviceEquipment.deleteMany({
      where: { serviceRecipeId: id },
    });

    // Supprimer la recette
    await prisma.serviceRecipe.delete({
      where: { id },
    });

    revalidatePath("/simulator");
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression de la recette:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la suppression de la recette"
    );
  }
}
