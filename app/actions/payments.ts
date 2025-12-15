"use server";

/**
 * Server Actions pour la gestion des paiements Stripe
 * Génération de liens de paiement pour les factures
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";

/**
 * Génère un lien de paiement Stripe pour une facture
 *
 * @param invoiceId - ID de la facture
 * @returns {Promise<{ success: true; paymentLink: string }>} URL du lien de paiement
 * @throws {Error} Si Stripe n'est pas connecté, si la facture n'existe pas, ou en cas d'erreur Stripe
 */
export async function generatePaymentLink(
  invoiceId: string
): Promise<{ success: true; paymentLink: string }> {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // 2. Vérification de la facture et sécurité
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        rows: true,
        client: true,
        company: true,
      },
    });

    if (!invoice) {
      throw new Error("Facture non trouvée");
    }

    // Vérification que la facture appartient à l'entreprise de l'utilisateur
    if (invoice.companyId !== company.id) {
      throw new Error("Cette facture ne vous appartient pas");
    }

    // Si un lien de paiement existe déjà, le retourner
    if (invoice.paymentLink) {
      console.log(`✅ Lien de paiement existant pour facture ${invoiceId}`);
      return {
        success: true,
        paymentLink: invoice.paymentLink,
      };
    }

    // 3. Récupération de la clé API Stripe
    const integration = await prisma.integration.findFirst({
      where: {
        userId: user.id,
        provider: IntegrationProvider.STRIPE,
      },
    });

    if (!integration || !integration.apiKey) {
      throw new Error(
        "Veuillez connecter votre compte Stripe dans les paramètres (Settings > Intégrations)"
      );
    }

    console.log(`🔑 Clé Stripe trouvée pour user: ${user.id}`);

    // 4. Initialisation du client Stripe
    const stripe = new Stripe(integration.apiKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // 5. Calcul du montant total TTC de la facture
    const totalHT = invoice.rows.reduce((sum, row) => {
      const lineTotal = Number(row.quantity) * Number(row.unitPrice);
      return sum + lineTotal;
    }, 0);

    const totalTTC = invoice.rows.reduce((sum, row) => {
      const lineTotal = Number(row.quantity) * Number(row.unitPrice);
      const vatAmount = lineTotal * (Number(row.vatRate) / 100);
      return sum + lineTotal + vatAmount;
    }, 0);

    // 6. Préparation des line_items pour Stripe Checkout
    const lineItems = invoice.rows.map((row) => {
      const lineTotal = Number(row.quantity) * Number(row.unitPrice);
      const vatAmount = lineTotal * (Number(row.vatRate) / 100);
      const lineTotalTTC = lineTotal + vatAmount;

      return {
        price_data: {
          currency: "eur",
          product_data: {
            name: row.description,
            description: `Facture ${invoice.number}`,
          },
          unit_amount: Math.round(lineTotalTTC * 100), // Conversion en centimes
        },
        quantity: 1,
      };
    });

    // Si la facture n'a pas de lignes, créer un item unique avec le total
    if (lineItems.length === 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: `Facture ${invoice.number}`,
            description: `Facture pour ${invoice.client.name}`,
          },
          unit_amount: Math.round(totalTTC * 100), // Conversion en centimes
        },
        quantity: 1,
      });
    }

    // 7. Récupération de l'URL de base de l'application
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    // 8. Création de la session Stripe Checkout
    console.log(`💳 Création session Stripe Checkout pour facture ${invoiceId}...`);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${baseUrl}/invoices/${invoiceId}?status=success`,
      cancel_url: `${baseUrl}/invoices/${invoiceId}`,
      customer_email: invoice.client.email || undefined,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        companyId: company.id,
      },
    });

    console.log(`✅ Session Stripe créée: ${session.id}`);

    // 9. Sauvegarde du lien de paiement dans la facture
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentLink: session.url || null,
        stripeSessionId: session.id,
      },
    });

    console.log(`✅ Lien de paiement sauvegardé pour facture ${invoiceId}`);

    // 10. Revalidation du cache
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");

    if (!session.url) {
      throw new Error("Erreur lors de la génération du lien de paiement Stripe");
    }

    return {
      success: true,
      paymentLink: session.url,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la génération du lien de paiement:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la génération du lien de paiement"
    );
  }
}

/**
 * Marque une facture comme payée
 * Appelée manuellement après confirmation du paiement (webhooks à implémenter plus tard)
 *
 * @param invoiceId - ID de la facture
 * @returns {Promise<{ success: true }>}
 */
export async function markInvoiceAsPaid(
  invoiceId: string
): Promise<{ success: true }> {
  try {
    const user = await getCurrentUser();
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // Vérification de la facture et sécurité
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error("Facture non trouvée");
    }

    if (invoice.companyId !== company.id) {
      throw new Error("Cette facture ne vous appartient pas");
    }

    // Mise à jour du statut
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
      },
    });

    console.log(`✅ Facture ${invoiceId} marquée comme payée`);

    // Revalidation du cache
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("❌ Erreur lors du marquage de la facture comme payée:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors du marquage de la facture comme payée"
    );
  }
}
