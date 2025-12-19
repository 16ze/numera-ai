"use server";

/**
 * Server Actions pour l'import de relevés bancaires CSV
 *
 * Ce module permet de :
 * - Parser un fichier CSV de relevé bancaire avec OpenAI
 * - Extraire et catégoriser automatiquement les transactions
 * - Enregistrer les transactions dans la base de données
 */

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import {
  TransactionCategory,
  TransactionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import OpenAI from "openai";

/**
 * Schéma Zod pour valider une transaction extraite du CSV
 */
const ExtractedTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  description: z.string().min(1, "La description est obligatoire"),
  amount: z.number().finite("Le montant doit être un nombre valide"),
  category: z.nativeEnum(TransactionCategory),
});

/**
 * Schéma Zod pour valider un tableau de transactions
 */
const ExtractedTransactionsSchema = z.array(ExtractedTransactionSchema);

/**
 * Type TypeScript pour une transaction extraite
 */
export type ExtractedTransaction = z.infer<typeof ExtractedTransactionSchema>;

/**
 * Initialise le client OpenAI
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Parse et catégorise un CSV de relevé bancaire avec OpenAI
 *
 * Cette fonction :
 * 1. Reçoit le contenu brut du CSV
 * 2. Envoie le CSV à GPT-4o pour extraction et catégorisation
 * 3. Retourne un tableau de transactions validées
 *
 * @param csvContent - Contenu brut du fichier CSV
 * @returns {Promise<ExtractedTransaction[]>} Tableau de transactions extraites et catégorisées
 * @throws {Error} Si le parsing échoue ou si l'IA ne peut pas extraire les données
 */
