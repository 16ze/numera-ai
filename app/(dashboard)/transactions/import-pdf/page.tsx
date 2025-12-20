"use client";

/**
 * Page d'import de relevés bancaires PDF
 *
 * Cette page permet aux utilisateurs de :
 * - Uploader un fichier PDF de relevé bancaire
 * - Extraire automatiquement les transactions avec GPT-4o
 * - Prévisualiser les transactions extraites
 * - Enregistrer les transactions dans la base de données
 */

import {
  extractDataFromPDF,
  saveImportedTransactions,
  type ExtractedData,
} from "@/app/actions/import-pdf";
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
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import toast from "react-hot-toast";

/**
 * États possibles de la page
 */
type PageState = "upload" | "extracting" | "preview" | "saving";

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

export default function ImportPDFPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pageState, setPageState] = useState<PageState>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Helper pour formater le montant avec devise
  const formatMoney = (amount: number | null, currency: string = "EUR") => {
    if (amount === null) return "N/A";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

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
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("Le fichier doit être au format PDF");
      return;
    }

    // Validation de la taille (max 10 MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Le fichier est trop volumineux (maximum 10 MB)");
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  /**
   * Lance l'extraction des données du PDF
   */
  const handleExtractData = async () => {
    if (!selectedFile) {
      toast.error("Aucun fichier sélectionné");
      return;
    }

    try {
      setPageState("extracting");
      setError(null);

      // Créer FormData avec le fichier PDF
      const formData = new FormData();
      formData.append("pdf", selectedFile);

      // Appeler la Server Action pour extraire les données
      const data = await extractDataFromPDF(formData);

      console.log("📊 Données reçues du backend:", data);
      console.log("📊 Type de données:", typeof data);
      console.log("📊 Est un tableau?", Array.isArray(data));
      console.log("📊 Transactions:", data.transactions);
      console.log("📊 Accounts:", data.accounts);

      // Vérifier que data est bien un objet avec transactions
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        console.error("❌ Format de données invalide:", data);
        toast.error("Format de données invalide reçu du serveur");
        setPageState("upload");
        return;
      }

      // Vérifier que transactions existe et est un tableau
      if (!data.transactions || !Array.isArray(data.transactions)) {
        console.error("❌ Transactions manquantes ou invalides:", data);
        toast.error("Aucune transaction trouvée dans le PDF");
        setPageState("upload");
        return;
      }

      if (data.transactions.length === 0) {
        toast.error("Aucune transaction trouvée dans le PDF");
        setPageState("upload");
        return;
      }

      setExtractedData(data);
      setPageState("preview");

      let successMessage = `${data.transactions.length} transaction(s) extraite(s)`;
      if (
        data.accounts &&
        Array.isArray(data.accounts) &&
        data.accounts.length > 0
      ) {
        successMessage += `, ${data.accounts.length} compte(s) détecté(s)`;
      }
      toast.success(successMessage);
    } catch (error) {
      console.error("Erreur lors de l'extraction:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de l'extraction des données du PDF. Veuillez réessayer.";
      setError(errorMessage);
      toast.error(errorMessage);
      setPageState("upload");
    }
  };

  /**
   * Enregistre les transactions et crée/met à jour les comptes détectés
   */
  const handleSaveTransactions = async () => {
    if (!extractedData || extractedData.transactions.length === 0) {
      toast.error("Aucune transaction à enregistrer");
      return;
    }

    try {
      setPageState("saving");

      // Appeler la Server Action pour enregistrer (avec les comptes détectés)
      const result = await saveImportedTransactions(
        extractedData.transactions,
        extractedData.accounts
      );

      let message = `${result.count} transaction(s) enregistrée(s) avec succès !`;
      if (result.accountsCreated > 0) {
        message += ` ${result.accountsCreated} compte(s) créé(s).`;
      }
      if (result.accountsUpdated > 0) {
        message += ` ${result.accountsUpdated} compte(s) mis à jour.`;
      }
      toast.success(message);

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
   * Réinitialise la page pour importer un nouveau PDF
   */
  const handleReset = () => {
    setPageState("upload");
    setSelectedFile(null);
    setExtractedData(null);
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
          Importer un relevé bancaire PDF
        </h1>
        <p className="text-slate-600">
          Déposez votre relevé bancaire. L'IA détectera automatiquement vos
          comptes et extraira toutes les transactions.
        </p>
      </div>

      {/* État : Upload */}
      {pageState === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Déposez votre relevé bancaire
            </CardTitle>
            <CardDescription>
              L'application détectera automatiquement vos comptes et leurs
              soldes
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
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleExtractData} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Lire le relevé bancaire
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
                      Glissez-déposez votre PDF ici
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
                    Sélectionner un fichier PDF
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* État : Extraction en cours */}
      {pageState === "extracting" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  L'IA analyse vos comptes et transactions...
                </h2>
                <p className="text-slate-600">
                  Nous détectons automatiquement vos comptes bancaires et
                  extrayons toutes les transactions. Cela peut prendre quelques
                  secondes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* État : Prévisualisation */}
      {pageState === "preview" && extractedData && (
        <div className="space-y-6">
          {/* Message d'erreur si présent */}
          {error && (
            <Card>
              <CardContent className="pt-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Erreur</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Carte : Comptes détectés */}
          {extractedData.accounts &&
            Array.isArray(extractedData.accounts) &&
            extractedData.accounts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-blue-500" />
                    Comptes détectés ({extractedData.accounts.length})
                  </CardTitle>
                  <CardDescription>
                    L'application va créer ou mettre à jour ces comptes
                    automatiquement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {extractedData.accounts.map((account, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                            <Landmark className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {account.name}
                            </p>
                            <p className="text-sm text-slate-600">
                              {account.currency || "EUR"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-green-600">
                            {formatMoney(
                              account.balance,
                              account.currency || "EUR"
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            Solde détecté
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>✨ Magie automatique :</strong> Ces comptes seront
                      créés s'ils n'existent pas, ou mis à jour s'ils existent
                      déjà.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Carte : Transactions extraites */}
          <Card>
            <CardHeader>
              <CardTitle>
                Transactions extraites ({extractedData.transactions.length})
              </CardTitle>
              <CardDescription>
                Vérifiez que l'IA a correctement extrait toutes les transactions
                avant de les enregistrer.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    {extractedData.transactions.map((tx, index) => (
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
                  Confirmer l'import ({extractedData.transactions.length}{" "}
                  transaction(s))
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
                  Les transactions sont en cours d'enregistrement dans votre
                  base de données.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
