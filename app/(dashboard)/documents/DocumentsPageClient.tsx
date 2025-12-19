"use client";

/**
 * Composant Client pour la page Documents - Explorateur de fichiers
 * Design inspiré de Google Drive / macOS Finder
 */

import {
  deleteDocument,
  uploadAndAnalyzeDocument,
} from "@/app/actions/documents";
import {
  createFolder,
  deleteFolder,
  getFileSystem,
  moveItem,
  renameFolder,
} from "@/app/actions/folders";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ExternalLink,
  FileText,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Trash2,
  Upload,
  ChevronRight,
  Home,
  Move,
  Edit,
} from "lucide-react";
import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

interface Folder {
  id: string;
  name: string;
  createdAt: Date;
  parent?: Folder | null;
}

interface FileSystem {
  folders: Folder[];
  documents: Document[];
  currentFolder: Folder | null;
}

interface Client {
  id: string;
  name: string;
}

interface DocumentsPageClientProps {
  initialFileSystem: FileSystem;
  clients: Client[];
  currentFolderId: string | null;
}

export function DocumentsPageClient({
  initialFileSystem,
  clients,
  currentFolderId,
}: DocumentsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fileSystem, setFileSystem] = useState<FileSystem>(initialFileSystem);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<{
    id: string;
    name: string;
    type: "folder" | "doc";
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recharger le système de fichiers quand le folderId change
  useEffect(() => {
    const folderId = searchParams.get("folderId") || null;
    loadFileSystem(folderId);
  }, [searchParams]);

  const loadFileSystem = async (folderId: string | null) => {
    try {
      const data = await getFileSystem(folderId);
      setFileSystem(data);
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement");
    }
  };

  /**
   * Gère l'upload d'un fichier
   */
  const handleUpload = useCallback(
    async (file: File) => {
      if (!file) return;

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
          selectedClientId || undefined,
          currentFolderId
        );

        if (result.success) {
          toast.success("✅ Document uploadé et analysé avec succès");
          await loadFileSystem(currentFolderId);
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
    [selectedClientId, currentFolderId]
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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleUpload(e.target.files[0]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [handleUpload]
  );

  /**
   * Crée un nouveau dossier
   */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Le nom du dossier ne peut pas être vide");
      return;
    }

    setIsCreatingFolder(true);
    try {
      const result = await createFolder(newFolderName, currentFolderId);
      if (result.success) {
        toast.success("✅ Dossier créé");
        setNewFolderDialogOpen(false);
        setNewFolderName("");
        await loadFileSystem(currentFolderId);
      }
    } catch (error) {
      console.error("Erreur création dossier:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la création"
      );
    } finally {
      setIsCreatingFolder(false);
    }
  };

  /**
   * Supprime un document
   */
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) {
      return;
    }

    try {
      const result = await deleteDocument(documentId);
      if (result.success) {
        toast.success("Document supprimé");
        await loadFileSystem(currentFolderId);
      }
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      );
    }
  };

  /**
   * Supprime un dossier
   */
  const handleDeleteFolder = async (folderId: string) => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir supprimer ce dossier et tout son contenu ?"
      )
    ) {
      return;
    }

    try {
      const result = await deleteFolder(folderId);
      if (result.success) {
        toast.success("Dossier supprimé");
        await loadFileSystem(currentFolderId);
      }
    } catch (error) {
      console.error("Erreur suppression dossier:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      );
    }
  };

  /**
   * Navigue vers un dossier (double-clic)
   */
  const handleFolderDoubleClick = (folderId: string) => {
    router.push(`/documents?folderId=${folderId}`);
  };

  /**
   * Construit le fil d'Ariane
   */
  const buildBreadcrumb = () => {
    const breadcrumb: Array<{ id: string | null; name: string }> = [
      { id: null, name: "Documents" },
    ];

    if (fileSystem.currentFolder) {
      let current: Folder | null = fileSystem.currentFolder;
      const path: Folder[] = [];

      while (current) {
        path.unshift(current);
        current = current.parent || null;
      }

      breadcrumb.push(...path.map((f) => ({ id: f.id, name: f.name })));
    }

    return breadcrumb;
  };

  /**
   * Renomme un élément
   */
  const handleRename = async () => {
    if (!renameItem || !renameValue.trim()) {
      return;
    }

    try {
      if (renameItem.type === "folder") {
        await renameFolder(renameItem.id, renameValue);
        toast.success("Dossier renommé");
      } else {
        // Pour les documents, on pourrait ajouter une fonction renameDocument
        toast.error("Le renommage de documents n'est pas encore implémenté");
        return;
      }
      setRenameDialogOpen(false);
      setRenameItem(null);
      setRenameValue("");
      await loadFileSystem(currentFolderId);
    } catch (error) {
      console.error("Erreur renommage:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors du renommage"
      );
    }
  };

  const breadcrumb = buildBreadcrumb();

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Gérez vos documents et organisez-les dans des dossiers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setNewFolderDialogOpen(true)}
            variant="outline"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Nouveau Dossier
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Uploader ici
          </Button>
        </div>
      </div>

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm">
        {breadcrumb.map((item, index) => (
          <div key={item.id || "root"} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
            <button
              onClick={() => {
                if (item.id) {
                  router.push(`/documents?folderId=${item.id}`);
                } else {
                  router.push("/documents");
                }
              }}
              className={`hover:text-blue-600 transition-colors ${
                index === breadcrumb.length - 1
                  ? "font-semibold text-slate-900"
                  : "text-slate-600"
              }`}
            >
              {item.id === null ? (
                <Home className="h-4 w-4 inline mr-1" />
              ) : null}
              {item.name}
            </button>
          </div>
        ))}
      </div>

      {/* Zone d'upload (cachée par défaut, visible au survol ou via bouton) */}
      <Input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* Grille de fichiers et dossiers */}
      {fileSystem.folders.length === 0 &&
      fileSystem.documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Folder className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-2">
              Dossier vide
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Ajoutez des fichiers ou créez un dossier
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setNewFolderDialogOpen(true)}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Nouveau Dossier
              </Button>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Uploader
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Dossiers */}
          {fileSystem.folders.map((folder) => (
            <Card
              key={folder.id}
              className="hover:shadow-md transition-all cursor-pointer group"
              onDoubleClick={() => handleFolderDoubleClick(folder.id)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="relative w-full">
                  <Folder className="h-16 w-16 mx-auto text-yellow-500 mb-2" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameItem({
                            id: folder.id,
                            name: folder.name,
                            type: "folder",
                          });
                          setRenameValue(folder.name);
                          setRenameDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Renommer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteFolder(folder.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-sm font-medium truncate w-full">
                  {folder.name}
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Documents */}
          {fileSystem.documents.map((doc) => (
            <Card
              key={doc.id}
              className="hover:shadow-md transition-all group"
            >
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="relative w-full">
                  {doc.type === "PDF" ? (
                    <FileText className="h-16 w-16 mx-auto text-red-600 mb-2" />
                  ) : (
                    <ImageIcon className="h-16 w-16 mx-auto text-blue-600 mb-2" />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => window.open(doc.url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ouvrir
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-sm font-medium truncate w-full mb-1">
                  {doc.name}
                </p>
                {doc.client && (
                  <Badge variant="secondary" className="text-xs">
                    {doc.client.name}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Nouveau Dossier */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Dossier</DialogTitle>
            <DialogDescription>
              Créez un nouveau dossier pour organiser vos documents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Nom du dossier</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: Clients"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewFolderDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateFolder} disabled={isCreatingFolder}>
              {isCreatingFolder ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Renommer */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
            <DialogDescription>
              Modifiez le nom de {renameItem?.type === "folder" ? "ce dossier" : "ce document"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-value">Nouveau nom</Label>
              <Input
                id="rename-value"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
