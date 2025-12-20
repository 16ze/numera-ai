"use server";

/**
 * Server Actions pour l'intégration bancaire via Plaid
 * Gère la connexion des comptes bancaires et la synchronisation des transactions
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { plaidClient } from "@/app/lib/plaid";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { CountryCode, Products } from "plaid";

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
    if (error && typeof error === "object" && "response" in error) {
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

    // 4. Récupération du solde initial et de la devise
    let currentBalance: number | null = null;
    let currency: string = "EUR";

    try {
      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: accessToken,
      });

      const balanceAccount = balanceResponse.data.accounts[0];
      if (balanceAccount) {
        const balance =
          balanceAccount.balances.available ?? balanceAccount.balances.current;
        if (balance !== null) {
          currentBalance = balance;
        }
        currency = balanceAccount.balances.iso_currency_code || "EUR";
      }
    } catch (balanceError) {
      console.warn(
        "⚠️ Impossible de récupérer le solde initial:",
        balanceError
      );
    }

    // 5. Sauvegarde dans la base de données
    const bankAccount = await prisma.bankAccount.create({
      data: {
        userId: user.id,
        bankName,
        mask: account.mask || null,
        type: "PLAID",
        itemId,
        accessToken, // ⚠️ En production, chiffrer ce token
        cursor: null,
        lastSyncedAt: null,
        currentBalance,
        currency,
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

    // 3. Récupération du solde actuel du compte via Plaid
    let currentBalance: number | null = null;
    let currency: string = "EUR";

    try {
      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: bankAccount.accessToken,
      });

      // Récupération du premier compte (ou du compte principal)
      const account = balanceResponse.data.accounts[0];
      if (account) {
        // Plaid retourne le solde disponible (available) ou le solde courant (current)
        // On utilise le solde disponible s'il existe, sinon le solde courant
        const balance = account.balances.available ?? account.balances.current;
        if (balance !== null) {
          currentBalance = balance;
        }
        // Récupération de la devise du compte
        currency = account.balances.iso_currency_code || "EUR";
      }
      console.log(`💰 Solde récupéré: ${currentBalance} ${currency}`);
    } catch (balanceError) {
      console.warn(
        "⚠️ Impossible de récupérer le solde du compte:",
        balanceError
      );
    }

    // 4. Synchronisation des transactions via Plaid
    let cursor = bankAccount.cursor || undefined;
    let hasMore = true;
    let addedCount = 0;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: bankAccount.accessToken,
        cursor,
      });

      const { added, has_more, next_cursor } = response.data;

      // 5. Insertion des nouvelles transactions
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

    // 6. Mise à jour du cursor, de la date de sync, du solde et de la devise
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        cursor,
        lastSyncedAt: new Date(),
        currentBalance,
        currency,
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
 * Crée un compte bancaire manuel
 *
 * @param name - Nom du compte (ex: "Caisse Épargne", "Compte Courant")
 * @param initialBalance - Solde initial du compte
 * @returns {Promise<{ success: true; bankAccountId: string }>} ID du compte créé
 */
export async function createManualAccount(
  name: string,
  initialBalance: number
): Promise<{ success: true; bankAccountId: string }> {
  try {
    const user = await getCurrentUser();

    console.log("📝 Création d'un compte bancaire manuel:", name);

    // Gestion robuste des champs qui pourraient ne pas exister si la migration n'a pas été appliquée
    const accountData: any = {
      userId: user.id,
      bankName: name,
      mask: null,
      itemId: null,
      accessToken: null,
      cursor: null,
      lastSyncedAt: null,
      currency: "EUR",
    };

    // Ajouter les champs optionnels seulement s'ils existent dans le schéma
    try {
      // Essayer d'abord avec tous les champs
      accountData.type = "MANUAL";
      accountData.currentBalance = initialBalance;

      const bankAccount = await prisma.bankAccount.create({
        data: accountData,
      });

      console.log("✅ Compte bancaire manuel créé:", bankAccount.id);

      revalidatePath("/settings/bank");
      revalidatePath("/");

      return {
        success: true,
        bankAccountId: bankAccount.id,
      };
    } catch (createError: any) {
      // Si l'erreur vient du champ 'type' ou 'currentBalance' manquant, essayer sans
      const errorMessage = createError?.message || String(createError);
      if (
        errorMessage.includes("type") ||
        errorMessage.includes("currentBalance") ||
        errorMessage.includes("Unknown argument") ||
        errorMessage.includes("Unknown field")
      ) {
        console.warn(
          "⚠️ Champs 'type' ou 'currentBalance' non disponibles, création sans ces champs"
        );

        // Retirer les champs problématiques
        delete accountData.type;
        delete accountData.currentBalance;

        // Créer sans ces champs
        const bankAccount = await prisma.bankAccount.create({
          data: accountData,
        });

        // Si currentBalance existe, essayer de le mettre à jour séparément
        if (initialBalance !== 0) {
          try {
            await prisma.bankAccount.update({
              where: { id: bankAccount.id },
              data: { currentBalance: initialBalance } as any,
            });
          } catch (updateError) {
            console.warn(
              "⚠️ Impossible de définir le solde initial:",
              updateError
            );
          }
        }

        console.log(
          "✅ Compte bancaire manuel créé (sans type/solde):",
          bankAccount.id
        );

        revalidatePath("/settings/bank");
        revalidatePath("/");

        return {
          success: true,
          bankAccountId: bankAccount.id,
        };
      }

      // Si c'est une autre erreur, la relancer
      throw createError;
    }
  } catch (error) {
    console.error("❌ Erreur création compte manuel:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la création du compte"
    );
  }
}

/**
 * Met à jour le solde d'un compte bancaire
 *
 * @param bankAccountId - ID du compte à mettre à jour
 * @param newBalance - Nouveau solde
 * @returns {Promise<{ success: true }>}
 */
export async function updateAccountBalance(
  bankAccountId: string,
  newBalance: number
): Promise<{ success: true }> {
  try {
    const user = await getCurrentUser();

    // Vérification que le compte appartient à l'utilisateur
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!bankAccount || bankAccount.userId !== user.id) {
      throw new Error("Compte non trouvé ou non autorisé");
    }

    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        currentBalance: newBalance,
      },
    });

    console.log(
      `✅ Solde mis à jour pour le compte ${bankAccountId}: ${newBalance}`
    );

    revalidatePath("/settings/bank");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("❌ Erreur mise à jour solde:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la mise à jour du solde"
    );
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
    revalidatePath("/"); // Rafraîchir le dashboard

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
):
  | "TRANSPORT"
  | "REPAS"
  | "MATERIEL"
  | "PRESTATION"
  | "IMPOTS"
  | "SALAIRES"
  | "AUTRE" {
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
