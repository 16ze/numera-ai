"use server";

/**
 * Server Actions pour les Factures
 * Récupère les factures de l'utilisateur connecté via Clerk
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { InvoiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Type pour une facture avec ses relations
 */
export type InvoiceWithRelations = {
  id: string;
  number: string;
  issuedDate: Date;
  dueDate: Date | null;
  status: InvoiceStatus;
  client: {
    id: string;
    name: string;
    email: string | null;
  };
  rows: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>;
};

/**
 * Server Action pour récupérer toutes les factures de l'utilisateur connecté
 * 
 * @returns {Promise<InvoiceWithRelations[]>} Liste des factures avec client et lignes
 */
export async function getInvoices(): Promise<InvoiceWithRelations[]> {
  try {
    // Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    // Récupération de la première company de l'utilisateur
    const company = user.companies[0];

    if (!company) {
      console.warn(`⚠️ Utilisateur ${user.id} sans company, retour de liste vide`);
      return [];
    }

    // Récupération des factures avec leurs relations
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: company.id,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        rows: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            vatRate: true,
          },
        },
      },
      orderBy: {
        issuedDate: "desc", // Plus récentes en premier
      },
    });

    // Calcul du montant total pour chaque facture
    return invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      issuedDate: invoice.issuedDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      client: invoice.client,
      rows: invoice.rows.map((row) => ({
        id: row.id,
        description: row.description,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
        vatRate: Number(row.vatRate),
      })),
    }));
  } catch (error) {
    console.error("Erreur lors de la récupération des factures:", error);
    throw error;
  }
}


/**
 * Type pour une facture complète avec toutes ses relations
 */
export type InvoiceDetail = {
  id: string;
  number: string;
  issuedDate: Date;
  dueDate: Date | null;
  status: InvoiceStatus;
  company: {
    id: string;
    name: string;
    siret: string | null;
    vatNumber: string | null;
    address: string | null;
    logoUrl: string | null;
  };
  client: {
    id: string;
    name: string;
    email: string | null;
    address: string | null;
    siret: string | null;
    vatIntra: string | null;
  };
  rows: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>;
};

/**
 * Server Action pour récupérer une facture spécifique par son ID
 * SÉCURITÉ : Vérifie que la facture appartient à l'entreprise de l'utilisateur connecté
 * 
 * @param invoiceId - ID de la facture à récupérer
 * @returns {Promise<InvoiceDetail>} La facture avec toutes ses relations
 * @throws {Error} Si la facture n'existe pas ou n'appartient pas à l'utilisateur
 */
export async function getInvoiceById(invoiceId: string): Promise<InvoiceDetail> {
  try {
    // Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    // Récupération de la première company de l'utilisateur
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    // Récupération de la facture avec toutes ses relations
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            siret: true,
            vatNumber: true,
            address: true,
            logoUrl: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
            siret: true,
            vatIntra: true,
          },
        },
        rows: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            vatRate: true,
          },
        },
      },
    });

    // SÉCURITÉ CRITIQUE : Vérifier que la facture existe et appartient à l'entreprise de l'utilisateur
    if (!invoice) {
      throw new Error("Facture non trouvée");
    }

    if (invoice.companyId !== company.id) {
      throw new Error("Cette facture ne vous appartient pas");
    }

    // Conversion des valeurs Decimal en nombre
    return {
      id: invoice.id,
      number: invoice.number,
      issuedDate: invoice.issuedDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      company: invoice.company,
      client: invoice.client,
      rows: invoice.rows.map((row) => ({
        id: row.id,
        description: row.description,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
        vatRate: Number(row.vatRate),
      })),
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de la facture:", error);
    throw error;
  }
}

/**
 * Server Action pour supprimer une facture
 * SÉCURITÉ : Vérifie que la facture appartient à l'entreprise de l'utilisateur connecté
 * 
 * @param invoiceId - ID de la facture à supprimer
 * @returns {Promise<{ success: boolean; message: string }>} Résultat de la suppression
 * @throws {Error} Si la facture n'existe pas ou n'appartient pas à l'utilisateur
 */
export async function deleteInvoice(invoiceId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    // Récupération de la première company de l'utilisateur
    const company = user.companies[0];

    if (!company) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    // Vérification que la facture existe et appartient à l'entreprise de l'utilisateur
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        number: true,
        companyId: true,
      },
    });

    if (!invoice) {
      throw new Error("Facture non trouvée");
    }

    // SÉCURITÉ CRITIQUE : Vérifier que la facture appartient à l'entreprise de l'utilisateur
    if (invoice.companyId !== company.id) {
      throw new Error("Cette facture ne vous appartient pas");
    }

    // Suppression de la facture (les InvoiceRow seront supprimées automatiquement via onDelete: Cascade)
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });

    console.log(`✅ Facture ${invoice.number} supprimée avec succès`);

    // Revalidation du cache pour mettre à jour la liste des factures
    revalidatePath("/invoices");

    return {
      success: true,
      message: `Facture ${invoice.number} supprimée avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de la facture:", error);
    throw error;
  }
}

