"use server";

/**
 * Server Actions pour l'intégration bancaire via Plaid
 * Gère la connexion des comptes bancaires et la synchronisation des transactions
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { plaidClient, APP_URL } from "@/app/lib/plaid";
import { CountryCode, Products } from "plaid";
import { revalidatePath } from "next/cache";

/**
 * Crée un Link Token pour initialiser Plaid Link
 * Le Link Token est utilisé côté client pour ouvrir la fenêtre de connexion bancaire
 *
 * @returns {Promise<{ linkToken: string }>} Le token pour initialiser Plaid Link
 * @throws {Error} Si l'utilisateur n'est pas connecté ou en cas d'erreur Plaid
 */
export async function createLinkToken(): Promise<{ linkToken: string }> {
  try {
    // Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    console.log("🔗 Création du Link Token Plaid pour user:", user.id);

    // Création du Link Token via l'API Plaid
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: user.id, // ID unique de l'utilisateur dans notre système
      },
      client_name: "Numera AI",
      products: [Products.Transactions], // On veut accéder aux transactions
      country_codes: [CountryCode.Us, CountryCode.Fr], // US et France
      language: "fr",
      // redirect_uri retiré car nécessite configuration OAuth dans le dashboard
      // L'utilisateur restera sur la même page après connexion
    });

    console.log("✅ Link Token créé avec succès");

    return {
      linkToken: response.data.link_token,
    };
  } catch (error) {
    console.error("❌ Erreur création Link Token:", error);
    
    // Log détaillé pour debugging
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      console.error("Détails erreur Plaid:", {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
    }
    
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la création du Link Token"
    );
  }
}

/**
 * Échange un Public Token contre un Access Token permanent
 * et sauvegarde le compte bancaire dans la base de données
 *
 * @param publicToken - Token public reçu après connexion Plaid Link
 * @returns {Promise<{ success: true; bankAccountId: string }>} ID du compte créé
 * @throws {Error} Si l'échange échoue ou en cas d'erreur DB
 */
export async function exchangePublicToken(
  publicToken: string
): Promise<{ success: true; bankAccountId: string }> {
  try {
    const user = await getCurrentUser();

    console.log("🔄 Échange du Public Token pour user:", user.id);

    // 1. Échange du Public Token contre un Access Token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    console.log("✅ Access Token obtenu, itemId:", itemId);

    // 2. Récupération des informations du compte
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const account = accountsResponse.data.accounts[0]; // Premier compte
    const institution = accountsResponse.data.item.institution_id;

    // 3. Récupération du nom de la banque
    let bankName = "Banque inconnue";
    if (institution) {
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institution,
          country_codes: [CountryCode.Us, CountryCode.Fr],
        });
        bankName = institutionResponse.data.institution.name;
      } catch (err) {
        console.warn("⚠️ Impossible de récupérer le nom de la banque:", err);
      }
    }

    // 4. Sauvegarde dans la base de données
    const bankAccount = await prisma.bankAccount.create({
      data: {
        userId: user.id,
        bankName,
        mask: account.mask || null,
        itemId,
        accessToken, // ⚠️ En production, chiffrer ce token
        cursor: null,
        lastSyncedAt: null,
      },
    });

    console.log("✅ Compte bancaire sauvegardé:", bankAccount.id);

    // 5. Revalidation
    revalidatePath("/settings/bank");

    return {
      success: true,
      bankAccountId: bankAccount.id,
    };
  } catch (error) {
    console.error("❌ Erreur échange Public Token:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de l'échange du token"
    );
  }
}

/**
 * Synchronise les transactions d'un compte bancaire
 * Utilise l'API Plaid Transactions Sync pour récupérer les nouvelles transactions
 *
 * @param bankAccountId - ID du compte bancaire à synchroniser
 * @returns {Promise<{ success: true; addedCount: number }>} Nombre de transactions ajoutées
 * @throws {Error} Si le compte n'existe pas ou en cas d'erreur Plaid
 */
