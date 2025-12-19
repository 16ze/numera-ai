"use server";

/**
 * Server Actions pour la gestion des documents (PDF/Images)
 * Upload, extraction de texte et analyse IA
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { getSupabaseServerClient } from "@/app/lib/supabase-client";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import OpenAI from "openai";

/**
 * Client OpenAI pour l'API Vision (extraction texte depuis images)
 */
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper : Extrait le texte d'un fichier (PDF ou Image)
 * @param file - Le fichier à analyser
 * @returns Le texte extrait ou un message d'erreur explicite
 */
async function extractText(file: File): Promise<string> {
  console.log("📄 ===== DÉBUT EXTRACTION TEXTE =====");
  console.log(`📦 Nom du fichier: ${file.name}`);
  console.log(`📏 Taille du fichier reçue: ${file.size} bytes (${(file.size / 1024).toFixed(2)} KB)`);
  console.log(`🏷️ Type MIME détecté: ${file.type}`);

  try {
    // Conversion du fichier en Buffer
    console.log("🔄 Conversion du fichier en Buffer...");
    const arrayBuffer = await file.arrayBuffer();
    console.log(`✅ ArrayBuffer créé: ${arrayBuffer.byteLength} bytes`);
    
    const buffer = Buffer.from(arrayBuffer);
    console.log(`✅ Buffer créé: ${buffer.length} bytes`);
    
    const fileType = file.type;

    // ============================================
    // EXTRACTION PDF
    // ============================================
    if (fileType === "application/pdf") {
      console.log("📑 DÉBUT EXTRACTION PDF");
      
      try {
        // Utilisation de pdf2json (robuste en environnement Node.js pur)
        console.log("📥 Import dynamique de pdf2json...");
        
        // Import dynamique pour éviter les problèmes ESM/CommonJS
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const PDFParser = require("pdf2json");
        console.log("✅ Module pdf2json importé");

        // Envelopper pdf2json dans une Promise (car il utilise des callbacks)
        const pdfText = await new Promise<string>((resolve, reject) => {
          // Créer une instance de PDFParser (null = pas de callback, 1 = mode texte brut)
          const pdfParser = new PDFParser(null, 1);
          
          // Gérer les erreurs de parsing
          pdfParser.on("pdfParser_dataError", (errData: any) => {
            console.error("❌ Erreur parsing PDF:", errData);
            const errorMsg = errData.parserError || errData.message || "Erreur inconnue lors du parsing PDF";
            reject(new Error(`Erreur parsing PDF: ${errorMsg}`));
          });
          
          // Quand le parsing est terminé
          pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            try {
              console.log("✅ PDF parsé avec succès");
              
              // Extraire le texte brut avec getRawTextContent()
              const rawText = pdfParser.getRawTextContent();
              
              if (!rawText || rawText.trim().length === 0) {
                console.warn("⚠️ PDF parsé mais texte vide - format image détecté");
                resolve(""); // Retourner chaîne vide pour détecter PDF scanné
              } else {
                console.log(`📝 Texte brut extrait: ${rawText.length} caractères`);
                resolve(rawText);
              }
            } catch (extractError) {
              console.error("❌ Erreur lors de l'extraction du texte:", extractError);
              reject(new Error(`Erreur extraction texte: ${extractError instanceof Error ? extractError.message : "Erreur inconnue"}`));
            }
          });
          
          // Lancer le parsing du buffer
          try {
            pdfParser.parseBuffer(buffer);
          } catch (parseError) {
            console.error("❌ Erreur lors du parseBuffer:", parseError);
            reject(new Error(`Erreur parseBuffer: ${parseError instanceof Error ? parseError.message : "Erreur inconnue"}`));
          }
        });

        // Vérification que le texte existe
        if (!pdfText || pdfText.trim().length === 0) {
          console.warn("⚠️ PDF non lisible - format image détecté");
          return "PDF non lisible, format image détecté";
        }

        const rawText = pdfText;
        console.log(`📄 Texte brut (premiers 200 chars): ${rawText.substring(0, 200)}...`);

        // Nettoyage du texte : remplace les sauts de ligne multiples par un seul
        console.log("🧹 Nettoyage du texte...");
        const cleanedText = rawText
          .replace(/\n\n+/g, '\n') // Retire les sauts de ligne excessifs
          .trim();

        console.log(`✅ Texte nettoyé: ${cleanedText.length} caractères`);

        // CRUCIAL : Détection de PDF scanné (texte très court)
        if (cleanedText.length < 50) {
          console.warn(`⚠️ PDF Scanné détecté: seulement ${cleanedText.length} caractères extraits`);
          return "PDF non lisible, format image détecté";
        }

        console.log(`✅ Texte PDF extrait avec succès : ${cleanedText.length} caractères`);
        return cleanedText;
      } catch (pdfError) {
        console.error("❌ ERREUR lors de l'extraction PDF:");
        console.error("   Type:", pdfError instanceof Error ? pdfError.constructor.name : typeof pdfError);
        console.error("   Message:", pdfError instanceof Error ? pdfError.message : String(pdfError));
        console.error("   Stack:", pdfError instanceof Error ? pdfError.stack : "N/A");
        
        // Retourner un message d'erreur explicite (ne pas throw pour éviter de planter)
        const errorMessage = pdfError instanceof Error 
          ? pdfError.message 
          : "Erreur inconnue lors de l'extraction PDF";
        
        // Si c'est une erreur de parsing, retourner un message spécifique
        if (errorMessage.includes("parsing") || errorMessage.includes("parse")) {
          return "PDF non lisible, format image détecté";
        }
        
        return `[ERREUR EXTRACTION: ${errorMessage}]`;
      }
    }

    // ============================================
    // EXTRACTION IMAGE (OCR avec GPT-4o Vision)
    // ============================================
    if (
      fileType.startsWith("image/") &&
      ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(fileType)
    ) {
      console.log("🖼️ DÉBUT EXTRACTION IMAGE (OCR)");
      
      try {
        // Normaliser le type MIME (OpenAI n'accepte que jpeg, pas jpg)
        const normalizedMimeType =
          fileType === "image/jpg" ? "image/jpeg" : fileType;
        console.log(`🔄 Type MIME normalisé: ${normalizedMimeType}`);

        // Conversion du buffer en Base64
        console.log("🔄 Conversion buffer en Base64...");
        const base64String = buffer.toString("base64");
        console.log(`✅ Base64 créé: ${base64String.length} caractères`);
        
        const dataUrl = `data:${normalizedMimeType};base64,${base64String}`;
        console.log(`✅ Data URL créé: ${dataUrl.length} caractères`);

        console.log("🤖 Appel OpenAI Vision API (gpt-4o)...");

        // Appel à l'API OpenAI Vision (gpt-4o requis pour la précision OCR)
        const response = await openaiClient.chat.completions.create({
          model: "gpt-4o", // Vision/OCR : garder gpt-4o pour la précision
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcris tout le texte visible sur ce document de manière fidèle et structurée.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: dataUrl,
                    detail: "high", // Détail élevé pour meilleure précision OCR
                  },
                },
              ],
            },
          ],
          max_tokens: 4000, // Limite pour éviter les coûts excessifs
        });

        console.log("✅ Réponse OpenAI reçue");
        const extractedText =
          response.choices[0]?.message?.content?.trim() || "";

        if (!extractedText) {
          console.warn("⚠️ Image analysée mais texte vide dans la réponse");
          throw new Error("OCR Vision: Aucun texte détecté dans l'image");
        }

        console.log(`✅ Texte Image extrait : ${extractedText.length} caractères`);
        return extractedText;
      } catch (visionError) {
        console.error("❌ ERREUR lors de l'extraction Image:");
        console.error("   Type:", visionError instanceof Error ? visionError.constructor.name : typeof visionError);
        console.error("   Message:", visionError instanceof Error ? visionError.message : String(visionError));
        console.error("   Stack:", visionError instanceof Error ? visionError.stack : "N/A");
        
        // Retourner un message d'erreur explicite
        const errorMessage = visionError instanceof Error 
          ? visionError.message 
          : "Erreur inconnue lors de l'extraction image";
        
        throw new Error(`Erreur OCR Vision: ${errorMessage}`);
      }
    }

    // Type de fichier non supporté
    console.error(`❌ Type de fichier non supporté: ${fileType}`);
    throw new Error(`Type de fichier non supporté: ${fileType}. Formats acceptés: PDF, JPEG, PNG, WebP`);
  } catch (error) {
    console.error("❌ ERREUR GLOBALE dans extractText:");
    console.error("   Type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("   Message:", error instanceof Error ? error.message : String(error));
    console.error("   Stack:", error instanceof Error ? error.stack : "N/A");
    console.log("📄 ===== FIN EXTRACTION TEXTE (ERREUR) =====");
    
    // Retourner le message d'erreur précis au lieu d'une chaîne vide
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Erreur inconnue lors de l'extraction";
    
    return `[ERREUR EXTRACTION: ${errorMessage}]`;
  }
}

