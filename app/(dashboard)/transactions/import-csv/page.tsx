"use client";

/**
 * Page d'import de relevés bancaires CSV
 *
 * Cette page permet aux utilisateurs de :
 * - Uploader un fichier CSV de relevé bancaire
 * - Parser et catégoriser automatiquement les transactions avec GPT-4o
 * - Prévisualiser les transactions extraites
 * - Enregistrer les transactions dans la base de données
 */

import {
  parseAndCategorizeCSV,
  saveImportedTransactions,
  type ExtractedTransaction,
} from "@/app/actions/import-csv";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TransactionCategory } from "@prisma/client";
import { FileText, Loader2, Upload, CheckCircle2, X, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import toast from "react-hot-toast";

/**
 * États possibles de la page
 */
type PageState = "upload" | "parsing" | "preview" | "saving";

/**
 * Catégories de transactions pour l'affichage
 */
const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  TRANSPORT: "Transport",
  REPAS: "Repas",
  MATERIEL: "Matériel",
  PRESTATION: "Prestation",
  IMPOTS: "Impôts",
  SALAIRES: "Salaires",
  AUTRE: "Autre",
};

export default function ImportCSVPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pageState, setPageState] = useState<PageState>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedTransactions, setExtractedTransactions] = useState<ExtractedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

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
   * Valide et traite le fichier sélectionné
   */
  const handleFileSelect = (file: File) => {
    // Validation du type
    if (
      file.type !== "text/csv" &&
      file.type !== "application/vnd.ms-excel" &&
      !file.name.toLowerCase().endsWith(".csv")
    ) {
      toast.error("Le fichier doit être au format CSV");
      return;
    }

    // Validation de la taille (max 5 MB pour un CSV)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Le fichier est trop volumineux (maximum 5 MB)");
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  /**
   * Lance le parsing et la catégorisation du CSV
   */
  const handleParseCSV = async () => {
    if (!selectedFile) {
      toast.error("Aucun fichier sélectionné");
      return;
    }

    try {
      setPageState("parsing");
      setError(null);

      // Lire le contenu du fichier CSV avec papaparse
      const fileContent = await selectedFile.text();

      // Appeler la Server Action pour parser et catégoriser
      const transactions = await parseAndCategorizeCSV(fileContent);

      if (transactions.length === 0) {
        toast.error("Aucune transaction trouvée dans le CSV");
        setPageState("upload");
        return;
      }

      setExtractedTransactions(transactions);
      setPageState("preview");
      toast.success(`${transactions.length} transaction(s) extraite(s) avec succès`);
    } catch (error) {
      console.error("Erreur lors du parsing:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors du parsing du CSV. Veuillez réessayer.";
      setError(errorMessage);
      toast.error(errorMessage);
      setPageState("upload");
    }
  };

  /**
   * Enregistre les transactions dans la base de données
   */
  const handleSaveTransactions = async () => {
    if (extractedTransactions.length === 0) {
      toast.error("Aucune transaction à enregistrer");
      return;
    }

    try {
      setPageState("saving");

      // Appeler la Server Action pour enregistrer
      const result = await saveImportedTransactions(extractedTransactions);

      toast.success(`${result.count} transaction(s) enregistrée(s) avec succès !`);

      // Rediriger vers le dashboard après un court délai
      setTimeout(() => {
        router.push("/transactions");
      }, 1000);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de l'enregistrement des transactions. Veuillez réessayer.";
      setError(errorMessage);
      toast.error(errorMessage);
      setPageState("preview");
    }
  };

  /**
   * Réinitialise la page pour importer un nouveau CSV
   */
  const handleReset = () => {
    setPageState("upload");
    setSelectedFile(null);
    setExtractedTransactions([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Formate le montant pour l'affichage
   */
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  /**
   * Formate la date pour l'affichage
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00.000Z");
    return date.toLocaleDateString("fr-FR");
  };

  return (
    <div className="container mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Importer un relevé bancaire CSV
        </h1>
        <p className="text-slate-600">
          Téléchargez votre relevé bancaire au format CSV. Nous utiliserons l'IA pour
          extraire et catégoriser automatiquement toutes les transactions.
        </p>
      </div>

      {/* État : Upload */}
      {pageState === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Télécharger le CSV</CardTitle>
            <CardDescription>
              Sélectionnez ou glissez-déposez votre fichier CSV de relevé bancaire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 hover:border-slate-400",
                selectedFile && "border-green-500 bg-green-50"
              )}
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleParseCSV} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Analyser le CSV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      Changer de fichier
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="h-16 w-16 mx-auto text-slate-400" />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      Glissez-déposez votre CSV ici
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      ou cliquez pour sélectionner un fichier
                    </p>
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Sélectionner un fichier CSV
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* État : Parsing en cours */}
      {pageState === "parsing" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Analyse du CSV en cours...
                </h2>
                <p className="text-slate-600">
                  Nous analysons votre fichier CSV et catégorisons automatiquement les
                  transactions avec l'IA. Cela peut prendre quelques secondes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* État : Prévisualisation */}
      {pageState === "preview" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                Prévisualisation des transactions ({extractedTransactions.length})
              </CardTitle>
              <CardDescription>
                Vérifiez que l'IA a correctement extrait et catégorisé toutes les
                transactions avant de les enregistrer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Message d'erreur si présent */}
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Erreur</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Tableau de prévisualisation */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Catégorie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedTransactions.map((tx, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell
                          className={cn(
                            "font-semibold",
                            tx.amount < 0 ? "text-red-600" : "text-green-600"
                          )}
                        >
                          {formatAmount(tx.amount)}
                        </TableCell>
                        <TableCell>{CATEGORY_LABELS[tx.category]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button onClick={handleSaveTransactions} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  💾 Valider et Importer ({extractedTransactions.length} transaction(s))
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <X className="h-4 w-4 mr-2" />
                  Annuler et recommencer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* État : Enregistrement en cours */}
      {pageState === "saving" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Enregistrement des transactions...
                </h2>
                <p className="text-slate-600">
                  Les transactions sont en cours d'enregistrement dans votre base de
                  données.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

