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

// pdf2json sera importé dynamiquement pour éviter les problèmes de build

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
    console.log("🔍 Début de extractDataFromPDF");

    // 1. Récupérer le fichier PDF
    const file = formData.get("pdf") as File | null;

    if (!file) {
      console.error("❌ Aucun fichier PDF trouvé dans FormData");
      throw new Error("Aucun fichier PDF fourni");
    }

    console.log(`📄 Fichier reçu: ${file.name}, type: ${file.type}, taille: ${file.size} bytes`);

    // Validation du type de fichier
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      console.error(`❌ Type de fichier invalide: ${file.type}`);
      throw new Error("Le fichier doit être au format PDF");
    }

    // Validation de la taille (max 10 MB pour un PDF)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      console.error(`❌ Fichier trop volumineux: ${file.size} bytes`);
      throw new Error("Le fichier PDF est trop volumineux (maximum 10 MB)");
    }

    console.log(`📄 Extraction du texte du PDF: ${file.name} (${file.size} bytes)`);

    // 2. Convertir le fichier en Buffer
    console.log("🔄 Conversion du fichier en Buffer...");
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`✅ Buffer créé: ${buffer.length} bytes`);

    // 3. Import dynamique de pdf2json (bibliothèque compatible Node.js)
    console.log("📖 Chargement de pdf2json...");
    let PDFParser: any;
    try {
      // Import dynamique pour éviter les problèmes de build
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      PDFParser = require("pdf2json");
    } catch (importError) {
      console.error("❌ Erreur lors du chargement de pdf2json:", importError);
      throw new Error(
        `Le module pdf2json n'a pas pu être chargé: ${
          importError instanceof Error ? importError.message : "Erreur inconnue"
        }`
      );
    }

    if (!PDFParser) {
      throw new Error("Le module pdf2json n'est pas disponible.");
    }

    // 4. Extraire le texte brut avec pdf2json
    console.log("📖 Extraction du texte brut du PDF avec pdf2json...");
    let extractedText = "";
    
    try {
      const pdfParser = new PDFParser(null, 1);
      
      // Promesse pour attendre la fin du parsing
      const parsePromise = new Promise<string>((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", (errData: any) => {
          console.error("❌ Erreur de parsing PDF:", errData);
          reject(new Error(`Erreur de parsing PDF: ${errData.parserError || "Erreur inconnue"}`));
        });

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
          try {
            // Extraire le texte de toutes les pages
            const textParts: string[] = [];
            
            if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
              for (const page of pdfData.Pages) {
                if (page.Texts && Array.isArray(page.Texts)) {
                  const pageText = page.Texts.map((text: any) => {
                    // pdf2json encode le texte parfois en R (raw) ou T (text)
                    if (text.R) {
                      return text.R.map((r: any) => {
                        // Décoder le texte (peut être en base64 ou URL-encoded)
                        try {
                          return decodeURIComponent(r.T || "");
                        } catch {
                          return r.T || "";
                        }
                      }).join("");
                    }
                    return text.T || "";
                  }).join(" ");
                  textParts.push(pageText);
                }
              }
            }
            
            const fullText = textParts.join("\n\n").trim();
            resolve(fullText);
          } catch (extractError) {
            reject(new Error(`Erreur lors de l'extraction du texte: ${extractError instanceof Error ? extractError.message : "Erreur inconnue"}`));
          }
        });
      });

      // Lancer le parsing
      pdfParser.parseBuffer(buffer);
      
      // Attendre la fin du parsing
      extractedText = await parsePromise;
      
      if (!extractedText || extractedText.length === 0) {
        throw new Error("Aucun texte n'a pu être extrait du PDF. Le fichier est peut-être une image scannée ou protégé par mot de passe.");
      }
      
      console.log(`✅ Texte extrait avec succès: ${extractedText.length} caractères`);
      
    } catch (parseError) {
      console.error("❌ Erreur lors du parsing PDF:", parseError);
      throw new Error(
        `Erreur lors de l'extraction du texte du PDF: ${
          parseError instanceof Error ? parseError.message : "Erreur inconnue"
        }`
      );
    }

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
            "Tu es un assistant comptable expert. Ta mission est d'extraire les transactions d'un relevé bancaire PDF. " +
            "IGNORE absolument : les soldes de début/fin, les totaux, les titres, les en-têtes, les dates de période. " +
            "EXTRAIS UNIQUEMENT : les lignes de transactions individuelles (mouvements bancaires). " +
            "\n" +
            "Pour chaque transaction, retourne un objet avec exactement ces 4 champs :\n" +
            "- date : format STRICT YYYY-MM-DD (ex: 2024-12-14)\n" +
            "- description : texte du libellé/tiers (sans guillemets supplémentaires)\n" +
            "- amount : nombre décimal (POSITIF pour recette/crédit, NÉGATIF pour dépense/débit)\n" +
            "- category : une seule valeur parmi : TRANSPORT, REPAS, MATERIEL, PRESTATION, IMPOTS, SALAIRES, AUTRE\n" +
            "\n" +
            "IMPORTANT : Retourne UNIQUEMENT un tableau JSON valide, sans texte avant/après, sans markdown, sans backticks. " +
            "Format exact attendu : [{\"date\":\"2024-12-14\",\"description\":\"...\",\"amount\":-50.00,\"category\":\"REPAS\"},...] " +
            "Si aucune transaction n'est trouvée, retourne exactement : []",
        },
        {
          role: "user",
          content: `Extrais toutes les transactions du relevé bancaire suivant et retourne UNIQUEMENT un tableau JSON valide :\n\n${extractedText}`,
        },
      ],
      temperature: 0.1, // Température basse pour plus de précision
      max_tokens: 4000, // Tokens max pour permettre plusieurs transactions
      // Note: On n'utilise pas response_format car on veut un tableau JSON, pas un objet
    });

    // 6. Extraire et parser le JSON de la réponse
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
      // Commence par un tableau
      jsonString = jsonString.substring(firstBracket);
    } else if (firstBrace !== -1) {
      // Commence par un objet
      jsonString = jsonString.substring(firstBrace);
    }
    
    // Supprimer tout texte après le dernier ] ou }
    const lastBracket = jsonString.lastIndexOf("]");
    const lastBrace = jsonString.lastIndexOf("}");
    
    if (lastBracket !== -1 && (lastBrace === -1 || lastBracket > lastBrace)) {
      // Se termine par un tableau
      jsonString = jsonString.substring(0, lastBracket + 1);
    } else if (lastBrace !== -1) {
      // Se termine par un objet
      jsonString = jsonString.substring(0, lastBrace + 1);
    }
    
    // Si la réponse contient "transactions" ou une clé JSON, extraire juste la valeur
    // Parfois OpenAI renvoie {"transactions": [...]} au lieu de [...]
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
        // Si on a toujours un objet mais pas de tableau, essayer de créer un tableau avec les valeurs
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
      // Pas encore du JSON valide, continuer avec les tentatives de récupération
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
          const objectMatches = jsonString.match(/\{[^}]*"date"[^}]*\}/g);
          if (objectMatches) {
            console.log(`🔧 Dernière tentative : extraction de ${objectMatches.length} objets individuels`);
            for (const objStr of objectMatches) {
              try {
                const obj = JSON.parse(objStr);
                if (obj.date && obj.description && typeof obj.amount === "number") {
                  objects.push(obj);
                }
              } catch {
                // Ignorer les objets invalides
              }
            }
            if (objects.length > 0) {
              parsedData = objects;
              console.log(`✅ Extraction partielle réussie : ${objects.length} transactions`);
            }
          }
          
          if (!parsedData) {
            throw new Error(
              `Impossible de parser la réponse d'OpenAI. Format JSON invalide. Longueur: ${jsonString.length} chars. Début: ${jsonString.substring(0, 300)}...`
            );
          }
        }
      }
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
    
    // Log détaillé pour le debugging
    if (error instanceof Error) {
      console.error("❌ Message d'erreur:", error.message);
      console.error("❌ Stack trace:", error.stack);
    } else {
      console.error("❌ Erreur non-Error:", JSON.stringify(error, null, 2));
    }

    // Gérer les erreurs spécifiques
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((issue) => issue.message).join(", ");
      throw new Error(`Données extraites invalides: ${errorMessages}`);
    }

    if (error instanceof Error) {
      // Renvoyer l'erreur avec un message clair
      throw new Error(
        `Erreur lors de l'extraction du PDF: ${error.message}. Veuillez vérifier que le fichier est un PDF valide et non protégé.`
      );
    }

    throw new Error(
      "Une erreur inattendue s'est produite lors de l'extraction du PDF. Veuillez réessayer ou contacter le support."
    );
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