/**
 * Upload et analyse d'un document (PDF ou Image)
 * @param formData - FormData contenant le fichier et optionnellement clientId
 * @param clientId - ID du client associé (optionnel)
 * @param folderId - ID du dossier cible (optionnel, null = racine)
 */
export async function uploadAndAnalyzeDocument(
  formData: FormData,
  clientId?: string,
  folderId?: string | null
) {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    // 2. Extraction du fichier depuis FormData
    const file = formData.get("file") as File;
    if (!file) {
      throw new Error("Aucun fichier fourni");
    }

    // 3. Vérification du type de fichier
    const fileType = file.type;
    const isPDF = fileType === "application/pdf";
    const isImage =
      fileType.startsWith("image/") &&
      ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
        fileType
      );

    if (!isPDF && !isImage) {
      throw new Error(
        "Type de fichier non supporté. Formats acceptés : PDF, JPEG, PNG, WebP"
      );
    }

    // 4. Vérification de la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Le fichier est trop volumineux (max 10MB)");
    }

    // 5. Génération d'un nom unique pour le fichier
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${user.id}/${timestamp}_${sanitizedName}`;

    // 6. Conversion du fichier en Buffer pour Supabase
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 7. Upload vers Supabase Storage (bucket 'documents')
    const supabase = getSupabaseServerClient();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Erreur upload Supabase:", uploadError);
      throw new Error(`Erreur lors de l'upload : ${uploadError.message}`);
    }

    // 8. Récupération de l'URL publique
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error("Impossible de récupérer l'URL publique du fichier");
    }

    // 9. Extraction du texte via la fonction helper
    console.log("📄 Début extraction texte...");
    let extractedText = "";
    try {
      extractedText = await extractText(file);
      
      // Vérifier si c'est un message d'erreur
      if (extractedText.startsWith("[ERREUR EXTRACTION:")) {
        console.warn("⚠️ Extraction échouée, message d'erreur retourné");
        // On garde le message d'erreur tel quel pour debugging
      } else if (!extractedText || extractedText.trim().length === 0) {
        console.warn("⚠️ Aucun texte extrait du document");
        extractedText = "[ERREUR EXTRACTION: Aucun texte extrait - Document peut-être vide ou corrompu]";
      } else {
        console.log(`✅ Extraction réussie: ${extractedText.length} caractères`);
      }
    } catch (extractError) {
      console.error("❌ Erreur extraction texte (catch):", extractError);
      // Message d'erreur précis pour debugging
      extractedText = `[ERREUR EXTRACTION: ${
        extractError instanceof Error ? extractError.message : "Erreur inconnue"
      }]`;
    }

    // 10. Génération d'un résumé par l'IA (optionnel, seulement si texte extrait)
    let summary: string | null = null;
    if (extractedText && extractedText.length > 50 && !extractedText.startsWith("[")) {
      try {
        const { text: summaryText } = await generateText({
          model: openai("gpt-4o-mini"), // Optimisation coûts : résumé texte → mini
          prompt: `Génère un résumé concis en 2 phrases maximum de ce document :\n\n${extractedText.substring(0, 4000)}`,
        });
        summary = summaryText || null;
      } catch (summaryError) {
        console.error("❌ Erreur lors de la génération du résumé:", summaryError);
        // On continue même si le résumé échoue
      }
    }

    // 11. Vérification du clientId si fourni
    let validClientId: string | null = null;
    if (clientId) {
      const company = user.companies[0];
      if (company) {
        const client = await prisma.client.findFirst({
          where: {
            id: clientId,
            companyId: company.id,
          },
        });
        if (client) {
          validClientId = clientId;
        }
      }
    }

    // 12. Vérification du folderId si fourni
    let validFolderId: string | null = null;
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          userId: user.id,
        },
      });
      if (folder) {
        validFolderId = folderId;
      }
    }

    // 13. Sauvegarde dans la base de données
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        clientId: validClientId,
        folderId: validFolderId,
        name: file.name,
        url: publicUrl,
        type: isPDF ? "PDF" : "IMAGE",
        extractedText: extractedText,
        summary: summary,
      },
    });

    // 14. Revalidation du path
    revalidatePath("/documents");

    return {
      success: true,
      documentId: document.id,
      message: "Document uploadé et analysé avec succès",
    };
  } catch (error) {
    console.error("❌ ERREUR lors de l'upload et de l'analyse:", error);
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "N/A"
    );
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de l'upload et de l'analyse du document"
    );
  }
}

