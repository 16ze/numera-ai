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

/**
 * Upload et analyse d'un document (PDF ou Image)
 * @param formData - FormData contenant le fichier et optionnellement clientId
 * @param clientId - ID du client associé (optionnel)
 */
export async function uploadAndAnalyzeDocument(
  formData: FormData,
  clientId?: string
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
      ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(fileType);

    if (!isPDF && !isImage) {
      throw new Error(
        "Type de fichier non supporté. Formats acceptés : PDF, JPEG, PNG, WebP"
      );
    }

    // 4. Génération d'un nom unique pour le fichier
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${user.id}/${timestamp}_${sanitizedName}`;

    // 5. Conversion du fichier en Buffer pour Supabase
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 6. Upload vers Supabase Storage (bucket 'documents')
    const supabase = getSupabaseServerClient();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Erreur lors de l'upload : ${uploadError.message}`);
    }

    // 7. Récupération de l'URL publique
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error("Impossible de récupérer l'URL publique du fichier");
    }

    // 8. Extraction du texte selon le type
    let extractedText = "";
    let summary: string | null = null;

    if (isPDF) {
      // Extraction texte depuis PDF avec pdf-parse
      try {
        // Import dynamique pour éviter les problèmes d'import ESM/CommonJS
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || "";
      } catch (pdfError) {
        console.error("Erreur lors de l'extraction PDF:", pdfError);
        extractedText = "[Erreur lors de l'extraction du texte du PDF]";
      }
    } else if (isImage) {
      // Extraction texte depuis Image avec GPT-4o Vision
      try {
        // Convertir l'image en base64 data URL
        const base64Image = buffer.toString("base64");
        const mimeType = fileType;
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const { text } = await generateText({
          model: openai("gpt-4o"),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  image: dataUrl,
                },
                {
                  type: "text",
                  text: "Transcris fidèlement tout le texte visible sur cette image. Retourne uniquement le texte, sans commentaire.",
                },
              ],
            },
          ],
        });
        extractedText = text || "";
      } catch (visionError) {
        console.error("Erreur lors de l'extraction image:", visionError);
        extractedText = "[Erreur lors de l'extraction du texte de l'image]";
      }
    }

    // 9. Génération d'un résumé par l'IA (optionnel, seulement si texte extrait)
    if (extractedText && extractedText.length > 50) {
      try {
        const { text: summaryText } = await generateText({
          model: openai("gpt-4o"),
          prompt: `Génère un résumé concis en 2 phrases maximum de ce document :\n\n${extractedText.substring(0, 4000)}`,
        });
        summary = summaryText || null;
      } catch (summaryError) {
        console.error("Erreur lors de la génération du résumé:", summaryError);
        // On continue même si le résumé échoue
      }
    }

    // 10. Vérification du clientId si fourni
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

    // 11. Sauvegarde dans la base de données
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        clientId: validClientId,
        name: file.name,
        url: publicUrl,
        type: isPDF ? "PDF" : "IMAGE",
        extractedText: extractedText,
        summary: summary,
      },
    });

    // 12. Revalidation du path
    revalidatePath("/documents");

    return {
      success: true,
      documentId: document.id,
      message: "Document uploadé et analysé avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de l'upload et de l'analyse:", error);
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
 * Récupère tous les documents de l'utilisateur
 */
export async function getDocuments() {
  try {
    const user = await getCurrentUser();

    const documents = await prisma.document.findMany({
      where: {
        userId: user.id,
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
