"use server";

/**
 * Server Actions pour les Intégrations externes (Stripe, PayPal, etc.)
 * Permet la connexion et la gestion des intégrations
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { syncStripeTransactions } from "./sync-stripe";

/**
 * Type pour une intégration avec son statut
 */
export type IntegrationWithStatus = {
  id: string;
  provider: IntegrationProvider;
  accountId: string | null;
  lastSyncedAt: Date | null;
  isConnected: boolean;
};

/**
 * Vérifie si une clé API Stripe est valide en appelant l'API
 *
 * @param apiKey - Clé API Stripe (Restricted Key)
 * @returns {Promise<{ valid: boolean; accountId?: string; error?: string }>}
 */
async function validateStripeApiKey(
  apiKey: string
): Promise<{ valid: boolean; accountId?: string; error?: string }> {
  try {
    const stripe = new Stripe(apiKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // Test de la clé en récupérant les informations du compte
    const account = await stripe.accounts.retrieve();
    
    return {
      valid: true,
      accountId: account.id,
    };
  } catch (error) {
    console.error("❌ Erreur validation clé Stripe:", error);
    
    // Si accounts.retrieve() échoue, essayons balance.retrieve() (pour les clés de test)
    try {
      const stripe = new Stripe(apiKey, {
        apiVersion: "2024-12-18.acacia",
      });
      await stripe.balance.retrieve();
      
      return {
        valid: true,
        accountId: "test_account", // Pour les clés de test, on n'a pas d'account ID
      };
    } catch (balanceError) {
      return {
        valid: false,
        error:
          error instanceof Error
            ? error.message
            : "Clé API invalide ou expirée",
      };
    }
  }
}

/**
 * Connecte un compte Stripe à l'utilisateur
 *
 * @param apiKey - Clé API Stripe (Restricted Key)
 * @returns {Promise<{ success: true; integrationId: string }>}
 * @throws {Error} Si la clé est invalide ou en cas d'erreur
 */
export async function connectStripe(
  apiKey: string
): Promise<{ success: true; integrationId: string }> {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    // 2. Validation de la clé API
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("La clé API est requise");
    }

    console.log("🔍 Validation de la clé API Stripe...");
    const validation = await validateStripeApiKey(apiKey.trim());

    if (!validation.valid) {
      throw new Error(
        validation.error || "Clé API Stripe invalide. Vérifiez votre clé."
      );
    }

    console.log(`✅ Clé API valide, accountId: ${validation.accountId || "N/A"}`);

    // 3. Vérification si une intégration existe déjà pour cet utilisateur
    const existingIntegration = await prisma.integration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: IntegrationProvider.STRIPE,
        },
      },
    });

    // 4. Création ou mise à jour de l'intégration
    let integration;
    if (existingIntegration) {
      console.log(`✏️ Mise à jour de l'intégration Stripe existante: ${existingIntegration.id}`);
      integration = await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          apiKey: apiKey.trim(),
          accountId: validation.accountId || null,
          lastSyncedAt: null, // Réinitialiser la dernière sync
        },
      });
    } else {
      console.log(`➕ Création d'une nouvelle intégration Stripe pour user: ${user.id}`);
      integration = await prisma.integration.create({
        data: {
          userId: user.id,
          provider: IntegrationProvider.STRIPE,
          apiKey: apiKey.trim(),
          accountId: validation.accountId || null,
        },
      });
    }

    console.log(`✅ Intégration Stripe ${existingIntegration ? "mise à jour" : "créée"}: ${integration.id}`);

    // 5. Revalidation du cache
    revalidatePath("/settings/integrations");

    return {
      success: true,
      integrationId: integration.id,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la connexion Stripe:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la connexion à Stripe"
    );
  }
}

/**
 * Déconnecte un compte Stripe
 *
 * @returns {Promise<{ success: true }>}
 */
export async function disconnectStripe(): Promise<{ success: true }> {
  try {
    const user = await getCurrentUser();

    const integration = await prisma.integration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: IntegrationProvider.STRIPE,
        },
      },
    });

    if (!integration) {
      throw new Error("Aucune intégration Stripe trouvée");
    }

    await prisma.integration.delete({
      where: { id: integration.id },
    });

    console.log(`✅ Intégration Stripe supprimée: ${integration.id}`);

    revalidatePath("/settings/integrations");

    return { success: true };
  } catch (error) {
    console.error("❌ Erreur lors de la déconnexion Stripe:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la déconnexion de Stripe"
    );
  }
}

/**
 * Récupère les intégrations de l'utilisateur connecté
 *
 * @returns {Promise<IntegrationWithStatus[]>}
 */
export async function getIntegrations(): Promise<IntegrationWithStatus[]> {
  try {
    const user = await getCurrentUser();

    const integrations = await prisma.integration.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        provider: true,
        accountId: true,
        lastSyncedAt: true,
      },
    });

    return integrations.map((integration) => ({
      id: integration.id,
      provider: integration.provider,
      accountId: integration.accountId,
      lastSyncedAt: integration.lastSyncedAt,
      isConnected: true, // Si elle existe, elle est connectée
    }));
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des intégrations:", error);
    return [];
  }
}

// Export de la fonction de synchronisation pour utilisation dans le composant client
export { syncStripeTransactions };
