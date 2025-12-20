"use server";

/**
 * Server Actions pour l'import de relevés bancaires PDF
 *
 * Ce module permet de :
 * - Extraire le texte brut d'un PDF de relevé bancaire
 * - Utiliser GPT-4o pour parser les transactions
 * - Enregistrer les transactions dans la base de données
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { TransactionCategory, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { z } from "zod";

// pdf2json sera importé dynamiquement pour éviter les problèmes de build

/**
 * Schéma Zod pour valider une transaction extraite du PDF
 */
const ExtractedTransactionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  description: z.string().min(1, "La description est obligatoire"),
  amount: z.number().finite("Le montant doit être un nombre valide"),
  category: z.nativeEnum(TransactionCategory),
});

/**
 * Schéma Zod pour un compte bancaire détecté dans le PDF
 */
const ExtractedAccountSchema = z.object({
  name: z.string().min(1, "Le nom du compte est obligatoire"),
  balance: z.number().finite("Le solde doit être un nombre valide"),
  currency: z.string().default("EUR"),
});

/**
 * Schéma Zod pour la réponse complète incluant les comptes et transactions
 */
const ExtractedDataSchema = z.object({
  accounts: z.array(ExtractedAccountSchema).optional(), // Comptes détectés dans le PDF
  transactions: z.array(ExtractedTransactionSchema),
  closingBalance: z.number().nullable().optional(), // Solde final (rétrocompatibilité)
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
 * Type TypeScript pour un compte bancaire détecté
 */
export type ExtractedAccount = {
  name: string;
  balance: number;
  currency: string;
};

/**
 * Type TypeScript pour les données extraites (comptes + transactions)
 */
export type ExtractedData = {
  accounts?: ExtractedAccount[];
  transactions: ExtractedTransaction[];
  closingBalance?: number | null; // Rétrocompatibilité
};

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
 * 4. Utilise GPT-4o pour extraire les transactions et le solde final
 * 5. Retourne un objet avec les transactions validées et le solde final (si trouvé)
 *
 * @param formData - FormData contenant le fichier PDF sous la clé "pdf"
 * @returns {Promise<ExtractedData>} Objet avec transactions et closingBalance
 * @throws {Error} Si le PDF est invalide, si l'extraction échoue, ou si l'IA ne peut pas parser
 */
export async function extractDataFromPDF(
  formData: FormData
): Promise<ExtractedData> {
  try {
    console.log("🔍 Début de extractDataFromPDF");

    // 1. Récupérer le fichier PDF
    const file = formData.get("pdf") as File | null;

    if (!file) {
      console.error("❌ Aucun fichier PDF trouvé dans FormData");
      throw new Error("Aucun fichier PDF fourni");
    }

    console.log(
      `📄 Fichier reçu: ${file.name}, type: ${file.type}, taille: ${file.size} bytes`
    );

    // Validation du type de fichier
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      console.error(`❌ Type de fichier invalide: ${file.type}`);
      throw new Error("Le fichier doit être au format PDF");
    }

    // Validation de la taille (max 10 MB pour un PDF)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      console.error(`❌ Fichier trop volumineux: ${file.size} bytes`);
      throw new Error("Le fichier PDF est trop volumineux (maximum 10 MB)");
    }

    console.log(
      `📄 Extraction du texte du PDF: ${file.name} (${file.size} bytes)`
    );

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
          reject(
            new Error(
              `Erreur de parsing PDF: ${errData.parserError || "Erreur inconnue"}`
            )
          );
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
            reject(
              new Error(
                `Erreur lors de l'extraction du texte: ${extractError instanceof Error ? extractError.message : "Erreur inconnue"}`
              )
            );
          }
        });
      });

      // Lancer le parsing
      pdfParser.parseBuffer(buffer);

      // Attendre la fin du parsing
      extractedText = await parsePromise;

      if (!extractedText || extractedText.length === 0) {
        throw new Error(
          "Aucun texte n'a pu être extrait du PDF. Le fichier est peut-être une image scannée ou protégé par mot de passe."
        );
      }

      console.log(
        `✅ Texte extrait avec succès: ${extractedText.length} caractères`
      );
    } catch (parseError) {
      console.error("❌ Erreur lors du parsing PDF:", parseError);
      throw new Error(
        `Erreur lors de l'extraction du texte du PDF: ${
          parseError instanceof Error ? parseError.message : "Erreur inconnue"
        }`
      );
    }

    // 4. Vérifier que le texte extrait contient des données exploitables
    if (!extractedText || extractedText.trim().length < 50) {
      console.error("❌ Texte extrait trop court ou vide:", extractedText);
      throw new Error(
        "Le texte extrait du PDF est trop court ou vide. " +
          "Le PDF est peut-être une image scannée (OCR requis) ou protégé. " +
          `Texte extrait: "${extractedText.substring(0, 200)}..."`
      );
    }

    // Afficher un aperçu du texte extrait pour debugging
    console.log("📄 Aperçu du texte extrait (premiers 500 caractères):");
    console.log(extractedText.substring(0, 500));
    console.log("📄 Aperçu du texte extrait (derniers 500 caractères):");
    console.log(
      extractedText.substring(Math.max(0, extractedText.length - 500))
    );

    // 5. Nettoyer et limiter le texte si nécessaire
    // Si le texte est trop long, couper pour éviter d'exploser le quota OpenAI
    const maxTextLength = 15000;
    if (extractedText.length > maxTextLength) {
      console.log(
        `⚠️ Texte trop long (${extractedText.length} chars), tronqué à ${maxTextLength} chars`
      );
      extractedText = extractedText.substring(0, maxTextLength);
      extractedText += "\n\n[... texte tronqué pour optimisation ...]";
    }

    // 6. Appeler GPT-4o pour extraire les transactions
    console.log(
      `🤖 Envoi du texte à GPT-4o pour extraction des transactions... (${extractedText.length} caractères)`
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant comptable expert. Ta mission est d'analyser un relevé bancaire PDF et d'extraire :\n" +
            "1. LA LISTE DES COMPTES BANCAIRES présents dans le relevé\n" +
            "2. LES TRANSACTIONS de chaque compte\n" +
            "\n" +
            "ÉTAPE 1 - DÉTECTION DES COMPTES :\n" +
            "Cherche la section 'Résumé du solde', 'Comptes', 'Accounts', 'Balance Summary' ou équivalent.\n" +
            "Pour chaque compte trouvé (ex: 'Compte Courant', 'Pockets', 'Coffres', 'Savings'), extrais :\n" +
            "- name : nom du compte (ex: 'Compte Courant', 'Pockets')\n" +
            "- balance : solde actuel du compte (nombre décimal)\n" +
            "- currency : devise (ex: 'EUR', 'USD', par défaut 'EUR')\n" +
            "\n" +
            "ÉTAPE 2 - EXTRACTION DES TRANSACTIONS :\n" +
            "IGNORE : les totaux, les titres, les en-têtes, les dates de période.\n" +
            "EXTRAIS UNIQUEMENT : les lignes de transactions individuelles (mouvements bancaires).\n" +
            "Pour chaque transaction, retourne un objet avec exactement ces 4 champs :\n" +
            "- date : format STRICT YYYY-MM-DD (ex: 2024-12-14)\n" +
            "- description : texte du libellé/tiers (sans guillemets supplémentaires)\n" +
            "- amount : nombre décimal (POSITIF pour recette/crédit, NÉGATIF pour dépense/débit)\n" +
            "- category : une seule valeur parmi : TRANSPORT, REPAS, MATERIEL, PRESTATION, IMPOTS, SALAIRES, AUTRE\n" +
            "\n" +
            "IMPORTANT : Retourne UNIQUEMENT un objet JSON valide avec cette structure EXACTE :\n" +
            '{"accounts": [{"name": "Compte Courant", "balance": 1234.56, "currency": "EUR"}], "transactions": [{"date":"2024-12-14","description":"...","amount":-50.00,"category":"REPAS"}]}\n' +
            "\n" +
            "ATTENTION - DISTINCTION COMPTES vs TRANSACTIONS :\n" +
            "- Les COMPTES vont dans le tableau 'accounts' : {name, balance, currency}\n" +
            "- Les TRANSACTIONS vont dans le tableau 'transactions' : {date, description, amount, category}\n" +
            "- NE METS JAMAIS un compte dans le tableau 'transactions'\n" +
            "- NE METS JAMAIS une transaction dans le tableau 'accounts'\n" +
            "\n" +
            "RÈGLES STRICTES pour chaque transaction (dans 'transactions') :\n" +
            "- date : OBLIGATOIRE, format STRICT YYYY-MM-DD (ex: 2024-12-14). Si la date n'est pas trouvée, utilise la date du relevé ou une date par défaut.\n" +
            "- description : OBLIGATOIRE, chaîne de caractères non vide. Si absente, utilise 'Transaction non identifiée'.\n" +
            "- amount : OBLIGATOIRE, nombre décimal (POSITIF pour recette/crédit, NÉGATIF pour dépense/débit). Ne jamais retourner undefined ou null.\n" +
            "- category : OBLIGATOIRE, une des valeurs exactes : TRANSPORT, REPAS, MATERIEL, PRESTATION, IMPOTS, SALAIRES, AUTRE. Si incertain, utilise AUTRE.\n" +
            "\n" +
            "RÈGLES pour chaque compte (dans 'accounts') :\n" +
            "- name : OBLIGATOIRE, nom du compte (ex: 'Compte Courant', 'Pockets')\n" +
            "- balance : OBLIGATOIRE, solde actuel (nombre décimal)\n" +
            "- currency : OBLIGATOIRE, devise (ex: 'EUR', 'USD')\n" +
            "\n" +
            "NE RETOURNE JAMAIS de transactions avec des champs undefined ou null. Si une transaction est incomplète, ne l'inclus PAS dans le tableau.\n" +
            "\n" +
            'Si aucun compte n\'est trouvé, retourne : {"accounts": [], "transactions": [...]}\n' +
            'Si aucune transaction n\'est trouvée, retourne : {"accounts": [...], "transactions": []}\n' +
            "Sans texte avant/après, sans markdown, sans backticks.",
        },
        {
          role: "user",
          content:
            `Analyse ce relevé bancaire et extrais les comptes et transactions.\n\n` +
            `TEXTE DU RELEVÉ BANCAIRE:\n${extractedText}\n\n` +
            `RETOURNE UNIQUEMENT un objet JSON valide avec cette structure EXACTE:\n` +
            `{"accounts": [...], "transactions": [...]}\n\n` +
            `MÊME SI TU NE TROUVES RIEN, retourne au minimum: {"accounts": [], "transactions": []}\n` +
            `NE RETOURNE JAMAIS de texte explicatif, seulement le JSON.`,
        },
      ],
      temperature: 0.1, // Température basse pour plus de précision
      max_tokens: 4000, // Tokens max pour permettre plusieurs transactions
      // Note: On n'utilise pas response_format car on veut un tableau JSON, pas un objet
    });

    // 7. Extraire et parser le JSON de la réponse
    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("❌ Aucune réponse reçue d'OpenAI");
      console.error("📊 Réponse complète:", JSON.stringify(response, null, 2));
      throw new Error(
        "Aucune réponse reçue d'OpenAI. Vérifiez les logs pour plus de détails."
      );
    }

    console.log(
      `📄 Réponse brute d'OpenAI (${content.length} caractères, premiers 1000):`,
      content.substring(0, 1000)
    );
    console.log(
      `📄 Réponse brute d'OpenAI (derniers 500 caractères):`,
      content.substring(Math.max(0, content.length - 500))
    );

    // Nettoyer le contenu (retirer markdown code blocks si présent)
    let jsonString = content.trim();

    // Supprimer les backticks et markdown
    jsonString = jsonString
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/g, "");

    // Supprimer tout texte avant le premier [ ou {
    const firstBracket = jsonString.indexOf("[");
    const firstBrace = jsonString.indexOf("{");

    if (
      firstBracket !== -1 &&
      (firstBrace === -1 || firstBracket < firstBrace)
    ) {
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
      if (
        preParse &&
        typeof preParse === "object" &&
        !Array.isArray(preParse)
      ) {
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
          console.log(
            "🔧 Tentative de récupération : tableau JSON trouvé avec regex"
          );
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
          console.error(
            "📄 Contenu JSON brut (1000 premiers chars):",
            jsonString.substring(0, 1000)
          );
          console.error(
            "📄 Contenu JSON brut (1000 derniers chars):",
            jsonString.substring(Math.max(0, jsonString.length - 1000))
          );

          // Dernière tentative : extraire juste les objets valides
          const objects: any[] = [];
          const objectMatches = jsonString.match(/\{[^}]*"date"[^}]*\}/g);
          if (objectMatches) {
            console.log(
              `🔧 Dernière tentative : extraction de ${objectMatches.length} objets individuels`
            );
            for (const objStr of objectMatches) {
              try {
                const obj = JSON.parse(objStr);
                if (
                  obj.date &&
                  obj.description &&
                  typeof obj.amount === "number"
                ) {
                  objects.push(obj);
                }
              } catch {
                // Ignorer les objets invalides
              }
            }
            if (objects.length > 0) {
              parsedData = objects;
              console.log(
                `✅ Extraction partielle réussie : ${objects.length} transactions`
              );
            }
          }

          if (!parsedData) {
            console.error(
              "❌ Toutes les tentatives de parsing JSON ont échoué"
            );
            console.error("📄 JSON brut reçu:", jsonString);
            console.error("📄 Longueur:", jsonString.length);
            throw new Error(
              `Impossible de parser la réponse d'OpenAI. Format JSON invalide. ` +
                `Longueur: ${jsonString.length} chars. ` +
                `Début: ${jsonString.substring(0, 300)}... ` +
                `Fin: ...${jsonString.substring(Math.max(0, jsonString.length - 300))}`
            );
          }
        }
      }
    }

    // Vérifier que parsedData existe
    if (!parsedData) {
      console.error(
        "❌ parsedData est null/undefined après toutes les tentatives"
      );
      console.error("📄 JSON brut reçu:", jsonString);
      throw new Error(
        "Impossible de parser la réponse d'OpenAI. La réponse n'est pas au format JSON valide. " +
          "Vérifiez les logs serveur pour voir la réponse complète."
      );
    }

    // Vérifier que c'est un objet avec accounts et transactions
    let accounts: ExtractedAccount[] = [];
    let transactions: any[] = [];
    let closingBalance: number | null = null;

    console.log(
      "🔍 Type de données parsées:",
      Array.isArray(parsedData) ? "Array" : typeof parsedData
    );
    console.log(
      "🔍 Structure des données:",
      JSON.stringify(parsedData, null, 2).substring(0, 1000)
    );

    // Fonction helper pour détecter si un objet est un compte
    const isAccount = (obj: any): boolean => {
      return (
        obj &&
        typeof obj === "object" &&
        "name" in obj &&
        "balance" in obj &&
        !("date" in obj) &&
        !("description" in obj)
      );
    };

    // Fonction helper pour détecter si un objet est une transaction
    const isTransaction = (obj: any): boolean => {
      return (
        obj &&
        typeof obj === "object" &&
        ("date" in obj || "description" in obj || "amount" in obj) &&
        !("name" in obj && "balance" in obj && !("date" in obj))
      );
    };

    if (Array.isArray(parsedData)) {
      // Vérifier si c'est un tableau de comptes ou de transactions
      if (parsedData.length > 0) {
        const firstItem = parsedData[0];
        if (isAccount(firstItem)) {
          console.warn(
            "⚠️ Tableau de comptes détecté au lieu d'un objet avec accounts/transactions"
          );
          accounts = parsedData as any[];
          transactions = [];
        } else if (isTransaction(firstItem)) {
          console.log("📋 Tableau de transactions détecté (format ancien)");
          transactions = parsedData;
        } else {
          // Mélange ou format inconnu, essayer de séparer
          const detectedAccounts: any[] = [];
          const detectedTransactions: any[] = [];
          parsedData.forEach((item) => {
            if (isAccount(item)) {
              detectedAccounts.push(item);
            } else if (isTransaction(item)) {
              detectedTransactions.push(item);
            }
          });
          accounts = detectedAccounts;
          transactions = detectedTransactions;
          console.log(
            `🔍 Séparation: ${accounts.length} compte(s), ${transactions.length} transaction(s)`
          );
        }
      }
    } else if (parsedData && typeof parsedData === "object") {
      // Format nouveau (objet avec accounts et transactions)
      if (Array.isArray(parsedData.accounts)) {
        accounts = parsedData.accounts;
        console.log(
          `✅ ${accounts.length} compte(s) détecté(s) dans parsedData.accounts`
        );
      }
      if (Array.isArray(parsedData.transactions)) {
        // Vérifier que les éléments sont bien des transactions et non des comptes
        const rawTransactions = parsedData.transactions;
        const validTransactions = rawTransactions.filter((item) => {
          if (isAccount(item)) {
            console.warn(
              "⚠️ Objet de type compte trouvé dans transactions[], déplacé vers accounts"
            );
            accounts.push(item);
            return false;
          }
          return isTransaction(item) || true; // Accepter même si pas clairement identifié comme transaction
        });
        transactions = validTransactions;
        console.log(
          `✅ ${transactions.length} transaction(s) détectée(s) dans parsedData.transactions (${rawTransactions.length - transactions.length} compte(s) déplacé(s))`
        );
      } else {
        console.warn(
          "⚠️ parsedData.transactions n'est pas un tableau ou n'existe pas"
        );
      }
      // Rétrocompatibilité avec closingBalance
      if (typeof parsedData.closingBalance === "number") {
        closingBalance = parsedData.closingBalance;
      } else if (
        parsedData.closingBalance === null ||
        parsedData.closingBalance === undefined
      ) {
        closingBalance = null;
      }
    } else {
      throw new Error(
        "La réponse d'OpenAI doit être un objet avec 'accounts' et 'transactions' ou un tableau"
      );
    }

    console.log(
      `📊 Résultat du parsing: ${accounts.length} compte(s), ${transactions.length} transaction(s)`
    );

    // 8. Vérifier qu'on a bien des transactions à traiter
    console.log(
      `📊 État après parsing: ${accounts.length} compte(s), ${transactions.length} transaction(s)`
    );

    if (transactions.length === 0 && accounts.length === 0) {
      console.error(
        "❌ Aucune transaction ni compte trouvé dans la réponse de l'IA"
      );
      console.error(
        "📄 Données parsées complètes:",
        JSON.stringify(parsedData, null, 2)
      );
      console.error("📄 Réponse OpenAI complète:", content);

      throw new Error(
        "Aucune transaction ni compte trouvé dans le PDF. " +
          "Vérifiez que le PDF contient bien un relevé bancaire avec des transactions. " +
          "Le texte extrait du PDF peut être trop court ou ne pas contenir les informations attendues."
      );
    }

    if (transactions.length === 0) {
      console.warn("⚠️ Aucune transaction trouvée dans la réponse de l'IA");
      if (accounts.length > 0) {
        console.log(
          `ℹ️ ${accounts.length} compte(s) détecté(s) mais aucune transaction`
        );
        // Retourner avec les comptes seulement (pas d'erreur, juste pas de transactions)
        return {
          accounts: accounts.length > 0 ? accounts : undefined,
          transactions: [],
          closingBalance: closingBalance ?? undefined,
        };
      }
    }

    // 8. Filtrer et nettoyer les transactions avant validation
    // Supprimer les transactions incomplètes (avec des champs undefined/null)
    console.log(
      `📊 Analyse de ${transactions.length} transaction(s) reçue(s) de l'IA`
    );

    // Log détaillé de toutes les transactions reçues pour debugging
    if (transactions.length > 0) {
      console.log(
        "📄 Transactions brutes reçues:",
        JSON.stringify(transactions, null, 2)
      );
    }

    // Tentative de réparation automatique des transactions
    const repairedTransactions = transactions
      .map((tx, index) => {
        if (!tx || typeof tx !== "object") {
          return null;
        }

        const repaired: any = { ...tx };

        // Réparer la date si nécessaire
        if (repaired.date) {
          // Si c'est un nombre (timestamp), le convertir
          if (typeof repaired.date === "number") {
            const dateObj = new Date(repaired.date);
            if (!isNaN(dateObj.getTime())) {
              repaired.date = dateObj.toISOString().split("T")[0];
              console.log(
                `🔧 Transaction #${index + 1}: Date convertie depuis timestamp`
              );
            }
          }
          // Si c'est une string mais pas au bon format, essayer de la convertir
          else if (typeof repaired.date === "string") {
            // Format DD/MM/YYYY ou DD-MM-YYYY -> YYYY-MM-DD
            const dateMatch = repaired.date.match(
              /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/
            );
            if (dateMatch) {
              repaired.date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
              console.log(
                `🔧 Transaction #${index + 1}: Date reformatée de ${tx.date} vers ${repaired.date}`
              );
            }
            // Format YYYY/MM/DD -> YYYY-MM-DD
            else if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/.test(repaired.date)) {
              repaired.date = repaired.date.replace(/[\/\-]/g, "-");
              console.log(
                `🔧 Transaction #${index + 1}: Date reformatée de ${tx.date} vers ${repaired.date}`
              );
            }
          }
        }

        // Réparer la description si nécessaire
        if (!repaired.description || typeof repaired.description !== "string") {
          if (typeof repaired.description === "number") {
            repaired.description = String(repaired.description);
          } else {
            repaired.description =
              repaired.description?.toString() || "Transaction non identifiée";
          }
          console.log(`🔧 Transaction #${index + 1}: Description réparée`);
        }
        repaired.description = repaired.description.trim();

        // Réparer le montant si nécessaire
        if (typeof repaired.amount !== "number") {
          if (typeof repaired.amount === "string") {
            // Retirer les espaces et remplacer la virgule par un point
            const cleanedAmount = repaired.amount
              .replace(/\s/g, "")
              .replace(",", ".");
            const parsedAmount = parseFloat(cleanedAmount);
            if (!isNaN(parsedAmount)) {
              repaired.amount = parsedAmount;
              console.log(
                `🔧 Transaction #${index + 1}: Montant converti de "${tx.amount}" vers ${repaired.amount}`
              );
            }
          }
        }

        // Réparer la catégorie si nécessaire (mettre en majuscules)
        if (repaired.category && typeof repaired.category === "string") {
          const upperCategory = repaired.category.toUpperCase().trim();
          const validCategories = [
            "TRANSPORT",
            "REPAS",
            "MATERIEL",
            "PRESTATION",
            "IMPOTS",
            "SALAIRES",
            "AUTRE",
          ];
          if (validCategories.includes(upperCategory)) {
            repaired.category = upperCategory;
            if (upperCategory !== tx.category) {
              console.log(
                `🔧 Transaction #${index + 1}: Catégorie convertie de "${tx.category}" vers "${repaired.category}"`
              );
            }
          }
        }

        return repaired;
      })
      .filter((tx): tx is any => tx !== null);

    const cleanedTransactions = repairedTransactions.filter((tx, index) => {
      // Log détaillé de chaque transaction pour debugging
      console.log(`🔍 Analyse transaction #${index + 1}:`, {
        date: tx.date,
        dateType: typeof tx.date,
        description: tx.description,
        descriptionType: typeof tx.description,
        amount: tx.amount,
        amountType: typeof tx.amount,
        category: tx.category,
        categoryType: typeof tx.category,
      });

      // Vérifier que tous les champs requis sont présents et valides
      const hasDate =
        tx.date &&
        typeof tx.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(tx.date);
      const hasDescription =
        tx.description &&
        typeof tx.description === "string" &&
        tx.description.trim().length > 0;
      const hasAmount = typeof tx.amount === "number" && isFinite(tx.amount);
      const hasCategory =
        tx.category &&
        typeof tx.category === "string" &&
        [
          "TRANSPORT",
          "REPAS",
          "MATERIEL",
          "PRESTATION",
          "IMPOTS",
          "SALAIRES",
          "AUTRE",
        ].includes(tx.category);

      // Log détaillé des validations
      const validationResults = {
        hasDate,
        hasDescription,
        hasAmount,
        hasCategory,
      };
      console.log(
        `  ✅ Validations transaction #${index + 1}:`,
        validationResults
      );

      if (!hasDate || !hasDescription || !hasAmount || !hasCategory) {
        console.warn(`⚠️ Transaction #${index + 1} incomplète ignorée:`, {
          date: tx.date,
          dateValid: hasDate,
          description: tx.description,
          descriptionValid: hasDescription,
          amount: tx.amount,
          amountValid: hasAmount,
          category: tx.category,
          categoryValid: hasCategory,
          fullObject: JSON.stringify(tx, null, 2),
        });
        return false;
      }

      return true;
    });

    console.log(
      `📊 Nettoyage: ${transactions.length} transaction(s) reçue(s), ${cleanedTransactions.length} transaction(s) valide(s) après filtrage`
    );

    if (cleanedTransactions.length === 0 && transactions.length > 0) {
      // Log détaillé pour aider au debugging
      console.error("❌ Toutes les transactions ont été rejetées:");
      transactions.forEach((tx, index) => {
        console.error(
          `  Transaction #${index + 1}:`,
          JSON.stringify(tx, null, 2)
        );
      });

      // Préparer un exemple de transaction pour le message d'erreur
      const exampleTx = transactions[0];
      const exampleJson = exampleTx
        ? JSON.stringify(exampleTx, null, 2).substring(0, 500)
        : "Aucune transaction disponible";

      throw new Error(
        `Aucune transaction valide trouvée. ${transactions.length} transaction(s) reçue(s) mais toutes sont incomplètes après réparation automatique.\n\n` +
          `Exemple de transaction reçue:\n${exampleJson}\n\n` +
          `Format attendu pour chaque transaction:\n` +
          `{\n` +
          `  "date": "2024-12-14",  // Format YYYY-MM-DD (obligatoire)\n` +
          `  "description": "Libellé de la transaction",  // Texte non vide (obligatoire)\n` +
          `  "amount": -50.00,  // Nombre décimal, négatif pour dépense, positif pour recette (obligatoire)\n` +
          `  "category": "REPAS"  // Une de: TRANSPORT, REPAS, MATERIEL, PRESTATION, IMPOTS, SALAIRES, AUTRE (obligatoire)\n` +
          `}\n\n` +
          `Vérifiez les logs serveur pour plus de détails sur chaque transaction rejetée.`
      );
    }

    // 9. Valider les comptes et transactions avec Zod
    const validatedAccounts =
      accounts.length > 0
        ? accounts
            .map((acc) => {
              try {
                return ExtractedAccountSchema.parse(acc);
              } catch (error) {
                console.warn("⚠️ Compte invalide ignoré:", acc, error);
                return null;
              }
            })
            .filter((acc): acc is ExtractedAccount => acc !== null)
        : [];

    let validatedTransactions: ExtractedTransaction[];
    try {
      validatedTransactions =
        ExtractedTransactionsSchema.parse(cleanedTransactions);
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        // Log détaillé des erreurs de validation
        console.error("❌ Erreurs de validation Zod après nettoyage:");
        zodError.issues.forEach((issue, index) => {
          console.error(
            `  ${index + 1}. ${issue.path.join(".")}: ${issue.message}`
          );
        });
        if (cleanedTransactions.length > 0) {
          console.error(
            "📄 Exemple de transaction problématique:",
            JSON.stringify(cleanedTransactions[0], null, 2)
          );
        }
        // Relancer l'erreur pour qu'elle soit gérée par le catch global
        throw zodError;
      }
      throw zodError;
    }

    console.log(
      `✅ ${validatedAccounts.length} compte(s) détecté(s), ${validatedTransactions.length} transaction(s) extraite(s) et validée(s)`
    );
    if (validatedAccounts.length > 0) {
      console.log(
        `💰 Comptes détectés: ${validatedAccounts.map((a) => `${a.name} (${a.balance} ${a.currency})`).join(", ")}`
      );
    }
    if (closingBalance !== null) {
      console.log(
        `💰 Solde final détecté (rétrocompatibilité): ${closingBalance}`
      );
    }

    // Retourner un objet avec accounts, transactions et closingBalance (rétrocompatibilité)
    return {
      accounts: validatedAccounts.length > 0 ? validatedAccounts : undefined,
      transactions: validatedTransactions,
      closingBalance: closingBalance ?? undefined,
    };
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
      // Grouper les erreurs par type pour un message plus clair
      const errorsByPath = error.issues.reduce(
        (acc, issue) => {
          const path = issue.path.join(".");
          if (!acc[path]) {
            acc[path] = [];
          }
          acc[path].push(issue.message);
          return acc;
        },
        {} as Record<string, string[]>
      );

      const errorMessages = Object.entries(errorsByPath)
        .map(([path, messages]) => `${path}: ${messages.join(", ")}`)
        .join(" | ");

      console.error("❌ Détails des erreurs de validation:", errorsByPath);
      console.error(
        "📄 Nombre de transactions reçues:",
        error.issues.length,
        "erreur(s) de validation"
      );

      throw new Error(
        `Données extraites invalides: ${errorMessages}. ` +
          `Veuillez vérifier que le PDF contient bien des transactions complètes avec date, description, montant et catégorie.`
      );
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
 * 3. Crée ou met à jour les comptes bancaires détectés dans le PDF
 * 4. Crée toutes les transactions dans Prisma (liées au premier compte par défaut)
 * 5. Revalide le cache des pages
 *
 * @param transactions - Tableau de transactions à enregistrer
 * @param accounts - Liste des comptes détectés dans le PDF (optionnel)
 * @returns {Promise<{ success: true; count: number; accountsCreated: number; accountsUpdated: number }>} Succès avec statistiques
 * @throws {Error} Si les données sont invalides, si l'utilisateur n'est pas connecté, ou en cas d'erreur Prisma
 */
