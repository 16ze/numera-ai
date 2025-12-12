"use server";

/**
 * Server Actions pour l'upload de logo d'entreprise vers Supabase Storage
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { supabase } from "@/app/lib/supabase-client";
import { updateCompanyDetails } from "@/app/actions/company";
import { revalidatePath } from "next/cache";

/**
 * Upload un logo d'entreprise vers Supabase Storage et met à jour l'URL dans la base de données
 *
 * @param formData - FormData contenant le fichier image (champ "logo")
 * @returns {Promise<{ success: true; logoUrl: string }>} URL publique du logo uploadé
 * @throws {Error} Si l'upload échoue ou si l'utilisateur n'est pas connecté
 */
export async function uploadCompanyLogo(
  formData: FormData
): Promise<{ success: true; logoUrl: string }> {
  try {
    // 1. Récupération de l'utilisateur connecté
    const user = await getCurrentUser();

    if (!user.companies || user.companies.length === 0) {
      throw new Error("Aucune entreprise trouvée pour cet utilisateur");
    }

    const company = user.companies[0];
    const companyId = company.id;

    // 2. Récupération du fichier depuis FormData
    const file = formData.get("logo") as File;

    if (!file) {
      throw new Error("Aucun fichier fourni");
    }

    // 3. Validation du type de fichier (images uniquement)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        "Type de fichier non autorisé. Utilisez une image (JPEG, PNG, GIF, WebP)"
      );
    }

    // 4. Validation de la taille (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error("Le fichier est trop volumineux. Taille maximale : 5MB");
    }

    // 5. Génération d'un nom de fichier unique (companyId-timestamp.ext)
    const fileExt = file.name.split(".").pop();
    const fileName = `${companyId}-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    // 6. Conversion du fichier en ArrayBuffer pour Supabase
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 7. Upload vers Supabase Storage (bucket "logos")
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("logos")
      .upload(filePath, uint8Array, {
        contentType: file.type,
        upsert: false, // Ne pas écraser les fichiers existants
      });

    if (uploadError) {
      console.error("Erreur upload Supabase:", uploadError);
      throw new Error(
        `Erreur lors de l'upload : ${uploadError.message}`
      );
    }

    // 8. Récupération de l'URL publique du fichier
    const {
      data: { publicUrl },
    } = supabase.storage.from("logos").getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error("Impossible de récupérer l'URL publique du logo");
    }

    // 9. Suppression de l'ancien logo si il existe (optionnel, pour économiser l'espace)
    if (company.logoUrl) {
      try {
        // Extraire le nom de fichier de l'ancienne URL (après /logos/)
        const oldUrlParts = company.logoUrl.split("/logos/");
        if (oldUrlParts.length > 1) {
          const oldFileName = oldUrlParts[1].split("?")[0]; // Retirer les query params
          if (oldFileName) {
            await supabase.storage.from("logos").remove([oldFileName]);
          }
        }
      } catch (error) {
        // Ne pas bloquer si la suppression de l'ancien logo échoue
        console.warn("Impossible de supprimer l'ancien logo:", error);
      }
    }

    // 10. Mise à jour de l'URL du logo dans la base de données
    await updateCompanyDetails({
      logoUrl: publicUrl,
    });

    console.log(`✅ Logo uploadé avec succès pour company ${companyId}: ${publicUrl}`);

    // 11. Revalidation des caches
    revalidatePath("/settings");
    revalidatePath("/invoices");

    return {
      success: true,
      logoUrl: publicUrl,
    };
  } catch (error) {
    console.error("❌ Erreur lors de l'upload du logo:", error);
    throw error instanceof Error
      ? error
      : new Error("Erreur lors de l'upload du logo");
  }
}

