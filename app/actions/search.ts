"use server";

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";

export async function searchGlobal(query: string) {
  // 1. Nettoyage et Sécurité
  if (!query || query.length < 2) {
    return { clients: [], invoices: [], documents: [], transactions: [] };
  }

  const user = await getCurrentUser();
  if (!user)
    return { clients: [], invoices: [], documents: [], transactions: [] };

  // On récupère la première entreprise de l'utilisateur (ou on adapte si multi-company)
  const companyId = user.companies[0]?.id;
  if (!companyId)
    return { clients: [], invoices: [], documents: [], transactions: [] };

  console.log(`🔍 Recherche pour "${query}" (User: ${user.email})...`);

  try {
    // 2. Lancement des recherches en parallèle
    const [clients, invoices, documents, transactions] = await Promise.all([
      // --- Clients ---
      prisma.client.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),

      // --- Factures ---
      prisma.invoice.findMany({
        where: {
          companyId,
          OR: [
            { number: { contains: query, mode: "insensitive" } },
            { client: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        include: { client: true },
        take: 5,
      }),

      // --- Documents ---
      prisma.document.findMany({
        where: {
          userId: user.id, // Les documents sont souvent liés au User, vérifie ton schema
          name: { contains: query, mode: "insensitive" },
        },
        take: 5,
      }),

      // --- Transactions ---
      prisma.transaction.findMany({
        where: {
          companyId,
          description: { contains: query, mode: "insensitive" },
        },
        take: 5,
      }),
    ]);

    console.log(
      `✅ Résultats : ${clients.length} clients, ${invoices.length} factures, ${documents.length} docs, ${transactions.length} transactions.`
    );

    return { clients, invoices, documents, transactions };
  } catch (error) {
    console.error("❌ Erreur recherche globale:", error);
    return { clients: [], invoices: [], documents: [], transactions: [] };
  }
}

