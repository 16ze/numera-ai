"use client";

/**
 * Composant Client pour la configuration du taux de taxes
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTaxRate } from "@/app/actions/company";
import toast from "react-hot-toast";

interface TaxRateClientProps {
  initialTaxRate: number;
}

export function TaxRateClient({ initialTaxRate }: TaxRateClientProps) {
  const [taxRate, setTaxRate] = useState<number>(initialTaxRate);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // Validation côté client
    if (taxRate < 0 || taxRate > 50) {
      toast.error("Le taux de taxes doit être entre 0% et 50%");
      return;
    }

    try {
      setIsSaving(true);
      const result = await updateTaxRate(taxRate);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error("Erreur lors de la mise à jour du taux de taxes");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour du taux de taxes"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setTaxRate(value);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input pour le taux */}
      <div className="space-y-2">
        <Label htmlFor="taxRate">Taux de taxes (%)</Label>
        <div className="flex items-center gap-4">
          <Input
            id="taxRate"
            type="number"
            min="0"
            max="50"
            step="0.1"
            value={taxRate}
            onChange={handleInputChange}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">
            = {taxRate.toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Valeur entre 0% et 50%
        </p>
      </div>

      {/* Slider visuel simple */}
      <div className="space-y-2">
        <Label>Barre de progression</Label>
        <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-blue-600 transition-all duration-200"
            style={{ width: `${(taxRate / 50) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
        </div>
      </div>

      {/* Bouton de sauvegarde */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Enregistrement..." : "Enregistrer le taux"}
        </Button>
      </div>
    </div>
  );
}
