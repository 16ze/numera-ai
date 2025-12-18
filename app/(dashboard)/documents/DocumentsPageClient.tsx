"use client";

/**
 * Composant Client pour la page Documents
 * Gère l'upload, l'affichage et la suppression des documents
 */

import { uploadAndAnalyzeDocument, deleteDocument } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Image as ImageIcon,
  Upload,
  Trash2,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";

interface Document {
  id: string;
  name: string;
  url: string;
  type: string;
  summary: string | null;
  createdAt: Date;
  client: {
    id: string;
    name: string;
  } | null;
}

interface Client {
  id: string;
  name: string;
}

interface DocumentsPageClientProps {
  initialDocuments: Document[];
  clients: Client[];
}

export function DocumentsPageClient({
  initialDocuments,
  clients,
}: DocumentsPageClientProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Gère l'upload d'un fichier
   */
  const handleUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      // Vérification du type
      const isPDF = file.type === "application/pdf";
      const isImage =
        file.type.startsWith("image/") &&
        ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
          file.type
        );

      if (!isPDF && !isImage) {
        toast.error(
          "Type de fichier non supporté. Formats acceptés : PDF, JPEG, PNG, WebP"
        );
        return;
      }

      // Vérification de la taille (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Le fichier est trop volumineux (max 10MB)");
        return;
      }

      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadAndAnalyzeDocument(
          formData,
          selectedClientId || undefined
        );

        if (result.success) {
          toast.success("✅ Document uploadé et analysé avec succès");

          // Recharger les documents
          const { getDocuments } = await import("@/app/actions/documents");
          const updatedDocuments = await getDocuments();
          setDocuments(updatedDocuments);
          setSelectedClientId("");
        }
      } catch (error) {
        console.error("Erreur upload:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Erreur lors de l'upload du document"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [selectedClientId]
  );

  /**
   * Gère le drag & drop
   */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleUpload(e.dataTransfer.files[0]);
      }
    },
    [handleUpload]
  );

  /**
   * Gère la sélection de fichier via input
   */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleUpload(e.target.files[0]);
        // Reset input pour permettre de sélectionner le même fichier
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [handleUpload]
  );

  /**
   * Supprime un document
   */
  const handleDelete = useCallback(async (documentId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) {
      return;
    }

    try {
      const result = await deleteDocument(documentId);
      if (result.success) {
        toast.success("Document supprimé");
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      }
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression"
      );
    }
  }, []);

  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Stockez et analysez vos documents (PDF/Images) avec extraction de
          texte par IA
        </p>
      </div>

      {/* Zone d'upload avec drag & drop */}
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ajouter un document
          </CardTitle>
          <CardDescription>
            Glissez-déposez un fichier ou cliquez pour sélectionner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Select pour lier à un client */}
          <div className="space-y-2">
            <Label htmlFor="client-select">
              Lier à un client (optionnel)
            </Label>
            <Select
              id="client-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              disabled={isUploading}
            >
              <option value="">Aucun client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Zone de drag & drop */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center transition-colors
              ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400"
              }
              ${isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm text-slate-600">
                  Upload et analyse en cours...
                </p>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Glissez-déposez un fichier ici
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  ou cliquez pour sélectionner
                </p>
                <p className="text-xs text-slate-400">
                  PDF, JPEG, PNG, WebP (max 10MB)
                </p>
              </>
            )}
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Grille de documents */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-2">
              Aucun document
            </p>
            <p className="text-xs text-slate-500">
              Commencez par uploader un document ci-dessus
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {doc.type === "PDF" ? (
                      <FileText className="h-5 w-5 text-red-600 flex-shrink-0" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    )}
                    <CardTitle className="text-base truncate">
                      {doc.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{doc.type}</Badge>
                  {doc.client && (
                    <Badge variant="secondary">{doc.client.name}</Badge>
                  )}
                </div>

                {/* Date */}
                <p className="text-xs text-slate-500">
                  {new Date(doc.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>

                {/* Résumé */}
                {doc.summary && (
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {doc.summary}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(doc.url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
