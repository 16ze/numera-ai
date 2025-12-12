"use server";

/**
 * Server Actions pour le scan de reçus (OCR) avec OpenAI Vision
 *
 * Ce module permet de :
 * - Analyser une image de reçu/ticket de caisse avec GPT-4o Vision
 * - Extraire automatiquement les données structurées (montant, date, commerçant, catégorie)
 * - Enregistrer la transaction dans la base de données
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
 * Schéma Zod pour valider les données extraites du reçu par l'IA
 */
const ReceiptAnalysisSchema = z.object({
  amount: z.number().positive("Le montant doit être positif"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  description: z.string().min(1, "La description est obligatoire"),
  category: z.nativeEnum(TransactionCategory),
});

/**
 * Schéma Zod pour valider les données avant enregistrement
 */
const ScannedTransactionSchema = z.object({
  amount: z.number().positive("Le montant doit être positif"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  description: z.string().min(1, "La description est obligatoire"),
  category: z.nativeEnum(TransactionCategory),
});

/**
 * Type TypeScript pour les données extraites du reçu
 */
export type ReceiptAnalysisResult = z.infer<typeof ReceiptAnalysisSchema>;

/**
 * Type TypeScript pour les données de transaction scannée
 */
export type ScannedTransactionData = z.infer<typeof ScannedTransactionSchema>;

/**
 * Initialise le client OpenAI
 * Utilise la clé API depuis les variables d'environnement
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Convertit un fichier en Base64
 *
 * @param file - Le fichier à convertir
 * @returns {Promise<string>} La chaîne Base64 avec le préfixe data URL
 */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Analyse un reçu/ticket de caisse avec GPT-4o Vision
 *
 * Cette fonction :
 * 1. Convertit l'image en Base64
 * 2. Envoie l'image à OpenAI GPT-4o Vision
 * 3. Extrait les données structurées (montant, date, commerçant, catégorie)
 * 4. Retourne un objet JSON validé avec Zod
 *
 * @param formData - FormData contenant le fichier image sous la clé "image"
 * @returns {Promise<ReceiptAnalysisResult>} Les données extraites du reçu
 * @throws {Error} Si l'image est invalide, si l'API OpenAI échoue, ou si les données ne sont pas valides
 *
 * @example
 * ```typescript
 * const formData = new FormData();
 * formData.append("image", file);
 * const result = await analyzeReceipt(formData);
 * // result = { amount: 45.50, date: "2025-12-12", description: "Restaurant Le Bon Coin", category: "REPAS" }
 * ```
 */
export async function analyzeReceipt(
  formData: FormData
): Promise<ReceiptAnalysisResult> {
  try {
    // 1. Récupérer le fichier image depuis le FormData
    const file = formData.get("image") as File | null;

    if (!file) {
      throw new Error("Aucun fichier image fourni");
    }

    // Validation du type de fichier
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        `Type de fichier non supporté. Types autorisés : ${allowedTypes.join(", ")}`
      );
    }

    // Validation de la taille (max 20 MB pour permettre les photos de téléphone)
    // Les photos de téléphone modernes peuvent faire 5-15 MB
    const maxSize = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxSize) {
      throw new Error("Le fichier est trop volumineux (maximum 20 MB)");
    }

    console.log(`📸 Analyse du reçu: ${file.name} (${file.size} bytes, ${file.type})`);

    // 2. Convertir l'image en Base64
    const base64Image = await fileToBase64(file);

    // 3. Appeler OpenAI GPT-4o Vision pour analyser le reçu
    console.log("🤖 Envoi de l'image à OpenAI GPT-4o Vision...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Modèle avec vision
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en OCR et analyse de tickets de caisse. " +
            "Analyse l'image fournie et extrais UNIQUEMENT les informations suivantes au format JSON strict : " +
            "- amount (nombre décimal positif, montant TTC total) " +
            "- date (format YYYY-MM-DD) " +
            "- description (nom du commerçant ou description courte) " +
            "- category (une des valeurs : TRANSPORT, REPAS, MATERIEL, AUTRE) " +
            "Si tu ne peux pas déterminer une catégorie avec certitude, utilise AUTRE. " +
            "Retourne UNIQUEMENT un objet JSON valide, sans texte supplémentaire, sans markdown, sans backticks.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyse ce ticket de caisse et extrais le montant total (TTC), la date, le nom du commerçant (description), et devine la catégorie (TRANSPORT, REPAS, MATERIEL, AUTRE). Le type est toujours EXPENSE. Retourne uniquement un JSON valide.",
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1, // Température basse pour plus de précision
    });

    // 4. Extraire et parser le JSON de la réponse
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Aucune réponse reçue d'OpenAI");
    }

    console.log("📄 Réponse brute d'OpenAI:", content);

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

    // 5. Valider les données avec Zod
    const validatedData = ReceiptAnalysisSchema.parse(parsedData);

    console.log("✅ Données extraites et validées:", validatedData);

    return validatedData;
  } catch (error) {
    console.error("❌ Erreur lors de l'analyse du reçu:", error);

    // Gérer les erreurs spécifiques
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((issue) => issue.message).join(", ");
      throw new Error(`Données extraites invalides: ${errorMessages}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Une erreur inattendue s'est produite lors de l'analyse du reçu");
  }
}

/**
 * Enregistre une transaction scannée dans la base de données
 *
 * Cette fonction :
 * 1. Valide les données avec Zod
 * 2. Récupère l'utilisateur connecté (sécurité)
 * 3. Crée la transaction dans Prisma
 * 4. Revalide le cache de la page d'accueil
 *
 * @param data - Les données de la transaction à enregistrer
 * @returns {Promise<{ success: true; transactionId: string }>} Succès avec l'ID de la transaction
 * @throws {Error} Si les données sont invalides, si l'utilisateur n'est pas connecté, ou en cas d'erreur Prisma
 *
 * @example
 * ```typescript
 * const result = await saveScannedTransaction({
 *   amount: 45.50,
 *   date: "2025-12-12",
 *   description: "Restaurant Le Bon Coin",
 *   category: "REPAS"
 * });
 * // result = { success: true, transactionId: "uuid..." }
 * ```
 */
export async function saveScannedTransaction(
  data: ScannedTransactionData
): Promise<{ success: true; transactionId: string }> {
  try {
    // 1. Valider les données avec Zod
    const validatedData = ScannedTransactionSchema.parse(data);

    // 2. Récupérer l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    // 3. Convertir la date string en Date object
    const transactionDate = new Date(validatedData.date + "T00:00:00.000Z");

    // Validation de la date
    if (isNaN(transactionDate.getTime())) {
      throw new Error("Date invalide");
    }

    // 4. Créer la transaction dans Prisma
    console.log(`💾 Enregistrement de la transaction scannée pour l'utilisateur ${user.id}...`);

    const transaction = await prisma.transaction.create({
      data: {
        amount: validatedData.amount,
        type: TransactionType.EXPENSE, // Toujours EXPENSE pour les reçus scannés
        category: validatedData.category,
        description: validatedData.description,
        date: transactionDate,
        companyId,
      },
    });

    console.log(`✅ Transaction créée avec succès: ${transaction.id}`);

    // 5. Revalider le cache de la page d'accueil pour mettre à jour le dashboard
    revalidatePath("/");

    return {
      success: true,
      transactionId: transaction.id,
    };
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement de la transaction:", error);

    // Gérer les erreurs spécifiques
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((issue) => issue.message).join(", ");
      throw new Error(`Données invalides: ${errorMessages}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Une erreur inattendue s'est produite lors de l'enregistrement de la transaction"
    );
  }
}

