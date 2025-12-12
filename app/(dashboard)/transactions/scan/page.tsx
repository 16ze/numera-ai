"use client";

/**
 * Page de scan de reçus avec OCR
 *
 * Cette page permet aux utilisateurs de :
 * - Uploader une image de reçu/ticket de caisse
 * - Analyser automatiquement avec GPT-4o Vision
 * - Corriger les données extraites si nécessaire
 * - Enregistrer la transaction dans la base de données
 */

import { analyzeReceipt, saveScannedTransaction } from "@/app/actions/scan-receipt";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TransactionCategory } from "@prisma/client";
import { Loader2, Upload, CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import toast from "react-hot-toast";

/**
 * Type pour les données extraites du reçu
 */
type ReceiptData = {
  amount: number;
  date: string;
  description: string;
  category: TransactionCategory;
};

/**
 * États possibles de la page
 */
type PageState = "upload" | "analyzing" | "form" | "saving";

export default function ScanReceiptPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pageState, setPageState] = useState<PageState>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<ReceiptData>({
    amount: 0,
    date: "",
    description: "",
    category: TransactionCategory.AUTRE,
  });

  /**
   * Gère le drag over (pour le style visuel)
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  /**
   * Gère le drag leave (pour le style visuel)
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Gère le drop de fichier
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  /**
   * Gère la sélection de fichier via l'input
   */
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  /**
   * Valide et traite un fichier sélectionné
   */
  const handleFileSelect = (file: File) => {
    // Validation du type de fichier
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(
        `Type de fichier non supporté. Types autorisés : ${allowedTypes.join(", ")}`
      );
      return;
    }

    // Validation de la taille (max 20 MB pour photos de téléphone)
    const maxSize = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxSize) {
      toast.error("Le fichier est trop volumineux (maximum 20 MB)");
      return;
    }

    setSelectedFile(file);
    analyzeReceiptImage(file);
  };

  /**
   * Analyse le reçu avec l'IA
   */
  const analyzeReceiptImage = async (file: File) => {
    try {
      setPageState("analyzing");

      // Créer FormData avec le fichier
      const formData = new FormData();
      formData.append("image", file);

      // Appeler la Server Action pour analyser le reçu
      const result = await analyzeReceipt(formData);

      // Pré-remplir le formulaire avec les données extraites
      setFormData({
        amount: result.amount,
        date: result.date,
        description: result.description,
        category: result.category,
      });

      setPageState("form");
      toast.success("Reçu analysé avec succès ! Vérifiez et corrigez si nécessaire.");
    } catch (error) {
      console.error("Erreur lors de l'analyse:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'analyse du reçu. Veuillez réessayer."
      );
      setPageState("upload");
      setSelectedFile(null);
    }
  };

  /**
   * Enregistre la transaction
   */
  const handleSaveTransaction = async () => {
    try {
      setPageState("saving");

      // Valider les champs obligatoires
      if (!formData.amount || formData.amount <= 0) {
        toast.error("Le montant doit être supérieur à 0");
        setPageState("form");
        return;
      }

      if (!formData.date) {
        toast.error("La date est obligatoire");
        setPageState("form");
        return;
      }

      if (!formData.description.trim()) {
        toast.error("La description est obligatoire");
        setPageState("form");
        return;
      }

      // Appeler la Server Action pour enregistrer
      await saveScannedTransaction(formData);

      toast.success("Transaction enregistrée avec succès !");
      
      // Rediriger vers le dashboard après un court délai
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'enregistrement de la transaction. Veuillez réessayer."
      );
      setPageState("form");
    }
  };

  /**
   * Réinitialise la page pour scanner un nouveau reçu
   */
  const handleReset = () => {
    setPageState("upload");
    setSelectedFile(null);
    setFormData({
      amount: 0,
      date: "",
      description: "",
      category: TransactionCategory.AUTRE,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Scanner un reçu</h1>
          <p className="mt-2 text-muted-foreground">
            Téléchargez une photo de votre ticket de caisse pour extraire automatiquement les informations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analyse de reçu par IA</CardTitle>
            <CardDescription>
              L'IA va extraire automatiquement le montant, la date, le commerçant et la catégorie.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* État 1 : Zone d'upload */}
            {pageState === "upload" && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <Upload
                  className={`h-12 w-12 mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`}
                />
                <p className="text-lg font-medium mb-2">
                  {isDragging ? "Déposez votre image ici" : "Glissez-déposez votre image"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou cliquez pour sélectionner
                </p>
                <p className="text-xs text-muted-foreground">
                  Formats acceptés : JPEG, PNG, WebP (max 20 MB)
                </p>
              </div>
            )}

            {/* État 2 : Analyse en cours */}
            {pageState === "analyzing" && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
                <p className="text-lg font-medium mb-2">L'IA analyse votre ticket...</p>
                <p className="text-sm text-muted-foreground">
                  Cela peut prendre quelques secondes
                </p>
              </div>
            )}

            {/* État 3 : Formulaire de correction */}
            {pageState === "form" && (
              <div className="space-y-6">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">
                    ✅ Reçu analysé avec succès
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vérifiez les informations ci-dessous et corrigez si nécessaire.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Montant */}
                  <div className="space-y-2">
                    <label htmlFor="amount" className="text-sm font-medium">
                      Montant (€) *
                    </label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <label htmlFor="date" className="text-sm font-medium">
                      Date *
                    </label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description (Commerçant) *
                  </label>
                  <Input
                    id="description"
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Ex: Restaurant Le Bon Coin"
                  />
                </div>

                {/* Catégorie */}
                <div className="space-y-2">
                  <label htmlFor="category" className="text-sm font-medium">
                    Catégorie *
                  </label>
                  <Select
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as TransactionCategory,
                      })
                    }
                  >
                    <option value={TransactionCategory.TRANSPORT}>Transport</option>
                    <option value={TransactionCategory.REPAS}>Repas</option>
                    <option value={TransactionCategory.MATERIEL}>Matériel</option>
                    <option value={TransactionCategory.PRESTATION}>
                      Prestation
                    </option>
                    <option value={TransactionCategory.IMPOTS}>Impôts et taxes</option>
                    <option value={TransactionCategory.SALAIRES}>Salaires</option>
                    <option value={TransactionCategory.AUTRE}>Autre</option>
                  </Select>
                </div>

                {/* Boutons d'action */}
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={handleSaveTransaction}
                    className="flex-1"
                    disabled={pageState === "saving"}
                  >
                    {pageState === "saving" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Valider et Enregistrer
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={pageState === "saving"}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Scanner un autre reçu
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