export async function parseAndCategorizeCSV(
  csvContent: string
): Promise<ExtractedTransaction[]> {
  try {
    console.log("🔍 Début de parseAndCategorizeCSV");
    console.log(`📄 Longueur du CSV: ${csvContent.length} caractères`);

    // Ne pas tronquer le CSV - laisser OpenAI gérer les gros fichiers
    // On va juste vérifier qu'il n'est pas déraisonnablement gros
    const maxCSVLength = 100000; // 100 KB devrait être suffisant pour la plupart des relevés
    let processedCSV = csvContent;
    
    if (csvContent.length > maxCSVLength) {
      console.log(`⚠️ CSV très volumineux (${csvContent.length} chars), tronqué à ${maxCSVLength} chars`);
      processedCSV = csvContent.substring(0, maxCSVLength);
      processedCSV += "\n\n[... CSV tronqué (trop volumineux) ...]";
    }

    // Appeler GPT-4o pour parser et catégoriser le CSV
    console.log("🤖 Envoi du CSV à GPT-4o-mini pour extraction des transactions...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Optimisation coûts : analyse texte CSV → mini
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant comptable expert. Ta mission est d'analyser un relevé bancaire au format CSV. " +
            "IGNORE absolument : les en-têtes, les lignes de total, les lignes vides. " +
            "EXTRAIS UNIQUEMENT : les lignes de transactions individuelles (mouvements bancaires). " +
            "\n" +
            "Pour chaque transaction, retourne un objet avec exactement ces 4 champs :\n" +
            "- date : format STRICT YYYY-MM-DD (convertir depuis le format du CSV)\n" +
            "- description : texte du libellé/description (nettoyée, sans guillemets supplémentaires)\n" +
            "- amount : nombre décimal (POSITIF pour recette/crédit, NÉGATIF pour dépense/débit)\n" +
            "- category : une seule valeur parmi : TRANSPORT, REPAS, MATERIEL, PRESTATION, IMPOTS, SALAIRES, AUTRE\n" +
            "\n" +
            "IMPORTANT : Retourne UNIQUEMENT un tableau JSON valide, sans texte avant/après, sans markdown, sans backticks. " +
            "Format exact attendu : [{\"date\":\"2024-12-14\",\"description\":\"...\",\"amount\":-50.00,\"category\":\"REPAS\"},...] " +
            "Si aucune transaction n'est trouvée, retourne exactement : []",
        },
        {
          role: "user",
          content: `Analyse ce relevé bancaire CSV et extrais toutes les transactions. Retourne UNIQUEMENT un tableau JSON valide :\n\n${processedCSV}`,
        },
      ],
      temperature: 0.1, // Température basse pour plus de précision
      max_tokens: 16000, // Tokens max augmentés pour gérer beaucoup de transactions (320 lignes)
    });

    // Extraire et parser le JSON de la réponse
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Aucune réponse reçue d'OpenAI");
    }

    console.log("📄 Réponse brute d'OpenAI (premiers 1000 caractères):", content.substring(0, 1000));

    // Nettoyer le contenu (retirer markdown code blocks si présent)
    let jsonString = content.trim();
    
    // Supprimer les backticks et markdown
    jsonString = jsonString.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/g, "");
    
    // Supprimer tout texte avant le premier [ ou {
    const firstBracket = jsonString.indexOf("[");
    const firstBrace = jsonString.indexOf("{");
    
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      jsonString = jsonString.substring(firstBracket);
    } else if (firstBrace !== -1) {
      jsonString = jsonString.substring(firstBrace);
    }
    
    // Supprimer tout texte après le dernier ] ou }
    const lastBracket = jsonString.lastIndexOf("]");
    const lastBrace = jsonString.lastIndexOf("}");
    
    if (lastBracket !== -1 && (lastBrace === -1 || lastBracket > lastBrace)) {
      jsonString = jsonString.substring(0, lastBracket + 1);
    } else if (lastBrace !== -1) {
      jsonString = jsonString.substring(0, lastBrace + 1);
    }
    
    // Parser le JSON avec stratégies de récupération (même logique que import-pdf.ts)
    let parsedData: any = null;
    
    try {
      const preParse = JSON.parse(jsonString);
      if (preParse && typeof preParse === "object" && !Array.isArray(preParse)) {
        // Si c'est un objet, chercher un tableau à l'intérieur
        const keys = Object.keys(preParse);
        for (const key of keys) {
          if (Array.isArray(preParse[key])) {
            console.log(`📌 Tableau trouvé sous la clé "${key}"`);
            parsedData = preParse[key];
            break;
          }
        }
        if (!parsedData) {
          const values = Object.values(preParse);
          if (values.length > 0 && Array.isArray(values[0])) {
            parsedData = values[0];
          }
        }
      } else if (Array.isArray(preParse)) {
        parsedData = preParse;
      }
    } catch (firstParseError) {
      console.log("⚠️ Premier parsing échoué, tentative de récupération...");
    }

    // Si le parsing direct a échoué, essayer de récupérer le JSON
    if (!parsedData) {
      try {
        // Tentative 1 : Chercher un tableau JSON complet dans le texte
        const jsonArrayMatch = jsonString.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch && jsonArrayMatch[0]) {
          console.log("🔧 Tentative de récupération : tableau JSON trouvé avec regex");
          parsedData = JSON.parse(jsonArrayMatch[0]);
          console.log("✅ Récupération réussie avec regex !");
        }
      } catch (regexError) {
        console.log("⚠️ Récupération regex échouée");
      }
      
      // Tentative 2 : Essayer de réparer le JSON en fermant les structures ouvertes
      if (!parsedData) {
        try {
          // Compter les [ et ] pour équilibrer
          const openBrackets = (jsonString.match(/\[/g) || []).length;
          const closeBrackets = (jsonString.match(/\]/g) || []).length;
          
          if (openBrackets > closeBrackets) {
            // Ajouter les ] manquants
            const missingBrackets = openBrackets - closeBrackets;
            const repairedJson = jsonString + "]".repeat(missingBrackets);
            console.log("🔧 Tentative de réparation : ajout de ] manquants");
            parsedData = JSON.parse(repairedJson);
            console.log("✅ Réparation réussie !");
          }
        } catch (repairError) {
          console.log("⚠️ Réparation échouée");
        }
      }
      
      // Tentative 3 : Parser directement (peut-être que c'est valide maintenant)
      if (!parsedData) {
        try {
          parsedData = JSON.parse(jsonString);
          console.log("✅ Parsing direct réussi !");
        } catch (directError) {
          console.error("❌ Toutes les tentatives de parsing ont échoué");
          console.error("❌ Erreur de parsing JSON:", directError);
          console.error("📄 Contenu JSON brut (1000 premiers chars):", jsonString.substring(0, 1000));
          console.error("📄 Contenu JSON brut (1000 derniers chars):", jsonString.substring(Math.max(0, jsonString.length - 1000)));
          
          // Dernière tentative : extraire juste les objets valides
          const objects: any[] = [];
          // Chercher tous les objets JSON valides dans le texte
          const objectPattern = /\{[^{}]*"date"[^{}]*\}/g;
          let match;
          while ((match = objectPattern.exec(jsonString)) !== null) {
            try {
              const obj = JSON.parse(match[0]);
              if (obj.date && obj.description && typeof obj.amount === "number") {
                objects.push(obj);
              }
            } catch {
              // Ignorer les objets invalides
            }
          }
          
          // Si on trouve des objets, essayer de les parser plus largement
          if (objects.length === 0) {
            // Essayer avec un pattern plus large qui capture les objets multi-lignes
            // Utiliser [\s\S] au lieu de . avec flag s pour compatibilité
            const multiLinePattern = /\{[\s\S]*?"date"[\s\S]*?"description"[\s\S]*?"amount"[\s\S]*?"category"[\s\S]*?\}/g;
            const multiLineMatches = jsonString.match(multiLinePattern);
            if (multiLineMatches) {
              for (const matchStr of multiLineMatches) {
                try {
                  const obj = JSON.parse(matchStr);
                  if (obj.date && obj.description && typeof obj.amount === "number") {
                    objects.push(obj);
                  }
                } catch {
                  // Ignorer
                }
              }
            }
          }
          
          if (objects.length > 0) {
            parsedData = objects;
            console.log(`✅ Extraction partielle réussie : ${objects.length} transactions`);
          }
        }
      }
      
      if (!parsedData) {
        throw new Error(
          `Impossible de parser la réponse d'OpenAI. Format JSON invalide. Longueur: ${jsonString.length} chars. Début: ${jsonString.substring(0, 300)}... Fin: ${jsonString.substring(Math.max(0, jsonString.length - 300))}`
        );
      }
    }

    // Vérifier que c'est un tableau
    if (!Array.isArray(parsedData)) {
      throw new Error("La réponse d'OpenAI doit être un tableau de transactions");
    }

    // Valider les données avec Zod
    const validatedTransactions = ExtractedTransactionsSchema.parse(parsedData);

    console.log(`✅ ${validatedTransactions.length} transactions extraites et validées`);

    return validatedTransactions;
  } catch (error) {
    console.error("❌ Erreur lors du parsing du CSV:", error);
    
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((issue) => issue.message).join(", ");
      throw new Error(`Données extraites invalides: ${errorMessages}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Une erreur inattendue s'est produite lors du parsing du CSV");
  }
}

/**
 * Enregistre plusieurs transactions importées depuis un CSV
 *
 * Cette fonction :
 * 1. Valide les données avec Zod
 * 2. Récupère l'utilisateur connecté (sécurité)
 * 3. Crée toutes les transactions dans Prisma avec createMany
 * 4. Revalide le cache des pages
 *
 * @param transactions - Tableau de transactions à enregistrer
 * @returns {Promise<{ success: true; count: number }>} Succès avec le nombre de transactions créées
 * @throws {Error} Si les données sont invalides, si l'utilisateur n'est pas connecté, ou en cas d'erreur Prisma
 */
export async function saveImportedTransactions(
  transactions: ExtractedTransaction[]
): Promise<{ success: true; count: number }> {
  try {
    // 1. Valider les données avec Zod
    const validatedTransactions = ExtractedTransactionsSchema.parse(transactions);

    if (validatedTransactions.length === 0) {
      throw new Error("Aucune transaction à enregistrer");
    }

    // 2. Récupérer l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    console.log(`💾 Enregistrement de ${validatedTransactions.length} transactions pour l'utilisateur ${user.id}...`);

    // 3. Préparer les données pour Prisma createMany
    const transactionsData = validatedTransactions.map((tx) => {
      // Convertir la date string en Date object
      const transactionDate = new Date(tx.date + "T00:00:00.000Z");

      // Validation de la date
      if (isNaN(transactionDate.getTime())) {
        throw new Error(`Date invalide: ${tx.date}`);
      }

      // Déterminer le type et le montant
      // amount est négatif pour les dépenses, positif pour les recettes
      const amount = Math.abs(tx.amount);
      const type: TransactionType = tx.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;

      return {
        amount,
        type,
        category: tx.category,
        description: tx.description,
        date: transactionDate,
        companyId,
        status: "COMPLETED" as const, // Les transactions de relevés sont toujours complètes
      };
    });

    // 4. Créer toutes les transactions avec createMany (plus performant)
    const result = await prisma.transaction.createMany({
      data: transactionsData,
    });

    console.log(`✅ ${result.count} transactions créées avec succès`);

    // 5. Revalider le cache des pages
    revalidatePath("/");
    revalidatePath("/transactions");

    return {
      success: true,
      count: result.count,
    };
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement des transactions:", error);

    // Gérer les erreurs spécifiques
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((issue) => issue.message).join(", ");
      throw new Error(`Données invalides: ${errorMessages}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Une erreur inattendue s'est produite lors de l'enregistrement des transactions"
    );
  }
}

