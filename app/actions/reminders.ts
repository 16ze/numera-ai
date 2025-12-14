"use server";

/**
 * Server Actions pour la gestion des relances de factures en retard
 * Le "Bad Cop" - Système de relance automatique
 */

import { Resend } from "resend";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

/**
 * Type pour une facture en retard
 */
export type OverdueInvoice = {
  id: string;
  number: string;
  clientName: string;
  clientEmail: string | null;
  totalAmount: number;
  dueDate: Date;
  daysOverdue: number;
};

/**
 * Initialise le client Resend de manière lazy
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
 * Récupère toutes les factures en retard
 * Une facture est en retard si :
 * - Son statut n'est PAS 'PAID'
 * - Sa date d'échéance (dueDate) est passée
 *
 * @returns {Promise<OverdueInvoice[]>} Liste des factures en retard avec le nombre de jours de retard
 */
export async function getOverdueInvoices(): Promise<OverdueInvoice[]> {
  try {
    // Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      return [];
    }

    const company = user.companies[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Début de la journée

    // Récupération des factures en retard
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        companyId: company.id,
        status: {
          not: "PAID", // Pas payée
        },
        dueDate: {
          lt: today, // Date d'échéance passée
        },
      },
      include: {
        client: {
          select: {
            name: true,
            email: true,
          },
        },
        rows: true,
      },
    });

    // Calcul du montant total et du nombre de jours de retard pour chaque facture
    const result: OverdueInvoice[] = overdueInvoices.map((invoice) => {
      // Calcul du montant total TTC
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

      // Calcul du nombre de jours de retard
      const dueDate = new Date(invoice.dueDate!);
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: invoice.id,
        number: invoice.number,
        clientName: invoice.client.name,
        clientEmail: invoice.client.email,
        totalAmount: totalTTC,
        dueDate: invoice.dueDate!,
        daysOverdue,
      };
    });

    // Tri par nombre de jours de retard décroissant (les plus en retard en premier)
    result.sort((a, b) => b.daysOverdue - a.daysOverdue);

    console.log(
      `📋 ${result.length} facture(s) en retard trouvée(s) pour l'entreprise ${company.id}`
    );

    return result;
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des factures en retard:", error);
    throw error instanceof Error
      ? error
      : new Error("Erreur lors de la récupération des factures en retard");
  }
}

/**
 * Génère un email de relance avec OpenAI
 * Le ton varie selon le nombre de jours de retard :
 * - < 15 jours : Courtois et rappel simple
 * - >= 15 jours : Ferme et insistant
 *
 * @param invoiceId - ID de la facture à relancer
 * @returns {Promise<{ subject: string; body: string }>} Sujet et corps de l'email généré
 */
