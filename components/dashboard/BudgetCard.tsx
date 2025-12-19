"use client";

/**
 * Composant BudgetCard - Carte de gestion du budget mensuel
 * Logique visuelle stricte : Vert = OK, Rouge = Danger
 * Barre de progression : Fond vert (argent disponible), Barre rouge (argent dépensé)
 */

import { updateMonthlyBudget } from "@/app/actions/budget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertTriangle, Edit, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

interface BudgetCardProps {
  totalExpenses: number; // Dépenses réelles du mois (spent)
  monthlyBudget: number; // Budget mensuel total (budget)
  budgetAlertThreshold: number; // Seuil d'alerte : reste minimum avant alerte (threshold)
  budgetRemaining: number; // Reste disponible (calculé : budget - spent)
}

export function BudgetCard({
  totalExpenses,
  monthlyBudget,
  budgetAlertThreshold,
  budgetRemaining,
}: BudgetCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBudget, setNewBudget] = useState(monthlyBudget.toString());
  const [newThreshold, setNewThreshold] = useState(
    budgetAlertThreshold.toString()
  );
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // Formatage du montant
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Logique de calcul
  const remaining = budgetRemaining; // budget - spent
  const isCritical = monthlyBudget > 0 && remaining < budgetAlertThreshold;
  const progressPercent =
    monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;

  // Détermination du style de la carte selon l'état
  const getCardStyle = () => {
    if (monthlyBudget === 0) {
      // Budget non défini : Style neutre/gris
      return "bg-slate-50 border-slate-200";
    }
    if (isCritical) {
      // Danger : Fond rouge très clair, bordure rouge, texte rouge foncé
      return "bg-red-50 border-red-200";
    }
    // Tout va bien : Fond vert très clair, bordure verte, texte vert foncé
    return "bg-emerald-50 border-emerald-200";
  };

  // Détermination de la couleur du texte selon l'état
  const getTextColor = () => {
    if (monthlyBudget === 0) {
      return "text-slate-700";
    }
    if (isCritical) {
      return "text-red-900";
    }
    return "text-emerald-900";
  };

  // Gestion de la sauvegarde du budget
  const handleSaveBudget = async () => {
    const amount = parseFloat(newBudget);
    const threshold = parseFloat(newThreshold);

    if (isNaN(amount) || amount < 0) {
      toast.error("Veuillez entrer un budget valide");
      return;
    }

    if (isNaN(threshold) || threshold < 0) {
      toast.error("Veuillez entrer un seuil d'alerte valide");
      return;
    }

    setIsSaving(true);
    try {
      await updateMonthlyBudget(amount, threshold);
      toast.success(
        `Budget mis à jour : ${formatPrice(amount)} (Seuil : ${formatPrice(threshold)})`
      );
      setIsDialogOpen(false);
      router.refresh(); // Rafraîchir les données du dashboard
    } catch (error) {
      console.error("Erreur mise à jour budget:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour du budget"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card
        className={`cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden border-2 ${getCardStyle()}`}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${
                  monthlyBudget === 0
                    ? "bg-slate-100"
                    : isCritical
                      ? "bg-red-100"
                      : "bg-emerald-100"
                }`}
              >
                <Wallet
                  className={`h-5 w-5 ${
                    monthlyBudget === 0
                      ? "text-slate-600"
                      : isCritical
                        ? "text-red-600"
                        : "text-emerald-600"
                  }`}
                />
              </div>
              <CardTitle className={`text-lg font-semibold ${getTextColor()}`}>
                Budget Mensuel
              </CardTitle>
            </div>
            <Edit
              className={`h-4 w-4 ${
                monthlyBudget === 0
                  ? "text-slate-500"
                  : isCritical
                    ? "text-red-600"
                    : "text-emerald-600"
              }`}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Affichage des montants */}
          <div>
            <div className={`text-3xl font-bold ${getTextColor()}`}>
              {formatPrice(totalExpenses)}
            </div>
            <div className={`text-sm mt-1 ${getTextColor()} opacity-80`}>
              sur {formatPrice(monthlyBudget)} prévus
            </div>
          </div>

          {/* Barre de progression */}
          {monthlyBudget > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className={getTextColor()}>
                  {progressPercent.toFixed(1)}% utilisé
                </span>
                {isCritical && (
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      isCritical ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Alerte !
                  </span>
                )}
              </div>
              {/* Barre de progression : Fond vert (argent disponible), Barre rouge (argent dépensé) */}
              <div className="relative h-3 w-full bg-emerald-500 rounded-full overflow-hidden">
                {/* Barre rouge représentant l'argent dépensé */}
                <div
                  className="absolute h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Message de reste */}
          <div className={`text-sm font-medium ${getTextColor()}`}>
            {monthlyBudget === 0 ? (
              <span className="opacity-70">
                Cliquez pour définir votre budget
              </span>
            ) : (
              <>
                <span className="text-red-600 font-semibold">
                  Dépensé : {formatPrice(totalExpenses)}
                </span>
                {" • "}
                <span className="text-emerald-600 font-semibold">
                  Reste : {formatPrice(remaining)}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de modification du budget */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurer votre budget mensuel</DialogTitle>
            <DialogDescription>
              Définissez le montant maximum que vous souhaitez dépenser chaque
              mois et le seuil d'alerte (reste minimum avant alerte rouge).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget mensuel total (€)</Label>
              <Input
                id="budget"
                type="number"
                min="0"
                step="0.01"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder="2000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">
                Seuil d'alerte - Reste minimum (€)
              </Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                step="0.01"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                L'alerte rouge s'affichera lorsque le reste disponible sera
                inférieur à ce montant.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setNewBudget(monthlyBudget.toString());
                setNewThreshold(budgetAlertThreshold.toString());
              }}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button onClick={handleSaveBudget} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
