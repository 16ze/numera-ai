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
 * @returns Le texte extrait ou une chaîne vide en cas d'erreur
 */
async function extractText(file: File): Promise<string> {
  try {
    // Conversion du fichier en Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileType = file.type;

    // ============================================
    // EXTRACTION PDF
    // ============================================
    if (fileType === "application/pdf") {
      try {
        // Import dynamique de pdf-parse pour éviter les problèmes ESM/CommonJS
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(buffer);

        if (!pdfData || !pdfData.text) {
          console.warn("⚠️ PDF parsé mais texte vide");
          return "";
        }

        // Nettoyage du texte : retire les espaces multiples et les sauts de ligne excessifs
        const cleanedText = pdfData.text
          .replace(/\s+/g, " ") // Remplace tous les espaces multiples par un seul espace
          .replace(/\n\s*\n/g, "\n\n") // Remplace les sauts de ligne multiples par deux max
          .trim();

        console.log(`✅ Texte PDF extrait : ${cleanedText.length} caractères`);
        return cleanedText;
      } catch (pdfError) {
        console.error("❌ ERREUR lors de l'extraction PDF:", pdfError);
        console.error("Stack trace:", pdfError instanceof Error ? pdfError.stack : "N/A");
        throw new Error(
          `Erreur lors de l'extraction du texte du PDF : ${
            pdfError instanceof Error ? pdfError.message : "Erreur inconnue"
          }`
        );
      }
    }

    // ============================================
    // EXTRACTION IMAGE (OCR avec GPT-4o Vision)
    // ============================================
    if (
      fileType.startsWith("image/") &&
      ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(fileType)
    ) {
      try {
        // Normaliser le type MIME (OpenAI n'accepte que jpeg, pas jpg)
        const normalizedMimeType =
          fileType === "image/jpg" ? "image/jpeg" : fileType;

        // Conversion du buffer en Base64
        const base64String = buffer.toString("base64");
        const dataUrl = `data:${normalizedMimeType};base64,${base64String}`;

        console.log("🤖 Appel OpenAI Vision API...");

        // Appel à l'API OpenAI Vision
        const response = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcris tout le texte visible sur ce document de manière structurée. Retourne uniquement le texte, sans commentaire ni explication.",
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

        const extractedText =
          response.choices[0]?.message?.content?.trim() || "";

        if (!extractedText) {
          console.warn("⚠️ Image analysée mais texte vide");
          return "";
        }

        console.log(`✅ Texte Image extrait : ${extractedText.length} caractères`);
        return extractedText;
      } catch (visionError) {
        console.error("❌ ERREUR lors de l'extraction Image:", visionError);
        console.error(
          "Type d'erreur:",
          visionError instanceof Error ? visionError.constructor.name : typeof visionError
        );
        console.error(
          "Message d'erreur:",
          visionError instanceof Error ? visionError.message : String(visionError)
        );
        console.error(
          "Stack trace:",
          visionError instanceof Error ? visionError.stack : "N/A"
        );
        throw new Error(
          `Erreur lors de l'extraction du texte de l'image : ${
            visionError instanceof Error ? visionError.message : "Erreur inconnue"
          }`
        );
      }
    }

    // Type de fichier non supporté
    throw new Error(`Type de fichier non supporté : ${fileType}`);
  } catch (error) {
    console.error("❌ ERREUR GLOBALE dans extractText:", error);
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "N/A"
    );
    // Retourner une chaîne vide plutôt que de planter complètement
    return "";
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
      if (!extractedText || extractedText.trim().length === 0) {
        console.warn("⚠️ Aucun texte extrait du document");
        extractedText = "[Aucun texte extrait de ce document]";
      }
    } catch (extractError) {
      console.error("❌ Erreur extraction texte:", extractError);
      // On continue même si l'extraction échoue, mais on enregistre un message d'erreur
      extractedText = `[Erreur lors de l'extraction du texte : ${
        extractError instanceof Error ? extractError.message : "Erreur inconnue"
      }]`;
    }

    // 10. Génération d'un résumé par l'IA (optionnel, seulement si texte extrait)
    let summary: string | null = null;
    if (extractedText && extractedText.length > 50 && !extractedText.startsWith("[")) {
      try {
        const { text: summaryText } = await generateText({
          model: openai("gpt-4o"),
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
