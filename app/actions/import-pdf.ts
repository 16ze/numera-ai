"use server";

/**
 * Server Actions pour l'import de relevés bancaires PDF
 *
 * Ce module permet de :
 * - Extraire le texte brut d'un PDF de relevé bancaire
 * - Utiliser GPT-4o pour parser les transactions
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
// pdf-parse est un package CommonJS, on utilise require pour l'importer
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");

/**
 * Schéma Zod pour valider une transaction extraite du PDF
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
 * Extrait les données d'un relevé bancaire PDF
 *
 * Cette fonction :
 * 1. Récupère le fichier PDF depuis FormData
 * 2. Extrait le texte brut avec pdf-parse
 * 3. Nettoie et limite le texte si nécessaire (max 15000 caractères)
 * 4. Utilise GPT-4o pour extraire les transactions
 * 5. Retourne un tableau de transactions validées
 *
 * @param formData - FormData contenant le fichier PDF sous la clé "pdf"
 * @returns {Promise<ExtractedTransaction[]>} Tableau de transactions extraites
 * @throws {Error} Si le PDF est invalide, si l'extraction échoue, ou si l'IA ne peut pas parser
 */
export async function extractDataFromPDF(
  formData: FormData
): Promise<ExtractedTransaction[]> {
  try {
    // 1. Récupérer le fichier PDF
    const file = formData.get("pdf") as File | null;

    if (!file) {
      throw new Error("Aucun fichier PDF fourni");
    }

    // Validation du type de fichier
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Le fichier doit être au format PDF");
    }

    // Validation de la taille (max 10 MB pour un PDF)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      throw new Error("Le fichier PDF est trop volumineux (maximum 10 MB)");
    }

    console.log(`📄 Extraction du texte du PDF: ${file.name} (${file.size} bytes)`);

    // 2. Convertir le fichier en Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Extraire le texte brut avec pdf-parse
    console.log("📖 Extraction du texte brut du PDF...");
    const pdfData = await pdfParse(buffer);
    let extractedText = pdfData.text;

    console.log(`📝 Texte extrait: ${extractedText.length} caractères`);

    // 4. Nettoyer et limiter le texte si nécessaire
    // Si le texte est trop long, couper pour éviter d'exploser le quota OpenAI
    const maxTextLength = 15000;
    if (extractedText.length > maxTextLength) {
      console.log(`⚠️ Texte trop long (${extractedText.length} chars), tronqué à ${maxTextLength} chars`);
      extractedText = extractedText.substring(0, maxTextLength);
      extractedText += "\n\n[... texte tronqué pour optimisation ...]";
    }

    // 5. Appeler GPT-4o pour extraire les transactions
    console.log("🤖 Envoi du texte à GPT-4o pour extraction des transactions...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant comptable expert. Voici le contenu brut d'un relevé bancaire PDF. " +
            "Ta mission est d'extraire UNIQUEMENT la liste des transactions (mouvements bancaires). " +
            "IGNORE les soldes de début/fin de période, les totaux, les titres, les en-têtes. " +
            "Pour chaque transaction trouvée, retourne un objet JSON avec les champs suivants : " +
            "- date : format YYYY-MM-DD (obligatoire) " +
            "- description : nom du tiers, libellé de l'opération (obligatoire) " +
            "- amount : nombre (POSITIF pour crédit/recette, NÉGATIF pour débit/dépense) " +
            "- category : devine la catégorie parmi : " +
            "TRANSPORT, REPAS, MATERIEL, PRESTATION, IMPOTS, SALAIRES, AUTRE " +
            "Si tu ne peux pas déterminer la catégorie avec certitude, utilise AUTRE. " +
            "Retourne UNIQUEMENT un tableau JSON valide d'objets transactions, sans texte supplémentaire, sans markdown, sans backticks. " +
            "Si aucune transaction n'est trouvée, retourne un tableau vide [].",
        },
        {
          role: "user",
          content: `Voici le contenu du relevé bancaire PDF:\n\n${extractedText}\n\nExtrais toutes les transactions et retourne un tableau JSON.`,
        },
      ],
      temperature: 0.1, // Température basse pour plus de précision
      max_tokens: 4000, // Tokens max pour permettre plusieurs transactions
    });

    // 6. Extraire et parser le JSON de la réponse
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Aucune réponse reçue d'OpenAI");
    }

    console.log("📄 Réponse brute d'OpenAI:", content.substring(0, 500) + "...");

    // Nettoyer le contenu (retirer markdown code blocks si présent)
    let jsonString = content.trim();
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    // Parser le JSON
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("❌ Erreur de parsing JSON:", parseError);
      console.error("📄 Contenu reçu:", jsonString);
      throw new Error(
        "Impossible de parser la réponse d'OpenAI. Format JSON invalide."
      );
    }

    // Vérifier que c'est un tableau
    if (!Array.isArray(parsedData)) {
      throw new Error("La réponse d'OpenAI doit être un tableau de transactions");
    }

    // 7. Valider les données avec Zod
    const validatedTransactions = ExtractedTransactionsSchema.parse(parsedData);

    console.log(`✅ ${validatedTransactions.length} transactions extraites et validées`);

    return validatedTransactions;
  } catch (error) {
    console.error("❌ Erreur lors de l'extraction des données du PDF:", error);

    // Gérer les erreurs spécifiques
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((issue) => issue.message).join(", ");
      throw new Error(`Données extraites invalides: ${errorMessages}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Une erreur inattendue s'est produite lors de l'extraction du PDF");
  }
}

/**
 * Enregistre plusieurs transactions importées depuis un PDF
 *
 * Cette fonction :
 * 1. Valide les données avec Zod
 * 2. Récupère l'utilisateur connecté (sécurité)
 * 3. Crée toutes les transactions dans Prisma
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

    // 3. Créer toutes les transactions dans Prisma
    const createdTransactions = await Promise.all(
      validatedTransactions.map(async (tx) => {
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

        // Créer la transaction
        return prisma.transaction.create({
          data: {
            amount,
            type,
            category: tx.category,
            description: tx.description,
            date: transactionDate,
            companyId,
            status: "COMPLETED", // Les transactions de relevés sont toujours complètes
          },
        });
      })
    );

    console.log(`✅ ${createdTransactions.length} transactions créées avec succès`);

    // 4. Revalider le cache des pages
    revalidatePath("/");
    revalidatePath("/transactions");

    return {
      success: true,
      count: createdTransactions.length,
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

