/**
 * Utilitaires pour les calculs de factures
 * Fonctions pures (non-async) pour les calculs
 */

import type { InvoiceWithRelations } from "../actions/invoices";

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

