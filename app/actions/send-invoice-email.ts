"use server";

/**
 * Server Actions pour l'envoi de factures par email via Resend
 */

import { Resend } from "resend";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { InvoiceEmail } from "@/components/emails/InvoiceEmail";
import { render } from "@react-email/render";

/**
 * Initialise le client Resend de manière lazy
 * Cela garantit que la variable d'environnement est chargée
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY manquante. Configurez cette variable d'environnement dans .env.local"
    );
  }
  
  return new Resend(apiKey);
}

/**
 * Envoie une facture par email au client
 *
 * @param invoiceId - ID de la facture à envoyer
 * @returns {Promise<{ success: true; messageId: string }>} ID du message envoyé
 * @throws {Error} Si la facture n'existe pas, si le client n'a pas d'email, ou en cas d'erreur d'envoi
 */
export async function sendInvoiceEmail(
  invoiceId: string
): Promise<{ success: true; messageId: string }> {
  try {
    // 1. Initialisation du client Resend avec la clé API
    const resend = getResendClient();

    // 2. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const company = user.companies[0];

    // 3. Récupération de la facture avec toutes ses relations
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        rows: true,
      },
    });

    if (!invoice) {
      throw new Error("Facture non trouvée");
    }

    console.log(`📧 Envoi facture ${invoice.number} pour ${invoice.client.name}`);

    // 4. Vérification que la facture appartient à l'entreprise de l'utilisateur
    if (invoice.companyId !== company.id) {
      throw new Error("Cette facture ne vous appartient pas");
    }

    // 5. Vérification que le client a un email
    if (!invoice.client.email) {
      throw new Error(
        `Le client "${invoice.client.name}" n'a pas d'adresse email. Veuillez ajouter un email au client avant d'envoyer la facture.`
      );
    }

    // 6. Calcul du montant total TTC
    const totalHT = invoice.rows.reduce(
      (sum, row) => sum + Number(row.quantity) * Number(row.unitPrice),
      0
    );

    const totalVAT = invoice.rows.reduce(
      (sum, row) =>
        sum +
        Number(row.quantity) *
          Number(row.unitPrice) *
          (Number(row.vatRate) / 100),
      0
    );

    const totalTTC = totalHT + totalVAT;

    // 7. Récupération de l'URL de base (pour production, utiliser une variable d'environnement)
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 8. Génération du HTML de l'email avec React Email
    const emailHtml = await render(
      InvoiceEmail({
        clientName: invoice.client.name,
        invoiceNumber: invoice.number,
        totalAmount: totalTTC,
        invoiceId: invoice.id,
        companyName: invoice.company.name,
        companyLogoUrl: invoice.company.logoUrl,
        baseUrl,
      })
    );

    // 9. Envoi de l'email via Resend
    // Utilisation de l'adresse de test Resend pour le développement
    const { data, error } = await resend.emails.send({
      from: "Numera AI <onboarding@resend.dev>",
      to: invoice.client.email,
      subject: `Votre facture ${invoice.number} est disponible`,
      html: emailHtml,
    });

    if (error) {
      console.error("❌ Erreur Resend:", error);
      throw new Error(
        `Erreur lors de l'envoi de l'email : ${error.message || "Erreur inconnue"}`
      );
    }

    if (!data?.id) {
      throw new Error("L'email n'a pas pu être envoyé (pas d'ID retourné)");
    }

    console.log(
      `✅ Email de facture envoyé à ${invoice.client.email} (messageId: ${data.id})`
    );

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email de facture:", error);
    throw error instanceof Error
      ? error
      : new Error("Erreur lors de l'envoi de l'email");
  }
}

