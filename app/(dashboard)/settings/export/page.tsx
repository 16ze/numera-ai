"use client";

/**
 * Page d'export comptable
 * Permet de télécharger un export CSV des factures et transactions pour l'expert-comptable
 */

import { useState } from "react";
import { generateAccountingExport } from "@/app/actions/export";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, FileText, Calendar, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Page d'export comptable
 */
export default function ExportPage() {
  // Année en cours par défaut
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isLoading, setIsLoading] = useState(false);

  // Génération des années disponibles (10 dernières années + année en cours + 5 années futures)
  const years = Array.from({ length: 16 }, (_, i) => currentYear - 10 + i);

  /**
   * Gère le téléchargement de l'export comptable
   */
  const handleDownload = async () => {
    setIsLoading(true);

    try {
      // Appel de la Server Action pour générer le CSV
      const csvContent = await generateAccountingExport(selectedYear);

      // Création d'un Blob avec le contenu CSV
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

      // Création d'un lien de téléchargement
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `export_compta_${selectedYear}.csv`;
      document.body.appendChild(link);
      link.click();

      // Nettoyage
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        `Export comptable ${selectedYear} téléchargé avec succès !`
      );
    } catch (error) {
      console.error("Erreur lors du téléchargement de l'export:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue lors du téléchargement"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Export Comptable</h1>
        <p className="mt-2 text-muted-foreground">
          Téléchargez votre journal comptable au format CSV pour votre expert-comptable
        </p>
      </div>

      {/* Carte principale */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Journal Comptable</CardTitle>
          </div>
          <CardDescription>
            Génération d'un fichier CSV contenant toutes vos factures et transactions
            de l'année sélectionnée. Format compatible Excel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informations sur l'export */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  Contenu de l'export
                </p>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Factures émises (hors brouillons)</li>
                  <li>Transactions de dépenses</li>
                  <li>Colonnes : Date, Type, Tiers, Description, Montant HT, TVA, Montant TTC</li>
                  <li>Format français (séparateur point-virgule, virgule pour les décimales)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sélecteur d'année */}
          <div className="space-y-2">
            <Label htmlFor="year" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Année à exporter
            </Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
              disabled={isLoading}
            >
              <SelectTrigger id="year" className="w-full">
                <SelectValue placeholder="Sélectionner une année" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                    {year === currentYear && " (année en cours)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sélectionnez l'année pour laquelle vous souhaitez exporter les données comptables
            </p>
          </div>

          {/* Bouton de téléchargement */}
          <Button
            onClick={handleDownload}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Génération en cours...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Télécharger le Journal Comptable
              </>
            )}
          </Button>

          {/* Note informative */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-600">
              <strong>Note :</strong> Le fichier sera nommé{" "}
              <code className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-800">
                export_compta_{selectedYear}.csv
              </code>
              . Vous pouvez l'ouvrir directement dans Excel ou l'envoyer à votre expert-comptable.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