export async function syncTransactions(
  bankAccountId: string
): Promise<{ success: true; addedCount: number }> {
  try {
    const user = await getCurrentUser();

    console.log("🔄 Synchronisation des transactions pour:", bankAccountId);

    // 1. Récupération du compte bancaire
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!bankAccount || bankAccount.userId !== user.id) {
      throw new Error("Compte bancaire non trouvé ou non autorisé");
    }

    // 2. Récupération de l'entreprise (pour lier les transactions)
    const company = user.companies[0];
    if (!company) {
      throw new Error("Aucune entreprise trouvée");
    }

    // 3. Synchronisation via Plaid
    let cursor = bankAccount.cursor || undefined;
    let hasMore = true;
    let addedCount = 0;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: bankAccount.accessToken,
        cursor,
      });

      const { added, has_more, next_cursor } = response.data;

      // 4. Insertion des nouvelles transactions
      for (const transaction of added) {
        // Plaid envoie les dépenses en positif, on inverse pour notre système
        const amount = Math.abs(transaction.amount);
        const type = transaction.amount > 0 ? "EXPENSE" : "INCOME";

        // Mapping de la catégorie Plaid vers notre système
        const category = mapPlaidCategory(transaction.category);

        await prisma.transaction.create({
          data: {
            amount,
            type,
            description: transaction.name,
            date: new Date(transaction.date),
            category,
            status: "COMPLETED",
            companyId: company.id,
          },
        });

        addedCount++;
      }

      cursor = next_cursor;
      hasMore = has_more;
    }

    // 5. Mise à jour du cursor et de la date de sync
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        cursor,
        lastSyncedAt: new Date(),
      },
    });

    console.log(`✅ ${addedCount} transactions ajoutées`);

    // 6. Revalidation
    revalidatePath("/settings/bank");
    revalidatePath("/transactions");
    revalidatePath("/");

    return {
      success: true,
      addedCount,
    };
  } catch (error) {
    console.error("❌ Erreur synchronisation transactions:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la synchronisation"
    );
  }
}

/**
 * Récupère la liste des comptes bancaires de l'utilisateur
 *
 * @returns {Promise<Array>} Liste des comptes bancaires
 */
export async function getBankAccounts() {
  try {
    const user = await getCurrentUser();

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return bankAccounts;
  } catch (error) {
    console.error("❌ Erreur récupération comptes bancaires:", error);
    throw new Error("Erreur lors de la récupération des comptes");
  }
}

/**
 * Supprime un compte bancaire
 *
 * @param bankAccountId - ID du compte à supprimer
 */
export async function deleteBankAccount(bankAccountId: string) {
  try {
    const user = await getCurrentUser();

    // Vérification que le compte appartient à l'utilisateur
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!bankAccount || bankAccount.userId !== user.id) {
      throw new Error("Compte non trouvé ou non autorisé");
    }

    // Suppression
    await prisma.bankAccount.delete({
      where: { id: bankAccountId },
    });

    console.log("✅ Compte bancaire supprimé:", bankAccountId);

    revalidatePath("/settings/bank");

    return { success: true };
  } catch (error) {
    console.error("❌ Erreur suppression compte bancaire:", error);
    throw new Error("Erreur lors de la suppression du compte");
  }
}

/**
 * Mappe une catégorie Plaid vers notre système de catégories
 */
function mapPlaidCategory(
  plaidCategories: string[] | null | undefined
): "TRANSPORT" | "REPAS" | "MATERIEL" | "PRESTATION" | "IMPOTS" | "SALAIRES" | "AUTRE" {
  if (!plaidCategories || plaidCategories.length === 0) {
    return "AUTRE";
  }

  const category = plaidCategories[0].toLowerCase();

  if (
    category.includes("transport") ||
    category.includes("travel") ||
    category.includes("gas") ||
    category.includes("parking")
  ) {
    return "TRANSPORT";
  }

  if (
    category.includes("food") ||
    category.includes("restaurant") ||
    category.includes("groceries")
  ) {
    return "REPAS";
  }

  if (
    category.includes("shops") ||
    category.includes("supplies") ||
    category.includes("hardware")
  ) {
    return "MATERIEL";
  }

  if (category.includes("service") || category.includes("professional")) {
    return "PRESTATION";
  }

  if (category.includes("tax") || category.includes("government")) {
    return "IMPOTS";
  }

  if (category.includes("payroll") || category.includes("salary")) {
    return "SALAIRES";
  }

  return "AUTRE";
}

