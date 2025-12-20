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

import { createManualAccount, getBankAccounts } from "@/app/actions/bank";
import {
  parseAndCategorizeCSV,
  saveImportedTransactions,
  type ExtractedData,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  Plus,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
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

type BankAccount = {
  id: string;
  bankName: string;
  mask: string | null;
  type: string;
};

export default function ImportCSVPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pageState, setPageState] = useState<PageState>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showCreateAccountDialog, setShowCreateAccountDialog] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState<number | null>(null);
  const [manualBalance, setManualBalance] = useState<string>("");

  // Charger les comptes bancaires au montage
  useEffect(() => {
    const loadBankAccounts = async () => {
      try {
        const accounts = await getBankAccounts();
        setBankAccounts(accounts as BankAccount[]);
      } catch (error) {
        console.error("Erreur chargement comptes:", error);
      }
    };
    loadBankAccounts();
  }, []);

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
      const data = await parseAndCategorizeCSV(fileContent);

      if (data.transactions.length === 0) {
        toast.error("Aucune transaction trouvée dans le CSV");
        setPageState("upload");
        return;
      }

      setExtractedData(data);
      setClosingBalance(data.closingBalance);
      setPageState("preview");
      toast.success(
        `${data.transactions.length} transaction(s) extraite(s) avec succès`
      );
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
   * Crée un nouveau compte bancaire manuel
   */
  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      toast.error("Le nom du compte est requis");
      return;
    }

    const balance = parseFloat(newAccountBalance) || 0;

    try {
      const result = await createManualAccount(newAccountName.trim(), balance);
      toast.success("Compte créé avec succès");

      // Recharger la liste des comptes
      const accounts = await getBankAccounts();
      setBankAccounts(accounts as BankAccount[]);

      // Sélectionner le nouveau compte
      setSelectedAccountId(result.bankAccountId);

      // Fermer le dialog
      setShowCreateAccountDialog(false);
      setNewAccountName("");
      setNewAccountBalance("");
    } catch (error) {
      console.error("Erreur création compte:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la création du compte"
      );
    }
  };

  /**
   * Enregistre les transactions dans la base de données
   */
  const handleSaveTransactions = async () => {
    if (!extractedData || extractedData.transactions.length === 0) {
      toast.error("Aucune transaction à enregistrer");
      return;
    }

    if (!selectedAccountId) {
      toast.error("Veuillez sélectionner un compte bancaire");
      return;
    }

    try {
      setPageState("saving");

      // Déterminer le solde à utiliser (priorité : manuel > détecté > null)
      const finalBalance =
        manualBalance.trim() !== ""
          ? parseFloat(manualBalance)
          : closingBalance;

      // Appeler la Server Action pour enregistrer
      const result = await saveImportedTransactions(
        extractedData.transactions,
        selectedAccountId,
        finalBalance
      );

      let message = `${result.count} transaction(s) enregistrée(s) avec succès !`;
      if (result.balanceUpdated) {
        message += ` Solde du compte mis à jour.`;
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
   * Réinitialise la page pour importer un nouveau CSV
   */
  const handleReset = () => {
    setPageState("upload");
    setSelectedFile(null);
    setExtractedData(null);
    setClosingBalance(null);
    setManualBalance("");
    setSelectedAccountId("");
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
          Téléchargez votre relevé bancaire au format CSV. Nous utiliserons l'IA
          pour extraire et catégoriser automatiquement toutes les transactions.
        </p>
      </div>

      {/* État : Upload */}
      {pageState === "upload" && (
        <div className="space-y-6">
          {/* Sélecteur de compte */}
          <Card>
            <CardHeader>
              <CardTitle>Compte bancaire</CardTitle>
              <CardDescription>
                Sélectionnez le compte bancaire pour cet import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="account-select">Compte</Label>
                  <Select
                    id="account-select"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    <option value="">-- Sélectionner un compte --</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bankName}
                        {account.mask ? ` ••••${account.mask}` : ""}
                        {account.type === "MANUAL" ? " (Manuel)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateAccountDialog(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Créer un compte
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Télécharger le CSV</CardTitle>
              <CardDescription>
                Sélectionnez ou glissez-déposez votre fichier CSV de relevé
                bancaire
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
        </div>
      )}

      {/* Dialog de création de compte */}
      <Dialog
        open={showCreateAccountDialog}
        onOpenChange={setShowCreateAccountDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau compte bancaire</DialogTitle>
            <DialogDescription>
              Créez un compte manuel pour vos imports de relevés
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="account-name">Nom du compte</Label>
              <Input
                id="account-name"
                placeholder="Ex: Caisse Épargne, Compte Courant..."
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="account-balance">Solde initial (€)</Label>
              <Input
                id="account-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateAccountDialog(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateAccount}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  Nous analysons votre fichier CSV et catégorisons
                  automatiquement les transactions avec l'IA. Cela peut prendre
                  quelques secondes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* État : Prévisualisation */}
      {pageState === "preview" && extractedData && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                Prévisualisation des transactions (
                {extractedData.transactions.length})
              </CardTitle>
              <CardDescription>
                Vérifiez que l'IA a correctement extrait et catégorisé toutes
                les transactions avant de les enregistrer.
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

              {/* Sélecteur de compte (si pas encore sélectionné) */}
              {!selectedAccountId && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-semibold text-yellow-900 mb-2">
                    ⚠️ Sélectionnez un compte bancaire
                  </p>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                      >
                        <option value="">-- Sélectionner un compte --</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.bankName}
                            {account.mask ? ` ••••${account.mask}` : ""}
                            {account.type === "MANUAL" ? " (Manuel)" : ""}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateAccountDialog(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Créer un compte
                    </Button>
                  </div>
                </div>
              )}

              {/* Gestion du solde final */}
              {selectedAccountId && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    Mise à jour du solde du compte
                  </p>
                  {closingBalance !== null ? (
                    <div className="space-y-3">
                      <p className="text-sm text-blue-700">
                        Solde final détecté dans le document :{" "}
                        <span className="font-bold">
                          {formatAmount(closingBalance)}
                        </span>
                      </p>
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <Label htmlFor="balance-confirm">
                            Confirmer ou modifier le solde (€)
                          </Label>
                          <Input
                            id="balance-confirm"
                            type="number"
                            step="0.01"
                            placeholder={closingBalance.toString()}
                            value={manualBalance}
                            onChange={(e) => setManualBalance(e.target.value)}
                          />
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setManualBalance("");
                            setClosingBalance(null);
                          }}
                        >
                          Ignorer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="balance-manual">
                        Mettre à jour le solde actuel du compte (optionnel)
                      </Label>
                      <Input
                        id="balance-manual"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={manualBalance}
                        onChange={(e) => setManualBalance(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  )}
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
                <Button
                  onClick={handleSaveTransactions}
                  className="gap-2"
                  disabled={!selectedAccountId}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  💾 Valider et Importer ({
                    extractedData.transactions.length
                  }{" "}
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
