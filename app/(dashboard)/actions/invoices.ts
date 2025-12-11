/**
 * Server Actions pour les Factures
 * Récupère les factures de l'utilisateur connecté via Clerk
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { InvoiceStatus } from "@prisma/client";

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
 * Calcule le montant total HT d'une facture
 * 
 * @param rows - Lignes de la facture
 * @returns {number} Montant total HT
 */
export function calculateInvoiceTotal(rows: InvoiceWithRelations["rows"]): number {
  return rows.reduce((total, row) => {
    const lineTotal = row.quantity * row.unitPrice;
    return total + lineTotal;
  }, 0);
}

/**
 * Calcule le montant total TTC d'une facture
 * 
 * @param rows - Lignes de la facture
 * @returns {number} Montant total TTC
 */
export function calculateInvoiceTotalWithVat(rows: InvoiceWithRelations["rows"]): number {
  return rows.reduce((total, row) => {
    const lineTotal = row.quantity * row.unitPrice;
    const vatAmount = lineTotal * (row.vatRate / 100);
    return total + lineTotal + vatAmount;
  }, 0);
}

