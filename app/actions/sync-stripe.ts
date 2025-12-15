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
    // Pagination pour récupérer toutes les transactions
    console.log("📡 Appel à l'API Stripe balanceTransactions.list()...");
    
    let allTransactions: Stripe.BalanceTransaction[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;
    const maxTransactions = 100; // Limite pour éviter les timeouts

    // Pagination pour récupérer toutes les transactions
    while (hasMore && allTransactions.length < maxTransactions) {
      const response = await stripe.balanceTransactions.list({
        limit: 100,
        starting_after: startingAfter,
      });

      allTransactions = [...allTransactions, ...response.data];
      hasMore = response.has_more;
      
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      }

      console.log(`📦 Récupéré ${allTransactions.length} transactions (hasMore: ${hasMore})`);
      
      // Si on a récupéré moins que la limite, pas besoin de continuer
      if (response.data.length < 100) {
        hasMore = false;
      }
    }

    console.log(`📊 Total: ${allTransactions.length} transactions Stripe récupérées`);

    if (allTransactions.length === 0) {
      console.warn("⚠️ Aucune transaction trouvée chez Stripe.");
      console.warn("💡 Vérifications:");
      console.warn("   - La clé API est-elle correcte ? (sk_test_... ou sk_live_...)");
      console.warn("   - Y a-t-il des paiements dans votre compte Stripe ?");
      console.warn("   - Les paiements sont-ils bien 'capturés' ?");
      console.warn("   - Pour les clés de test, créez un paiement de test dans Stripe Dashboard");
      
      // Essayer aussi de récupérer les charges pour debug
      try {
        const charges = await stripe.charges.list({ limit: 5 });
        console.log(`🔍 Debug: ${charges.data.length} charge(s) trouvée(s) dans le compte`);
        if (charges.data.length > 0) {
          console.log(`   Exemple: Charge ${charges.data[0].id} - ${charges.data[0].amount / 100}€`);
        }
      } catch (chargeError) {
        console.error("❌ Erreur lors de la récupération des charges:", chargeError);
      }
    }

    // 5. Traitement de chaque transaction
    let syncedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const stripeTx of allTransactions) {
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
          category = TransactionCategory.IMPOTS; // Frais Stripe = impôts/taxes
        } else if (transactionType === TransactionType.INCOME) {
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

        console.log(`✅ Transaction ${stripeTx.id} importée: ${amountInEuros}€ (${transactionType}) - Type: ${stripeTx.type}, Description: ${description}`);
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
