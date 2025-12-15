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
    // On demande les 10 dernières pour tester
    console.log("📡 Appel à l'API Stripe...");
    const balanceTransactions = await stripe.balanceTransactions.list({
      limit: 10,
    });

    console.log(`📦 Stripe a renvoyé ${balanceTransactions.data.length} transactions.`);

    if (balanceTransactions.data.length === 0) {
        console.warn("⚠️ Aucune transaction trouvée chez Stripe. Vérifiez si le paiement est bien 'capturé' et dispo dans le solde.");
        return { success: true, count: 0 };
    }

    let addedCount = 0;

    // 4. Boucle sur les transactions
    for (const txn of balanceTransactions.data) {
      console.log(`🔍 Traitement transaction ${txn.id} - Montant: ${txn.amount} cts`);

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
        console.log("✅ Transaction créée en base !");
        addedCount++;
      } else {
        console.log("Status: Déjà existante.");
      }
    }

    await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncedAt: new Date() }
    });

    revalidatePath('/');
    revalidatePath('/transactions');
    return { success: true, count: addedCount };

  } catch (error: any) {
    console.error("❌ ERREUR CRITIQUE:", error);
    return { error: error.message };
  }
}
