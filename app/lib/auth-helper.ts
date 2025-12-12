/**
 * Helper d'authentification Clerk ↔ Prisma
 *
 * Ce module gère la synchronisation automatique entre les utilisateurs Clerk
 * et la base de données Prisma/Supabase.
 *
 * Fonctionnalités :
 * - Récupération de l'utilisateur connecté via Clerk
 * - Création automatique de l'utilisateur dans Prisma à la première connexion
 * - Création d'une Company par défaut pour chaque nouvel utilisateur
 * - Mise en cache de l'utilisateur pour éviter les appels répétés
 */

import { prisma } from "@/app/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import type { Company, User } from "@prisma/client";
import { redirect } from "next/navigation";

/**
 * Type de retour de getAuthUser
 * Contient l'utilisateur et sa première company
 */
export type AuthenticatedUser = {
  user: User;
  company: Company;
};

/**
 * Récupère l'utilisateur authentifié et synchronise avec Prisma
 *
 * @returns {Promise<AuthenticatedUser>} L'utilisateur et sa company principale
 * @throws {Error} Si l'utilisateur n'est pas connecté ou en cas d'erreur DB
 *
 * @example
 * ```typescript
 * // Dans une Server Action
 * export async function getMyData() {
 *   const { user, company } = await getAuthUser();
 *
 *   // Utiliser user.id et company.id pour les requêtes
 *   const transactions = await prisma.transaction.findMany({
 *     where: { companyId: company.id }
 *   });
 * }
 * ```
 */
export async function getAuthUser(): Promise<AuthenticatedUser> {
  // 1. Récupérer l'utilisateur connecté depuis Clerk
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Utilisateur non connecté. Veuillez vous authentifier.");
  }

  // 2. Extraire les informations de Clerk
  const clerkUserId = clerkUser.id;
  const email =
    clerkUser.emailAddresses[0]?.emailAddress ||
    `user-${clerkUserId}@numera.ai`;
  const firstName = clerkUser.firstName || "";
  const lastName = clerkUser.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || email.split("@")[0];

  try {
    // 3. Vérifier si l'utilisateur existe déjà dans Prisma
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        companies: {
          orderBy: {
            createdAt: "asc", // La première company créée
          },
          take: 1,
        },
      },
    });

    // 4. Si l'utilisateur n'existe pas, le créer (première connexion)
    if (!user) {
      console.log(`🆕 Création du nouvel utilisateur Clerk: ${clerkUserId}`);

      // Transaction Prisma pour créer l'utilisateur ET sa company en une seule fois
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email,
          name,
          companies: {
            create: {
              name: "Ma Société", // Nom par défaut
              currency: "EUR",
            },
          },
        },
        include: {
          companies: {
            orderBy: {
              createdAt: "asc",
            },
            take: 1,
          },
        },
      });

      console.log(`✅ Utilisateur créé avec succès: ${user.id}`);
      console.log(`✅ Company créée: ${user.companies[0]?.id}`);
    }

    // 5. Vérifier que l'utilisateur a bien une company
    if (!user.companies || user.companies.length === 0) {
      // Cas rare : l'utilisateur existe mais n'a pas de company
      // (peut arriver si les données ont été corrompues ou supprimées manuellement)
      console.warn(`⚠️ Utilisateur ${user.id} sans company, création...`);

      const company = await prisma.company.create({
        data: {
          name: "Ma Société",
          currency: "EUR",
          userId: user.id,
        },
      });

      user.companies = [company];
    }

    // 6. Retourner l'utilisateur et sa company principale
    return {
      user,
      company: user.companies[0],
    };
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de l'utilisateur:", error);
    throw new Error(
      "Erreur lors de la synchronisation de l'utilisateur. Veuillez réessayer."
    );
  }
}

/**
 * Récupère uniquement l'ID de la company active de l'utilisateur
 *
 * Utilitaire rapide pour les cas où on n'a besoin que du companyId
 *
 * @returns {Promise<string>} L'ID de la company active
 * @throws {Error} Si l'utilisateur n'est pas connecté
 *
 * @example
 * ```typescript
 * export async function createTransaction(data: TransactionData) {
 *   const companyId = await getAuthCompanyId();
 *
 *   return prisma.transaction.create({
 *     data: {
 *       ...data,
 *       companyId,
 *     },
 *   });
 * }
 * ```
 */
