import { prisma } from "@/app/lib/prisma";
import { openai } from "@ai-sdk/openai";
import { currentUser } from "@clerk/nextjs/server";
import {
  InvoiceStatus,
  TransactionCategory,
  TransactionType,
} from "@prisma/client";
import { streamText, tool } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// On laisse 30 secondes max pour éviter les timeouts
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Récupération de l'utilisateur Clerk connecté
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    console.log("📩 Message reçu, début du traitement...");
    console.log("📝 Nombre de messages:", messages?.length || 0);

    const result = streamText({
      // 1. Force l'utilisation du modèle gpt-4o (pas le mini) pour assurer la fiabilité
      model: openai("gpt-4o"),
      messages,

      // 2. INDISPENSABLE : stopWhen permet de continuer jusqu'à ce qu'il n'y ait plus d'appels d'outils
      // Par défaut, streamText s'arrête après 1 step, on doit le remplacer
      // On continue jusqu'à 5 steps max OU jusqu'à ce qu'il n'y ait plus de tool calls
      stopWhen: ({ steps }) => {
        // Continue tant qu'il y a moins de 5 steps
        // ET que le dernier step a des tool calls (donc pas encore de réponse finale)
        if (steps.length >= 5) return true;
        const lastStep = steps[steps.length - 1];
        // Si le dernier step n'a pas de tool calls, on peut s'arrêter
        return lastStep.toolCalls.length === 0 && steps.length > 1;
      },

      // 3. Prompt système autoritaire pour forcer la réponse textuelle
      system: `Tu es le CFO de Numera Corp.

      ⚠️ ATTENTION CRITIQUE AUX DATES ⚠️
      LES DATES SONT PRIMORDIALES DANS TOUTES LES TRANSACTIONS ET REQUÊTES.
      TU DOIS TOUJOURS VÉRIFIER ET PRÉCISER LES DATES DANS TES RÉPONSES.

      PROTOCOL STRICT :

      1. Si l'utilisateur demande des chiffres du mois EN COURS -> Appelle l'outil getStats.
         IMPORTANT : Dans ta réponse, précise TOUJOURS la période exacte (ex: "Pour le mois de décembre 2025...")

      2. Si l'utilisateur demande des informations sur une PÉRIODE SPÉCIFIQUE (un mois particulier, une date, une période) :
         - IDENTIFIE PRÉCISÉMENT la période demandée (mois, année, dates exactes)
         - CALCULE toi-même les dates de début et de fin avec PRÉCISION
         - VÉRIFIE que tes calculs de dates sont corrects avant d'appeler l'outil
         - EXEMPLES :
           * "Août 2025" = startDate "2025-08-01", endDate "2025-08-31"
           * "Août dernier" = mois d'août de l'année actuelle (ou précédente si on est avant août)
           * "Décembre 2024" = startDate "2024-12-01", endDate "2024-12-31"
           * "Le mois de janvier" = janvier de l'année en cours
         - UTILISE l'outil getTransactionsByPeriod avec les dates calculées
         - L'outil retourne la liste des transactions avec leurs DATES EXACTES
         - DANS TA RÉPONSE : Mentionne TOUJOURS la période exacte analysée (ex: "Pour la période du 1er au 31 août 2025...")
         - AFFICHE les dates des transactions si elles sont pertinentes

      3. Si l'utilisateur demande d'AJOUTER une transaction (dépense ou recette) -> Appelle l'outil addTransaction.
         Si l'utilisateur mentionne une date spécifique pour la transaction, note-la et mentionne-la dans ta réponse.

      4. Si l'utilisateur demande de CRÉER une FACTURE -> Appelle l'outil createInvoice.

      5. ATTENDS le résultat de l'outil.

      6. IMPORTANT : Une fois le résultat reçu, TU DOIS RÉDIGER une phrase de réponse PRÉCISE.
         - MENTIONNE TOUJOURS la période analysée (dates de début et de fin)
         - MENTIONNE les dates spécifiques des transactions si pertinent
         - Exemples de réponses avec dates :
           * "Pour le mois de décembre 2025, votre CA est de 4000€"
           * "Vos dépenses du 1er au 31 août 2025 s'élèvent à 11.40€"
           * "Voici vos transactions d'octobre 2024 : [liste avec dates]"
         NE T'ARRÊTE JAMAIS APRÈS L'EXÉCUTION DE L'OUTIL. PARLE À L'UTILISATEUR AVEC PRÉCISION.

      CALCUL DES DATES - RÈGLES STRICTES :
      - Format des dates dans les outils : TOUJOURS "YYYY-MM-DD" (ex: "2025-08-01")
      - Pour les mois : Premier jour = "YYYY-MM-01", dernier jour = dernier jour du mois
      - Pour "mois dernier" : Si on est en janvier 2026, "décembre dernier" = décembre 2025
      - Pour "mois actuel" : Utilise l'année et le mois en cours
      - Toujours inclure toute la journée dans la période (00:00:00 pour début, 23:59:59 pour fin)
      - VÉRIFIE que la date de début est bien AVANT la date de fin

      PRÉSENTATION DES RÉSULTATS :
      - Toujours mentionner la période analysée dans la réponse
      - Si tu listes des transactions, inclure leurs dates
      - Si tu donnes des totaux, préciser pour quelle période
      - Être explicite sur les dates pour éviter toute confusion

      CRÉATION DE TRANSACTIONS :
      - Tu PEUX créer des transactions si l'utilisateur le demande (ex: "Ajoute une dépense de 50€ pour un Uber").
      - INFÈRE la catégorie si elle n'est pas précisée :
        * Resto, restaurant, déjeuner, dîner, café -> REPAS
        * Uber, taxi, transport, essence, parking -> TRANSPORT
        * Matériel, fournitures, équipement -> MATERIEL
        * Prestation, service, freelance -> PRESTATION
        * Impôt, taxe, fiscal -> IMPOTS
        * Salaire, paie -> SALAIRES
        * Sinon -> AUTRE
      - Le montant doit être positif (toujours en euros).
      - La description doit être claire et concise.

      CRÉATION DE FACTURES :
      - Tu PEUX créer des factures si l'utilisateur le demande (ex: "Facture Martin 500€ pour du coaching").
      - Le client sera créé automatiquement s'il n'existe pas déjà.
      - Si l'utilisateur donne juste un montant et une description simple, crée une facture avec une ligne.
      - Les items peuvent être un tableau (plusieurs lignes) ou juste un montant simple (une ligne).
      - La date d'échéance est optionnelle (par défaut J+30 jours).

      Devise : Euros (€).`,

      tools: {
        getStats: tool({
          description:
            "Donne le CA (income), les dépenses (expense) et le résultat net du mois en cours.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getStats' en cours...");

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.warn(
                  "⚠️ Utilisateur ou company non trouvé, retour de zéros"
                );
                return { revenue: 0, expense: 0, net: 0 };
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1);
              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

              console.log(
                `📅 Analyse du ${start.toLocaleDateString()} au ${end.toLocaleDateString()}`
              );

              const transactions = await prisma.transaction.findMany({
                where: {
                  companyId,
                  date: { gte: start, lte: end },
                },
              });

              console.log(`📊 ${transactions.length} transactions trouvées.`);

              const revenue = transactions
                .filter((t) => t.type === "INCOME")
                .reduce((acc, t) => acc + Number(t.amount), 0);

              const expense = transactions
                .filter((t) => t.type === "EXPENSE")
                .reduce((acc, t) => acc + Number(t.amount), 0);

              const net = revenue - expense;

              console.log(
                `💰 Succès : Recettes=${revenue} | Dépenses=${expense} | Net=${net}`
              );

              // On retourne le résultat
              return { revenue, expense, net };
            } catch (err) {
              console.error("❌ CRASH dans execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error("Erreur technique lors du calcul.");
            }
          },
        }),

        getTransactionsByPeriod: tool({
          description:
            "Récupère toutes les transactions d'une période spécifique (dates de début et de fin). Utilise cet outil quand l'utilisateur demande des informations sur un mois ou une période spécifique (ex: 'Août', 'octobre 2024'). L'IA doit calculer elle-même les dates de début et de fin du mois demandé.",
          inputSchema: z.object({
            startDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)")
              .describe(
                "Date de début au format YYYY-MM-DD (ex: '2025-08-01' pour le 1er août 2025)"
              ),
            endDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)")
              .describe(
                "Date de fin au format YYYY-MM-DD (ex: '2025-08-31' pour le 31 août 2025)"
              ),
          }),
          execute: async ({ startDate, endDate }) => {
            console.log("🛠️ Outil 'getTransactionsByPeriod' en cours...");
            console.log(
              `📅 Période demandée: du ${startDate} au ${endDate}`
            );

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.warn(
                  "⚠️ Utilisateur ou company non trouvé, retour vide"
                );
                return { transactions: [] };
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Conversion des dates string en Date objects
              // On utilise minuit pour startDate et 23:59:59 pour endDate pour couvrir toute la journée
              const start = new Date(startDate + "T00:00:00.000Z");
              const end = new Date(endDate + "T23:59:59.999Z");

              // Validation des dates
              if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error("Dates invalides");
              }

              if (start > end) {
                throw new Error("La date de début doit être antérieure à la date de fin");
              }

              console.log(
                `📅 Recherche des transactions du ${start.toISOString()} au ${end.toISOString()}`
              );

              // Récupération des transactions dans la période
              const transactions = await prisma.transaction.findMany({
                where: {
                  companyId,
                  date: {
                    gte: start,
                    lte: end,
                  },
                },
                orderBy: {
                  date: "desc", // Plus récentes en premier
                },
              });

              console.log(`📊 ${transactions.length} transactions trouvées pour la période.`);

              // Formatage des transactions pour la réponse
              const formattedTransactions = transactions.map((t) => ({
                date: t.date.toISOString().split("T")[0], // Format YYYY-MM-DD
                description: t.description || "Sans description",
                amount: Number(t.amount),
                type: t.type,
                category: t.category,
              }));

              // Calcul des totaux pour faciliter l'analyse
              const totalIncome = formattedTransactions
                .filter((t) => t.type === "INCOME")
                .reduce((sum, t) => sum + t.amount, 0);

              const totalExpense = formattedTransactions
                .filter((t) => t.type === "EXPENSE")
                .reduce((sum, t) => sum + t.amount, 0);

              const net = totalIncome - totalExpense;

              console.log(
                `💰 Totaux pour la période : Recettes=${totalIncome}€ | Dépenses=${totalExpense}€ | Net=${net}€`
              );

              return {
                transactions: formattedTransactions,
                summary: {
                  totalIncome,
                  totalExpense,
                  net,
                  count: formattedTransactions.length,
                },
              };
            } catch (err) {
              console.error("❌ ERREUR dans getTransactionsByPeriod execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la récupération des transactions"
              );
            }
          },
        }),

        addTransaction: tool({
          description:
            "Ajoute une transaction (recette ou dépense) dans la base de données. Utilise cet outil quand l'utilisateur demande d'ajouter une transaction.",
          inputSchema: z.object({
            amount: z
              .number()
              .positive("Le montant doit être positif")
              .describe("Montant de la transaction en euros"),
            type: z
              .enum(["INCOME", "EXPENSE"])
              .describe(
                "Type de transaction : INCOME (recette) ou EXPENSE (dépense)"
              ),
            description: z
              .string()
              .min(1, "La description est requise")
              .describe(
                "Description de la transaction (ex: 'Uber pour déplacement client')"
              ),
            category: z
              .enum([
                "TRANSPORT",
                "REPAS",
                "MATERIEL",
                "PRESTATION",
                "IMPOTS",
                "SALAIRES",
                "AUTRE",
              ])
              .optional()
              .describe(
                "Catégorie de la transaction (inférée si non précisée). Options: TRANSPORT, REPAS, MATERIEL, PRESTATION, IMPOTS, SALAIRES, AUTRE"
              ),
          }),
          execute: async ({ amount, type, description, category }) => {
            console.log("🛠️ Outil 'addTransaction' en cours...");
            console.log(
              `📝 Paramètres: amount=${amount}, type=${type}, description=${description}, category=${
                category || "AUTO"
              }`
            );

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.error("❌ Utilisateur ou company non trouvé");
                throw new Error(
                  "Utilisateur ou entreprise introuvable. Veuillez réessayer."
                );
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Inférence de la catégorie si non fournie
              let finalCategory: TransactionCategory = category || "AUTRE";

              if (!category) {
                const descriptionLower = description.toLowerCase();
                if (
                  descriptionLower.includes("resto") ||
                  descriptionLower.includes("restaurant") ||
                  descriptionLower.includes("déjeuner") ||
                  descriptionLower.includes("diner") ||
                  descriptionLower.includes("dîner") ||
                  descriptionLower.includes("café") ||
                  descriptionLower.includes("cafe") ||
                  descriptionLower.includes("manger") ||
                  descriptionLower.includes("repas")
                ) {
                  finalCategory = "REPAS";
                } else if (
                  descriptionLower.includes("uber") ||
                  descriptionLower.includes("taxi") ||
                  descriptionLower.includes("transport") ||
                  descriptionLower.includes("essence") ||
                  descriptionLower.includes("parking") ||
                  descriptionLower.includes("train") ||
                  descriptionLower.includes("avion")
                ) {
                  finalCategory = "TRANSPORT";
                } else if (
                  descriptionLower.includes("matériel") ||
                  descriptionLower.includes("materiel") ||
                  descriptionLower.includes("fourniture") ||
                  descriptionLower.includes("équipement") ||
                  descriptionLower.includes("equipement")
                ) {
                  finalCategory = "MATERIEL";
                } else if (
                  descriptionLower.includes("prestation") ||
                  descriptionLower.includes("service") ||
                  descriptionLower.includes("freelance")
                ) {
                  finalCategory = "PRESTATION";
                } else if (
                  descriptionLower.includes("impôt") ||
                  descriptionLower.includes("impot") ||
                  descriptionLower.includes("taxe") ||
                  descriptionLower.includes("fiscal")
                ) {
                  finalCategory = "IMPOTS";
                } else if (
                  descriptionLower.includes("salaire") ||
                  descriptionLower.includes("paie") ||
                  descriptionLower.includes("paye")
                ) {
                  finalCategory = "SALAIRES";
                }

                console.log(`🔍 Catégorie inférée : ${finalCategory}`);
              }

              // Création de la transaction
              const transaction = await prisma.transaction.create({
                data: {
                  amount,
                  type: type as TransactionType,
                  description,
                  category: finalCategory,
                  status: "COMPLETED",
                  companyId,
                  date: new Date(), // Date actuelle par défaut
                },
              });

              console.log(
                `✅ Transaction créée avec succès: ${transaction.id}`
              );

              // IMPORTANT : Revalidation du cache pour mettre à jour le dashboard instantanément
              revalidatePath("/");

              return {
                success: true,
                transactionId: transaction.id,
                message: `Transaction ${
                  type === "INCOME" ? "de recette" : "de dépense"
                } de ${amount}€ ajoutée avec succès`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans addTransaction execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la création de la transaction"
              );
            }
          },
        }),

        createInvoice: tool({
          description:
            "Crée une facture pour un client. Le client sera créé automatiquement s'il n'existe pas déjà. Utilise cet outil quand l'utilisateur demande de créer une facture.",
          inputSchema: z.object({
            clientName: z
              .string()
              .min(1, "Le nom du client est requis")
              .describe("Nom du client (sera créé s'il n'existe pas)"),
            items: z
              .array(
                z.object({
                  description: z
                    .string()
                    .min(1, "La description est requise")
                    .describe("Description de la prestation ou produit"),
                  quantity: z
                    .number()
                    .positive("La quantité doit être positive")
                    .default(1)
                    .describe("Quantité (par défaut: 1)"),
                  unitPrice: z
                    .number()
                    .positive("Le prix unitaire doit être positif")
                    .describe("Prix unitaire HT en euros"),
                })
              )
              .min(1, "Au moins un item est requis")
              .describe("Lignes de la facture (items)"),
            dueDate: z
              .string()
              .optional()
              .describe(
                "Date d'échéance au format ISO (optionnel, par défaut J+30 jours)"
              ),
          }),
          execute: async ({ clientName, items, dueDate }) => {
            console.log("🛠️ Outil 'createInvoice' en cours...");
            console.log(
              `📝 Paramètres: clientName=${clientName}, items=${
                items.length
              }, dueDate=${dueDate || "AUTO"}`
            );

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.error("❌ Utilisateur ou company non trouvé");
                throw new Error(
                  "Utilisateur ou entreprise introuvable. Veuillez réessayer."
                );
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Recherche ou création du client
              let client = await prisma.client.findFirst({
                where: {
                  companyId,
                  name: {
                    equals: clientName,
                    mode: "insensitive", // Recherche insensible à la casse
                  },
                },
              });

              if (!client) {
                console.log(`🆕 Création du nouveau client: ${clientName}`);
                client = await prisma.client.create({
                  data: {
                    name: clientName,
                    companyId,
                  },
                });
                console.log(`✅ Client créé avec succès: ${client.id}`);
              } else {
                console.log(`✅ Client trouvé: ${client.id}`);
              }

              // Calcul de la date d'échéance (J+30 par défaut)
              const now = new Date();
              const issuedDate = now;
              const calculatedDueDate = dueDate
                ? new Date(dueDate)
                : new Date(now.setDate(now.getDate() + 30));

              // Récupération du dernier numéro de facture pour cette company
              const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId },
                orderBy: { createdAt: "desc" },
              });

              // Génération du numéro de facture (INV-001, INV-002, etc.)
              let invoiceNumber = "INV-001";
              if (lastInvoice) {
                const lastNumber = parseInt(
                  lastInvoice.number.replace("INV-", "")
                );
                invoiceNumber = `INV-${String(lastNumber + 1).padStart(
                  3,
                  "0"
                )}`;
              }

              console.log(`📄 Numéro de facture généré: ${invoiceNumber}`);

              // Création de la facture avec ses lignes en transaction
              const invoice = await prisma.invoice.create({
                data: {
                  number: invoiceNumber,
                  issuedDate,
                  dueDate: calculatedDueDate,
                  status: InvoiceStatus.DRAFT,
                  companyId,
                  clientId: client.id,
                  rows: {
                    create: items.map((item) => ({
                      description: item.description,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      vatRate: 0.0, // TVA par défaut à 0%, peut être amélioré plus tard
                    })),
                  },
                },
                include: {
                  rows: true,
                },
              });

              console.log(`✅ Facture créée avec succès: ${invoice.id}`);

              // Calcul du montant total
              const total = invoice.rows.reduce((sum, row) => {
                return sum + Number(row.quantity) * Number(row.unitPrice);
              }, 0);

              // IMPORTANT : Revalidation du cache pour mettre à jour la page des factures
              revalidatePath("/invoices");

              return {
                success: true,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number,
                message: `Facture ${
                  invoice.number
                } créée pour ${clientName} (Montant: ${total.toFixed(2)}€)`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans createInvoice execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la création de la facture"
              );
            }
          },
        }),
      },

      // 4. Callback onFinish pour logger le moment exact où l'IA a fini
      onFinish: (result) => {
        console.log("✅✅✅ STREAMTEXT TERMINÉ ✅✅✅");
        console.log("📊 Finish reason:", result.finishReason);
        console.log("🔧 Tool calls:", result.toolCalls?.length || 0);
        console.log("📝 Usage:", result.usage);
        console.log(
          "📄 Texte généré:",
          result.text?.substring(0, 200) || "Aucun texte"
        );
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(
            "🛠️ Outils appelés:",
            result.toolCalls.map((t) => t.toolName)
          );
        }
      },

      // 5. Callback onError pour logger les erreurs
      onError: (error) => {
        console.error("❌ ERREUR DANS streamText :", error);
        console.error(
          "Stack trace:",
          error instanceof Error ? error.stack : "N/A"
        );
      },
    });

    // 6. On renvoie le stream au format UIMessageStream (standard Vercel AI v5)
    // toUIMessageStreamResponse() envoie les métadonnées des outils ET le texte
    // Cela permet au client de gérer correctement le cycle complet des outils
    console.log("📤 Envoi de la réponse streamée...");
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("❌ ERREUR GENERALE API :", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
