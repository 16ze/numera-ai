'use server'

import { prisma } from '@/app/lib/prisma';
import { getCurrentUser } from '@/app/lib/auth-helper';
import Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { IntegrationProvider, TransactionCategory, TransactionType } from '@prisma/client';

export async function syncStripeData() {
  console.log("🚀 Démarrage de la synchro Stripe...");

  try {
    // 1. Récupérer l'utilisateur et sa clé
    const user = await getCurrentUser();
    if (!user) throw new Error("Utilisateur non connecté");

    const company = user.companies[0];
    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    const integration = await prisma.integration.findFirst({
      where: { userId: user.id, provider: IntegrationProvider.STRIPE }
    });

    if (!integration || !integration.apiKey) {
      console.error("❌ Pas d'intégration Stripe trouvée");
      return { error: "Pas de clé API Stripe configurée" };
    }

    console.log("🔑 Clé trouvée (fin) : ...", integration.apiKey.slice(-4));

    // 2. Initialiser Stripe
    const stripe = new Stripe(integration.apiKey, {
        apiVersion: '2024-12-18.acacia' as any, // Utilise la version la plus récente ou celle par défaut
    });

    // 3. Récupérer les transactions (Balance Transactions)
    // On récupère jusqu'à 100 transactions pour avoir toutes les données
    console.log("📡 Appel à l'API Stripe balanceTransactions.list()...");
    
    let allTransactions: Stripe.BalanceTransaction[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    // Pagination pour récupérer toutes les transactions
    while (hasMore && allTransactions.length < 100) {
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
    }

    console.log(`📦 Total: ${allTransactions.length} transactions Stripe récupérées`);

    if (allTransactions.length === 0) {
        console.warn("⚠️ Aucune transaction trouvée chez Stripe.");
        console.warn("💡 Vérifications:");
        console.warn("   - La clé API est-elle correcte ?");
        console.warn("   - Y a-t-il des paiements dans votre compte Stripe ?");
        console.warn("   - Les paiements sont-ils bien 'capturés' ?");
        return { success: true, count: 0, message: "Aucune transaction trouvée" };
    }

    let addedCount = 0;
    let skippedCount = 0;

    // 4. Boucle sur les transactions
    for (const txn of allTransactions) {
      console.log(`🔍 Traitement transaction ${txn.id} - Type: ${txn.type}, Montant: ${txn.amount} cts, Description: ${txn.description || 'N/A'}`);

      // Vérifier si elle existe déjà via stripeId (dédoublonner)
      const existing = await prisma.transaction.findUnique({
        where: { 
            stripeId: txn.id
        }
      });

      if (!existing) {
        // Conversion du montant (centimes → euros)
        const amountInEuros = Math.abs(txn.amount / 100);

        // Détermination du type selon le type de transaction Stripe
        let transactionType: TransactionType;
        if (
          txn.type === "stripe_fee" ||
          txn.type === "payout" ||
          txn.type === "refund" ||
          txn.type === "adjustment"
        ) {
          transactionType = TransactionType.EXPENSE;
        } else {
          // Par défaut, les autres types (charge, payment, transfer, etc.) sont des INCOME
          transactionType = TransactionType.INCOME;
        }

        // Détermination de la catégorie
        let category: TransactionCategory = TransactionCategory.AUTRE;
        if (txn.type === "stripe_fee" || txn.description?.toLowerCase().includes("stripe fee")) {
          category = TransactionCategory.IMPOTS; // Frais Stripe = impôts/taxes
        } else if (transactionType === TransactionType.INCOME) {
          category = TransactionCategory.PRESTATION; // Ventes = prestations
        }

        await prisma.transaction.create({
          data: {
            companyId: company.id,
            date: new Date(txn.created * 1000),
            description: txn.description || `Virement Stripe ${txn.id}`,
            amount: amountInEuros,
            type: transactionType,
            category: category,
            status: 'COMPLETED',
            stripeId: txn.id, // Pour dédoublonner
          }
        });
        console.log(`✅ Transaction créée: ${txn.id} - ${amountInEuros}€ (${transactionType})`);
        addedCount++;
      } else {
        console.log(`⏭️ Transaction ${txn.id} déjà existante, ignorée.`);
        skippedCount++;
      }
    }

    console.log(`📊 Résumé: ${addedCount} ajoutées, ${skippedCount} déjà existantes`);

    await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncedAt: new Date() }
    });

    revalidatePath('/');
    revalidatePath('/transactions');
    
    return { 
      success: true, 
      count: addedCount,
      skipped: skippedCount,
      total: allTransactions.length,
      message: `${addedCount} transaction(s) importée(s) sur ${allTransactions.length} trouvée(s)`
    };

  } catch (error: any) {
    console.error("❌ ERREUR CRITIQUE:", error);
    return { error: error.message };
  }
}
