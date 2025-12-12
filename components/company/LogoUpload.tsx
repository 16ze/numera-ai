"use client";

/**
 * Composant pour uploader le logo de l'entreprise
 * Utilise Supabase Storage pour stocker l'image
 */

import { useState, useRef } from "react";
import { uploadCompanyLogo } from "@/app/actions/upload-logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Props du composant LogoUpload
 */
interface LogoUploadProps {
  /** URL du logo actuel (optionnel) */
  currentLogoUrl?: string | null;
  /** Nom de l'entreprise (pour l'avatar fallback) */
  companyName: string;
}

/**
 * Composant pour uploader et afficher le logo de l'entreprise
 */
export function LogoUpload({
  currentLogoUrl,
  companyName,
}: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentLogoUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Gère la sélection d'un fichier
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation du type
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    // Validation de la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux. Taille maximale : 5MB");
      return;
    }

    // Création d'une preview locale
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload du fichier
    handleUpload(file);
  };

  /**
   * Upload le fichier vers Supabase
   */
  const handleUpload = async (file: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const result = await uploadCompanyLogo(formData);

      toast.success("Logo mis à jour avec succès !");
      setPreviewUrl(result.logoUrl);

      // Rafraîchir la page pour afficher le nouveau logo
      window.location.reload();
    } catch (error) {
      console.error("Erreur upload logo:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue lors de l'upload"
      );
      // Réinitialiser la preview en cas d'erreur
      setPreviewUrl(currentLogoUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Supprime le logo (met logoUrl à null)
   */
  const handleRemove = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer le logo ?")) {
      return;
    }

    setIsUploading(true);

    try {
      // Import dynamique pour éviter les erreurs de circular dependency
      const { updateCompanyDetails } = await import(
        "@/app/actions/company"
      );
      await updateCompanyDetails({ logoUrl: null });

      toast.success("Logo supprimé avec succès !");
      setPreviewUrl(null);

      // Rafraîchir la page
      window.location.reload();
    } catch (error) {
      console.error("Erreur suppression logo:", error);
      toast.error("Une erreur est survenue lors de la suppression");
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Génère les initiales du nom de l'entreprise pour l'avatar
   */
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        {/* Avatar/Logo */}
        <Avatar className="h-32 w-32 border-2 border-slate-200">
          {previewUrl ? (
            <AvatarImage src={previewUrl} alt={`Logo ${companyName}`} />
          ) : (
            <AvatarFallback className="bg-slate-100 text-slate-600 text-2xl">
              {getInitials(companyName)}
            </AvatarFallback>
          )}
        </Avatar>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="outline"
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {previewUrl ? "Changer le logo" : "Ajouter un logo"}
                </>
              )}
            </Button>
          </div>

          {previewUrl && (
            <Button
              onClick={handleRemove}
              disabled={isUploading}
              variant="outline"
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
              Supprimer
            </Button>
          )}

          <p className="text-xs text-muted-foreground max-w-xs">
            Formats acceptés : JPEG, PNG, GIF, WebP. Taille maximale : 5MB
          </p>
        </div>
      </div>
    </div>
  );
}