export async function saveImportedTransactions(
  transactions: ExtractedTransaction[],
  accounts?: ExtractedAccount[]
): Promise<{
  success: true;
  count: number;
  accountsCreated: number;
  accountsUpdated: number;
}> {
  try {
    // 1. Valider les données avec Zod
    const validatedTransactions =
      ExtractedTransactionsSchema.parse(transactions);

    if (validatedTransactions.length === 0) {
      throw new Error("Aucune transaction à enregistrer");
    }

    // 2. Récupérer l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const companyId = user.companies[0].id;

    console.log(
      `💾 Enregistrement de ${validatedTransactions.length} transactions pour l'utilisateur ${user.id}...`
    );

    // 3. Créer ou mettre à jour les comptes bancaires détectés
    let accountsCreated = 0;
    let accountsUpdated = 0;
    let primaryAccountId: string | null = null;

    if (accounts && accounts.length > 0) {
      console.log(
        `📋 Traitement de ${accounts.length} compte(s) détecté(s)...`
      );

      for (const account of accounts) {
        try {
          // Chercher un compte existant avec ce nom (type MANUAL) pour cet utilisateur
          const existingAccount = await prisma.bankAccount.findFirst({
            where: {
              userId: user.id,
              bankName: {
                contains: account.name,
                mode: "insensitive",
              },
              type: "MANUAL",
            },
          });

          if (existingAccount) {
            // Mettre à jour le solde du compte existant
            try {
              await prisma.bankAccount.update({
                where: { id: existingAccount.id },
                data: {
                  currentBalance: account.balance,
                  currency: account.currency,
                } as any, // Utiliser 'as any' pour gérer les champs optionnels
              });
              accountsUpdated++;
              console.log(
                `✅ Compte '${account.name}' mis à jour: ${account.balance} ${account.currency}`
              );
              if (!primaryAccountId) {
                primaryAccountId = existingAccount.id;
              }
            } catch (updateError: any) {
              // Si currentBalance n'existe pas encore, essayer sans
              if (
                updateError?.message?.includes("currentBalance") ||
                updateError?.message?.includes("Unknown field")
              ) {
                console.warn(
                  `⚠️ Champ currentBalance non disponible pour '${account.name}', mise à jour ignorée`
                );
              } else {
                throw updateError;
              }
            }
          } else {
            // Créer un nouveau compte manuel
            try {
              const newAccount = await prisma.bankAccount.create({
                data: {
                  userId: user.id,
                  bankName: account.name,
                  mask: null,
                  type: "MANUAL",
                  itemId: null,
                  accessToken: null,
                  cursor: null,
                  lastSyncedAt: null,
                  currentBalance: account.balance,
                  currency: account.currency,
                } as any, // Utiliser 'as any' pour gérer les champs optionnels
              });
              accountsCreated++;
              console.log(
                `✅ Compte '${account.name}' créé: ${account.balance} ${account.currency}`
              );
              if (!primaryAccountId) {
                primaryAccountId = newAccount.id;
              }
            } catch (createError: any) {
              // Si type ou currentBalance n'existent pas encore, créer sans
              if (
                createError?.message?.includes("type") ||
                createError?.message?.includes("currentBalance") ||
                createError?.message?.includes("Unknown argument")
              ) {
                console.warn(
                  `⚠️ Champs manquants, création du compte '${account.name}' sans type/solde`
                );
                const newAccount = await prisma.bankAccount.create({
                  data: {
                    userId: user.id,
                    bankName: account.name,
                    mask: null,
                    itemId: null,
                    accessToken: null,
                    cursor: null,
                    lastSyncedAt: null,
                    currency: account.currency,
                  },
                });
                accountsCreated++;
                if (!primaryAccountId) {
                  primaryAccountId = newAccount.id;
                }
              } else {
                throw createError;
              }
            }
          }
        } catch (accountError) {
          console.error(
            `❌ Erreur lors du traitement du compte '${account.name}':`,
            accountError
          );
          // Continuer avec les autres comptes même si un échoue
        }
      }
    }

    // 4. Créer toutes les transactions dans Prisma (liées au premier compte si disponible)
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
        const type: TransactionType =
          tx.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;

        // Créer la transaction (liée au premier compte détecté si disponible)
        return prisma.transaction.create({
          data: {
            amount,
            type,
            category: tx.category,
            description: tx.description,
            date: transactionDate,
            companyId,
            bankAccountId: primaryAccountId,
            status: "COMPLETED", // Les transactions de relevés sont toujours complètes
          },
        });
      })
    );

    console.log(
      `✅ ${createdTransactions.length} transactions créées avec succès`
    );

    // 5. Revalider le cache des pages
    revalidatePath("/");
    revalidatePath("/transactions");
    revalidatePath("/settings/bank");

    return {
      success: true,
      count: createdTransactions.length,
      accountsCreated,
      accountsUpdated,
    };
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'enregistrement des transactions:",
      error
    );

    // Gérer les erreurs spécifiques
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((issue) => issue.message)
        .join(", ");
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
