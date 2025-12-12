"use server";

/**
 * Server Actions pour la gestion des Clients (CRM)
 *
 * Ce module permet de :
 * - Récupérer la liste des clients avec statistiques (total facturé, nombre de factures)
 * - Créer ou mettre à jour un client
 * - Supprimer un client (avec vérification des factures associées)
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { revalidatePath } from "next/cache";

/**
 * Type pour les données d'un client avec statistiques agrégées
 */
export type ClientWithStats = {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  siret: string | null;
  vatIntra: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Statistiques agrégées
  totalInvoiced: number; // Total TTC facturé à ce client
  invoiceCount: number; // Nombre de factures pour ce client
};

/**
 * Type pour les données d'un client (création/modification)
 */
export type ClientData = {
  name: string;
  email?: string;
  address?: string;
  siret?: string;
  vatIntra?: string;
};

/**
 * Récupère tous les clients de l'utilisateur connecté avec leurs statistiques
 *
 * Calcule automatiquement :
 * - totalInvoiced : Somme des montants TTC de toutes les factures du client
 * - invoiceCount : Nombre de factures associées au client
 *
 * @returns {Promise<ClientWithStats[]>} Liste des clients avec leurs statistiques
 * @throws {Error} Si l'utilisateur n'est pas connecté ou en cas d'erreur DB
 *
 * @example
 * ```typescript
 * const clients = await getClients();
 * // clients = [{ id: "...", name: "Acme Corp", totalInvoiced: 5000, invoiceCount: 3, ... }]
 * ```
 */
export async function getClients(): Promise<ClientWithStats[]> {
  try {
    // 1. Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;
    console.log(`📋 Récupération des clients pour company: ${companyId}`);

    // 2. Récupération des clients avec leurs factures
    const clients = await prisma.client.findMany({
      where: {
        companyId,
      },
      include: {
        invoices: {
          include: {
            rows: true, // Inclure les lignes pour calculer les totaux
          },
        },
      },
      orderBy: {
        name: "asc", // Tri alphabétique par nom
      },
    });

    // 3. Calcul des statistiques pour chaque client
    const clientsWithStats: ClientWithStats[] = clients.map((client) => {
      // Calcul du total facturé (TTC) : somme de tous les montants TTC des factures
      const totalInvoiced = client.invoices.reduce((total, invoice) => {
        // Calcul du montant TTC de chaque facture
        const invoiceTotal = invoice.rows.reduce((invoiceSum, row) => {
          const lineTotal = Number(row.quantity) * Number(row.unitPrice);
          const vatAmount = lineTotal * (Number(row.vatRate) / 100);
          return invoiceSum + lineTotal + vatAmount;
        }, 0);
        return total + invoiceTotal;
      }, 0);

      // Nombre de factures
      const invoiceCount = client.invoices.length;

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        address: client.address,
        siret: client.siret,
        vatIntra: client.vatIntra,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100, // Arrondi à 2 décimales
        invoiceCount,
      };
    });

    console.log(`✅ ${clientsWithStats.length} clients récupérés avec statistiques`);

    return clientsWithStats;
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des clients:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la récupération des clients"
    );
  }
}

/**
 * Crée ou met à jour un client
 *
 * Si un ID est fourni, met à jour le client existant.
 * Sinon, crée un nouveau client.
 *
 * @param data - Données du client (si id est fourni, c'est une mise à jour)
 * @param id - ID du client à mettre à jour (optionnel, si absent = création)
 * @returns {Promise<{ success: true; clientId: string }>} Succès avec l'ID du client
 * @throws {Error} Si l'utilisateur n'est pas connecté, si les données sont invalides, ou en cas d'erreur DB
 *
 * @example
 * ```typescript
 * // Création
 * const result = await upsertClient({ name: "Acme Corp", email: "contact@acme.com" });
 *
 * // Mise à jour
 * const result = await upsertClient({ name: "Acme Corp Updated", email: "new@acme.com" }, existingClientId);
 * ```
 */
export async function upsertClient(
  data: ClientData,
  id?: string
): Promise<{ success: true; clientId: string }> {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    // 2. Validation des données
    if (!data.name || data.name.trim().length === 0) {
      throw new Error("Le nom du client est obligatoire");
    }

    // 3. Préparation des données (convertir les valeurs vides en null)
    const clientData = {
      name: data.name.trim(),
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      siret: data.siret?.trim() || null,
      vatIntra: data.vatIntra?.trim() || null,
      companyId,
    };

    // 4. Création ou mise à jour
    let client;
    if (id) {
      // Mise à jour : Vérifier que le client appartient bien à l'entreprise de l'utilisateur
      const existingClient = await prisma.client.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!existingClient) {
        throw new Error("Client non trouvé ou non autorisé");
      }

      console.log(`✏️ Mise à jour du client: ${id}`);
      client = await prisma.client.update({
        where: { id },
        data: clientData,
      });
    } else {
      // Création
      console.log(`➕ Création d'un nouveau client: ${clientData.name}`);
      client = await prisma.client.create({
        data: clientData,
      });
    }

    console.log(`✅ Client ${id ? "mis à jour" : "créé"} avec succès: ${client.id}`);

    // 5. Revalidation du cache pour mettre à jour la page
    revalidatePath("/clients");

    return {
      success: true,
      clientId: client.id,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la création/mise à jour du client:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la sauvegarde du client"
    );
  }
}

/**
 * Supprime un client
 *
 * Vérifie d'abord si le client a des factures associées.
 * Si oui, empêche la suppression et lance une erreur explicite.
 * Si non, supprime le client.
 *
 * @param id - ID du client à supprimer
 * @returns {Promise<{ success: true }>} Succès de la suppression
 * @throws {Error} Si le client a des factures associées, s'il n'est pas trouvé, ou en cas d'erreur DB
 *
 * @example
 * ```typescript
 * try {
 *   await deleteClient(clientId);
 *   // Client supprimé avec succès
 * } catch (error) {
 *   // Le client a des factures, impossible de le supprimer
 * }
 * ```
 */
export async function deleteClient(id: string): Promise<{ success: true }> {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    // 2. Vérifier que le client existe et appartient à l'entreprise de l'utilisateur
    const client = await prisma.client.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        invoices: {
          select: {
            id: true, // On a juste besoin de savoir s'il y en a
          },
        },
      },
    });

    if (!client) {
      throw new Error("Client non trouvé ou non autorisé");
    }

    // 3. Vérifier si le client a des factures associées
    if (client.invoices.length > 0) {
      throw new Error(
        `Impossible de supprimer ce client car il a ${client.invoices.length} facture(s) associée(s). Supprimez d'abord les factures ou archivez le client.`
      );
    }

    // 4. Suppression du client
    console.log(`🗑️ Suppression du client: ${id}`);
    await prisma.client.delete({
      where: { id },
    });

    console.log(`✅ Client supprimé avec succès: ${id}`);

    // 5. Revalidation du cache pour mettre à jour la page
    revalidatePath("/clients");

    return { success: true };
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du client:", error);

    // Si c'est une erreur Prisma de contrainte (onDelete: Restrict), on la transforme
    if (error instanceof Error) {
      // L'erreur peut venir de la contrainte onDelete: Restrict dans le schéma
      if (error.message.includes("restrict") || error.message.includes("constraint")) {
        throw new Error(
          "Impossible de supprimer ce client car il a des factures associées. Supprimez d'abord les factures."
        );
      }
      throw error;
    }

    throw new Error("Erreur lors de la suppression du client");
  }
}