export async function generateReminderEmail(
  invoiceId: string
): Promise<{ subject: string; body: string }> {
  try {
    // Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const company = user.companies[0];

    // Récupération de la facture
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: {
          select: {
            name: true,
            email: true,
          },
        },
        rows: true,
      },
    });

    if (!invoice) {
      throw new Error("Facture non trouvée");
    }

    // Vérification que la facture appartient à l'entreprise de l'utilisateur
    if (invoice.companyId !== company.id) {
      throw new Error("Cette facture ne vous appartient pas");
    }

    // Calcul du montant total TTC
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

    // Calcul du nombre de jours de retard
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.dueDate!);
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Détermination du ton selon le retard
    const tone =
      daysOverdue < 15
        ? "Courtois et rappel simple. Rappel amical de la facture en attente de paiement."
        : "Ferme et insistant. Demande urgente de régularisation du paiement.";

    // Prompt pour OpenAI
    const prompt = `Rédige un email de relance pour le client ${invoice.client.name} concernant la facture ${invoice.number} de ${totalTTC.toFixed(2)}€. Le retard est de ${daysOverdue} jour(s).

Ton : ${tone}

Format de réponse (JSON strict) :
{
  "subject": "[Sujet de l'email]",
  "body": "[Corps du mail en HTML ou texte, avec sauts de ligne \\n]"
}

Important :
- Le sujet doit être clair et professionnel
- Le corps doit être en français, professionnel mais adapté au ton demandé
- Inclure le numéro de facture et le montant
- Mentionner le nombre de jours de retard
- Pour un retard < 15 jours : rester courtois et amical
- Pour un retard >= 15 jours : être plus ferme et insistant sur l'urgence
- Ne pas utiliser de markdown dans le body, utiliser des sauts de ligne \\n`;

    console.log(
      `🤖 Génération email de relance pour facture ${invoice.number} (${daysOverdue} jours de retard)`
    );

    // Génération avec OpenAI
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt,
      temperature: 0.7,
    });

    // Parsing de la réponse JSON
    let emailData: { subject: string; body: string };
    try {
      // Nettoyage du texte (enlever les markdown code blocks si présents)
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      emailData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("❌ Erreur parsing JSON OpenAI:", parseError);
      // Fallback : génération manuelle si le parsing échoue
      emailData = {
        subject: `Relance - Facture ${invoice.number} en attente de paiement`,
        body: `Bonjour ${invoice.client.name},\n\nNous vous rappelons que la facture ${invoice.number} d'un montant de ${totalTTC.toFixed(2)}€ est en retard de ${daysOverdue} jour(s).\n\nNous vous remercions de bien vouloir procéder au règlement dans les plus brefs délais.\n\nCordialement,\n${company.name}`,
      };
    }

    console.log(
      `✅ Email de relance généré : "${emailData.subject}" (${emailData.body.length} caractères)`
    );

    return emailData;
  } catch (error) {
    console.error("❌ Erreur lors de la génération de l'email de relance:", error);
    throw error instanceof Error
      ? error
      : new Error("Erreur lors de la génération de l'email de relance");
  }
}

/**
 * Envoie un email de relance via Resend
 *
 * @param invoiceId - ID de la facture à relancer
 * @param subject - Sujet de l'email
 * @param body - Corps de l'email (peut être HTML ou texte)
 * @returns {Promise<{ success: true; messageId: string }>} ID du message envoyé
 */
export async function sendReminderEmail(
  invoiceId: string,
  subject: string,
  body: string
): Promise<{ success: true; messageId: string }> {
  try {
    // Initialisation du client Resend
    const resend = getResendClient();

    // Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const company = user.companies[0];

    // Récupération de la facture
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error("Facture non trouvée");
    }

    // Vérification que la facture appartient à l'entreprise de l'utilisateur
    if (invoice.companyId !== company.id) {
      throw new Error("Cette facture ne vous appartient pas");
    }

    // Vérification que le client a un email
    if (!invoice.client.email) {
      throw new Error(
        `Le client "${invoice.client.name}" n'a pas d'adresse email. Veuillez ajouter un email au client avant d'envoyer la relance.`
      );
    }

    console.log(
      `📧 Envoi relance facture ${invoice.number} à ${invoice.client.email}`
    );

    // Conversion du body en HTML si c'est du texte simple (avec sauts de ligne)
    const htmlBody = body
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Envoi de l'email via Resend
    const { data, error } = await resend.emails.send({
      from: "Numera AI <onboarding@resend.dev>",
      to: invoice.client.email,
      subject,
      html: htmlBody,
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
      `✅ Email de relance envoyé à ${invoice.client.email} (messageId: ${data.id})`
    );

    // Log de l'action (pour l'instant console.log, peut être étendu avec un historique)
    console.log(
      `📝 Relance envoyée - Facture: ${invoice.number}, Client: ${invoice.client.name}, Date: ${new Date().toISOString()}`
    );

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email de relance:", error);
    throw error instanceof Error
      ? error
      : new Error("Erreur lors de l'envoi de l'email de relance");
  }
}
