"use server";

/**
 * Server Actions pour la synchronisation Stripe
 * Importe les transactions Stripe dans la base de données
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { IntegrationProvider, TransactionCategory, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";

/**
 * Type de retour de la synchronisation
 */
export type SyncResult = {
  success: true;
  syncedCount: number;
  skippedCount: number;
  errors: string[];
};

/**
 * Synchronise les transactions Stripe avec la base de données
 *
 * Logique :
 * 1. Récupère la clé API de l'utilisateur
 * 2. Appelle l'API Stripe balanceTransactions.list()
 * 3. Pour chaque transaction :
 *    - Vérifie si elle existe déjà (via stripe_id)
 *    - Si nouvelle, crée la transaction Prisma
 *    - Convertit les montants (centimes → euros)
 *    - Détermine le type (INCOME/EXPENSE) et la catégorie
 *
 * @returns {Promise<SyncResult>} Résultat de la synchronisation
 */
export async function syncStripeTransactions(): Promise<SyncResult> {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // 2. Récupération de l'intégration Stripe
    const integration = await prisma.integration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: IntegrationProvider.STRIPE,
        },
      },
    });

    if (!integration) {
      throw new Error("Aucune intégration Stripe trouvée. Connectez d'abord votre compte Stripe.");
    }

    console.log(`🔄 Début synchronisation Stripe pour user: ${user.id}`);

    // 3. Initialisation du client Stripe
    const stripe = new Stripe(integration.apiKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // 4. Récupération des transactions Stripe (balanceTransactions = flux d'argent réel)
    const balanceTransactions = await stripe.balanceTransactions.list({
      limit: 100, // Limite à 100 transactions (peut être paginé plus tard)
    });

    console.log(`📊 ${balanceTransactions.data.length} transactions Stripe récupérées`);

    // 5. Traitement de chaque transaction
    let syncedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const stripeTx of balanceTransactions.data) {
      try {
        // Vérification si la transaction existe déjà (dédoublonner via stripe_id)
        const existingTransaction = await prisma.transaction.findUnique({
          where: {
            stripeId: stripeTx.id,
          },
        });

        if (existingTransaction) {
          console.log(`⏭️ Transaction ${stripeTx.id} déjà importée, ignorée`);
          skippedCount++;
          continue;
        }

        // Conversion du montant (Stripe est en centimes)
        // balanceTransactions.amount est toujours positif, on utilise le type pour déterminer
        const amountInEuros = Math.abs(stripeTx.amount) / 100;

        // Détermination du type selon le type de transaction Stripe
        // Les types comme 'charge', 'payment', 'transfer' sont des INCOME
        // Les types comme 'payout', 'refund', 'adjustment' peuvent être des EXPENSE
        // Les frais Stripe sont toujours des EXPENSE
        let transactionType: TransactionType;
        if (
          stripeTx.type === "stripe_fee" ||
          stripeTx.type === "payout" ||
          stripeTx.type === "refund" ||
          stripeTx.type === "adjustment"
        ) {
          transactionType = TransactionType.EXPENSE;
        } else {
          // Par défaut, les autres types (charge, payment, transfer, etc.) sont des INCOME
          transactionType = TransactionType.INCOME;
        }

        // Détermination de la catégorie
        let category: TransactionCategory = TransactionCategory.AUTRE;
        
        // Si c'est des frais Stripe
        if (stripeTx.type === "stripe_fee" || stripeTx.description?.toLowerCase().includes("stripe fee")) {
          category = TransactionCategory.IMPOTS; // Ou FRAIS_BANCAIRES si on l'ajoute
        } else if (isIncome) {
          // Si c'est une entrée, c'est probablement une vente
          category = TransactionCategory.PRESTATION;
        }

        // Description : utilise la description Stripe ou un fallback
        const description =
          stripeTx.description ||
          `${stripeTx.type} - ${stripeTx.id.substring(0, 8)}` ||
          "Transaction Stripe";

        // Conversion de la date (timestamp Stripe → Date)
        const transactionDate = new Date(stripeTx.created * 1000);

        // Création de la transaction Prisma
        await prisma.transaction.create({
          data: {
            date: transactionDate,
            amount: amountInEuros,
            description,
            type: transactionType,
            category,
            status: "COMPLETED", // Les transactions Stripe sont toujours complétées
            stripeId: stripeTx.id, // Pour dédoublonner
            companyId: company.id,
          },
        });

        console.log(`✅ Transaction ${stripeTx.id} importée: ${amountInEuros}€ (${transactionType})`);
        syncedCount++;
      } catch (txError) {
        const errorMsg = `Erreur transaction ${stripeTx.id}: ${
          txError instanceof Error ? txError.message : "Erreur inconnue"
        }`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // 6. Mise à jour de lastSyncedAt
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        lastSyncedAt: new Date(),
      },
    });

    console.log(
      `✅ Synchronisation terminée : ${syncedCount} importées, ${skippedCount} ignorées, ${errors.length} erreurs`
    );

    // 7. Revalidation du cache
    revalidatePath("/transactions");
    revalidatePath("/");

    return {
      success: true,
      syncedCount,
      skippedCount,
      errors,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation Stripe:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la synchronisation des transactions Stripe"
    );
  }
}