export async function getAuthCompanyId(): Promise<string> {
  const { company } = await getAuthUser();
  return company.id;
}

/**
 * Récupère l'utilisateur authentifié et synchronise avec Prisma
 * REDIRIGE VERS /sign-in si l'utilisateur n'est pas connecté
 *
 * Cette fonction est similaire à getAuthUser() mais redirige automatiquement
 * au lieu de lancer une erreur. Utilisez-la dans les Server Components ou
 * Server Actions où vous voulez une redirection automatique.
 *
 * @returns {Promise<User & { companies: Company[] }>} L'utilisateur avec ses companies
 * @throws {never} Ne lance jamais d'erreur, redirige toujours si non connecté
 *
 * @example
 * ```typescript
 * // Dans un Server Component
 * export default async function DashboardPage() {
 *   const user = await getCurrentUser(); // Redirige si non connecté
 *
 *   // Utiliser user.id et user.companies pour les requêtes
 *   return <div>Bienvenue {user.name}</div>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Dans une Server Action
 * export async function updateProfile(data: ProfileData) {
 *   const user = await getCurrentUser(); // Redirige si non connecté
 *
 *   return prisma.user.update({
 *     where: { id: user.id },
 *     data,
 *   });
 * }
 * ```
 */
export async function getCurrentUser(): Promise<
  User & { companies: Company[] }
> {
  // 1. Récupérer l'utilisateur connecté depuis Clerk
  const clerkUser = await currentUser();

  // 2. Si pas connecté -> Rediriger vers /sign-in
  if (!clerkUser) {
    redirect("/sign-in");
  }

  // 3. Extraire les informations de Clerk
  const clerkUserId = clerkUser.id;
  const email =
    clerkUser.emailAddresses[0]?.emailAddress ||
    `user-${clerkUserId}@numera.ai`;
  const firstName = clerkUser.firstName || "";
  const lastName = clerkUser.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || email.split("@")[0];

  try {
    // 4. Vérifier si l'utilisateur existe déjà dans Prisma
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        companies: {
          orderBy: {
            createdAt: "asc", // La première company créée
          },
        },
      },
    });

    // 5. CAS 1 : L'utilisateur existe déjà -> Retourner avec ses companies
    if (user) {
      // Vérifier que l'utilisateur a au moins une company
      if (!user.companies || user.companies.length === 0) {
        // Cas rare : l'utilisateur existe mais n'a pas de company
        // Créer une company par défaut
        console.warn(`⚠️ Utilisateur ${user.id} sans company, création...`);

        const company = await prisma.company.create({
          data: {
            name: "Ma Société",
            currency: "EUR",
            legalForm: "EI",
            isAutoEntrepreneur: true,
            userId: user.id,
          },
        });

        user.companies = [company];
      }

      return user;
    }

    // 6. CAS 2 : Nouvel utilisateur -> Créer l'utilisateur ET une company par défaut
    console.log(`🆕 Création du nouvel utilisateur Clerk: ${clerkUserId}`);

    user = await prisma.user.create({
      data: {
        clerkUserId,
        email,
        name,
        companies: {
          create: {
            name: "Ma Société", // Nom par défaut
            currency: "EUR",
            legalForm: "EI", // Entreprise Individuelle par défaut
            isAutoEntrepreneur: true, // Auto-entrepreneur par défaut
          },
        },
      },
      include: {
        companies: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    console.log(`✅ Utilisateur créé avec succès: ${user.id}`);
    console.log(`✅ Company créée: ${user.companies[0]?.id}`);

    return user;
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de l'utilisateur:", error);
    throw new Error(
      "Erreur lors de la synchronisation de l'utilisateur. Veuillez réessayer."
    );
  }
}

/**
 * Vérifie si l'utilisateur est authentifié (sans lever d'erreur)
 *
 * Utile pour les composants qui doivent afficher différents contenus
 * selon l'état d'authentification
 *
 * @returns {Promise<boolean>} True si l'utilisateur est connecté
 *
 * @example
 * ```typescript
 * export async function getPublicData() {
 *   const isAuth = await isAuthenticated();
 *
 *   if (isAuth) {
 *     return getPrivateData();
 *   } else {
 *     return getPublicData();
 *   }
 * }
 * ```
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const clerkUser = await currentUser();
    return !!clerkUser;
  } catch {
    return false;
  }
}
