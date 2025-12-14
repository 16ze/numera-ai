"use client";

/**
 * Composant TaxRadarCard - Carte "Trésorerie Réelle (Estimée)"
 * Affiche l'argent disponible après provisions pour les taxes
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

interface TaxRadarCardProps {
  netAvailable: number;
  taxAmount: number;
  taxRate: number;
}

/**
 * Formate un montant en euros
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function TaxRadarCard({
  netAvailable,
  taxAmount,
  taxRate,
}: TaxRadarCardProps) {
  // Calcul du pourcentage pour la barre de progression
  const total = netAvailable + taxAmount;
  const netPercentage = total > 0 ? (netAvailable / total) * 100 : 0;
  const taxPercentage = total > 0 ? (taxAmount / total) * 100 : 0;

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Trésorerie Réelle (Estimée)
          </CardTitle>
          <Wallet className="h-5 w-5 text-green-600" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Montant Net en TRÈS GROS et en Vert */}
        <div>
          <div className="text-4xl font-bold text-green-600 mb-1">
            {formatCurrency(netAvailable)}
          </div>
          <p className="text-xs text-muted-foreground">
            Disponible après provisions
          </p>
        </div>

        {/* Provisions taxes en plus petit et gris/rouge */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Dont provisions taxes :
            </span>
            <span className="font-semibold text-red-600">
              {formatCurrency(taxAmount)} ({taxRate.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="space-y-2 pt-2">
          <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
            {/* Partie Verte (Net) */}
            <div
              className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
              style={{ width: `${netPercentage}%` }}
            />
            {/* Partie Rouge/Orange (Taxes) */}
            <div
              className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-300"
              style={{ width: `${taxPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Net disponible</span>
            <span>Provisions taxes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
