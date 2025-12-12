"use server";

/**
 * Server Actions pour l'export comptable (CSV)
 *
 * Ce module permet de générer un export comptable CSV pour l'expert-comptable
 * en unifiant les factures et transactions d'une année donnée.
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { InvoiceStatus, TransactionType } from "@prisma/client";

/**
 * Type pour une ligne d'export comptable
 */
type AccountingEntry = {
  date: string; // Format YYYY-MM-DD
  type: "VENTE" | "ACHAT";
  tiers: string;
  description: string;
  montant_ht: number;
  tva: number;
  montant_ttc: number;
};

/**
 * Génère un export comptable CSV pour une année donnée
 *
 * Récupère toutes les factures (status != DRAFT) et toutes les transactions de l'année,
 * les unifie dans un format comptable standard et génère un CSV.
 *
 * @param year - Année à exporter (ex: 2025)
 * @returns {Promise<string>} String CSV avec BOM UTF-8, séparateur point-virgule
 * @throws {Error} Si l'utilisateur n'est pas connecté ou en cas d'erreur DB
 *
 * @example
 * ```typescript
 * const csv = await generateAccountingExport(2025);
 * // Retourne le CSV prêt à télécharger
 * ```
 */
export async function generateAccountingExport(
  year: number
): Promise<string> {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;
    console.log(`📊 Génération export comptable pour l'année ${year}, company: ${companyId}`);

    // 2. Définition des dates de début et fin d'année
    const startDate = new Date(year, 0, 1); // 1er janvier à 00:00:00
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999); // 31 décembre à 23:59:59

    console.log(
      `📅 Période: du ${startDate.toISOString()} au ${endDate.toISOString()}`
    );

    // 3. Récupération des factures (status != DRAFT) de l'année
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: {
          not: InvoiceStatus.DRAFT, // Exclure les brouillons
        },
        issuedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        client: {
          select: {
            name: true,
          },
        },
        rows: true, // Inclure les lignes pour calculer les montants
      },
      orderBy: {
        issuedDate: "asc",
      },
    });

    console.log(`📄 ${invoices.length} facture(s) trouvée(s)`);

    // 4. Récupération des transactions de l'année
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        type: TransactionType.EXPENSE, // Seulement les dépenses (les recettes sont dans les factures)
      },
      orderBy: {
        date: "asc",
      },
    });

    console.log(`💸 ${transactions.length} transaction(s) trouvée(s)`);

    // 5. Transformation des factures en entrées comptables
    const invoiceEntries: AccountingEntry[] = invoices.flatMap((invoice) => {
      // Calcul des totaux pour chaque facture
      const totalHT = invoice.rows.reduce(
        (sum, row) =>
          sum + Number(row.quantity) * Number(row.unitPrice),
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

      // Création d'une description à partir des lignes
      const descriptions = invoice.rows.map(
        (row) => `${row.description} (${row.quantity}x)`
      );
      const description = descriptions.join(" | ") || `Facture ${invoice.number}`;

      return {
        date: invoice.issuedDate.toISOString().split("T")[0], // Format YYYY-MM-DD
        type: "VENTE" as const,
        tiers: invoice.client.name,
        description: description,
        montant_ht: Math.round(totalHT * 100) / 100,
        tva: Math.round(totalVAT * 100) / 100,
        montant_ttc: Math.round(totalTTC * 100) / 100,
      };
    });

    // 6. Transformation des transactions (dépenses) en entrées comptables
    const transactionEntries: AccountingEntry[] = transactions.map(
      (transaction) => {
        const amount = Number(transaction.amount);

        // Pour les dépenses, le montant est négatif
        // On considère qu'il n'y a pas de TVA récupérable (sinon il faudrait un champ TVA dans Transaction)
        // Si besoin, on peut ajouter un champ tvaAmount dans le modèle Transaction plus tard

        return {
          date: transaction.date.toISOString().split("T")[0], // Format YYYY-MM-DD
          type: "ACHAT" as const,
          tiers: transaction.description || transaction.category, // Description ou catégorie comme tiers
          description: transaction.description || `Transaction ${transaction.category}`,
          montant_ht: -Math.round(amount * 100) / 100, // Négatif pour les dépenses
          tva: 0, // Pas de TVA pour les transactions (ou à calculer si besoin)
          montant_ttc: -Math.round(amount * 100) / 100, // Négatif pour les dépenses
        };
      }
    );

    // 7. Unification et tri par date
    const allEntries: AccountingEntry[] = [
      ...invoiceEntries,
      ...transactionEntries,
    ].sort((a, b) => {
      // Tri par date (du plus ancien au plus récent)
      return a.date.localeCompare(b.date);
    });

    console.log(`✅ ${allEntries.length} entrée(s) comptable(s) générée(s)`);

    // 8. Génération du CSV
    // En-têtes
    const headers = [
      "Date",
      "Type",
      "Tiers",
      "Description",
      "Montant HT",
      "TVA",
      "Montant TTC",
    ];

    // Lignes de données
    const rows = allEntries.map((entry) => [
      entry.date,
      entry.type,
      entry.tiers,
      entry.description.replace(/;/g, ","), // Remplacer les ; par des , dans la description pour éviter les problèmes CSV
      entry.montant_ht.toFixed(2).replace(".", ","), // Format français (virgule)
      entry.tva.toFixed(2).replace(".", ","),
      entry.montant_ttc.toFixed(2).replace(".", ","),
    ]);

    // Fonction pour échapper les valeurs CSV si nécessaire
    const escapeCSV = (value: string): string => {
      // Si la valeur contient des guillemets, des sauts de ligne ou des points-virgules, on l'entoure de guillemets
      if (value.includes('"') || value.includes("\n") || value.includes(";")) {
        return `"${value.replace(/"/g, '""')}"`; // Échapper les guillemets doubles
      }
      return value;
    };

    // Assemblage du CSV
    const csvLines = [
      headers.join(";"), // En-têtes avec séparateur point-virgule
      ...rows.map((row) => row.map(escapeCSV).join(";")), // Lignes de données
    ];

    const csvContent = csvLines.join("\n");

    // 9. Ajout du BOM UTF-8 au début pour Excel (gestion des accents)
    const csvWithBOM = "\uFEFF" + csvContent;

    console.log(`✅ CSV généré avec succès (${csvWithBOM.length} caractères)`);

    return csvWithBOM;
  } catch (error) {
    console.error("❌ Erreur lors de la génération de l'export comptable:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la génération de l'export comptable"
    );
  }
}