/**
 * Supprime un document
 * @param documentId - ID du document à supprimer
 */
export async function deleteDocument(documentId: string) {
  try {
    const user = await getCurrentUser();

    // Vérifier que le document appartient à l'utilisateur
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id,
      },
    });

    if (!document) {
      throw new Error("Document non trouvé ou accès refusé");
    }

    // Supprimer le fichier de Supabase Storage
    const supabase = getSupabaseServerClient();
    const fileName = document.url.split("/").slice(-2).join("/"); // Extraire le chemin relatif
    await supabase.storage.from("documents").remove([fileName]);

    // Supprimer l'entrée en base de données
    await prisma.document.delete({
      where: {
        id: documentId,
      },
    });

    revalidatePath("/documents");

    return { success: true, message: "Document supprimé avec succès" };
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la suppression du document"
    );
  }
}

/**
 * Récupère tous les documents de l'utilisateur (à la racine uniquement)
 * @deprecated Utilisez getFileSystem() à la place pour la navigation par dossiers
 */
export async function getDocuments() {
  try {
    const user = await getCurrentUser();

    const documents = await prisma.document.findMany({
      where: {
        userId: user.id,
        folderId: null, // Seulement les documents à la racine
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return documents;
  } catch (error) {
    console.error("Erreur lors de la récupération des documents:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la récupération des documents"
    );
  }
}
