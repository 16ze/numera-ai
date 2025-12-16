"use client";

/**
 * Composant AIAdvisor - Conseiller Business IA
 * Analyse la rentabilité et donne des conseils stratégiques personnalisés
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { getProfitabilityAdvice, type SimulationData } from "@/app/actions/advisor";
import toast from "react-hot-toast";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";

interface AIAdvisorProps {
  calculation: {
    totalCost: number;
    sellingPrice?: number;
    netMargin?: number;
    marginPercent?: number;
    suppliesCost: number;
    equipmentCost: number;
    laborCost: number;
    overheadCost: number;
  } | null;
}

export function AIAdvisor({ calculation }: AIAdvisorProps) {
  const [advice, setAdvice] = useState<{
    score: number;
    analysis: string;
    actions: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!calculation) {
      toast.error("Veuillez d'abord calculer la rentabilité de votre prestation");
      return;
    }

    if (!calculation.sellingPrice || calculation.sellingPrice <= 0) {
      toast.error("Veuillez configurer un prix de vente pour obtenir une analyse");
      return;
    }

    setIsLoading(true);
    try {
      const data: SimulationData = {
        sellingPrice: calculation.sellingPrice,
        totalCost: calculation.totalCost,
        breakdown: {
          suppliesCost: calculation.suppliesCost,
          equipmentCost: calculation.equipmentCost,
          laborCost: calculation.laborCost,
          overheadCost: calculation.overheadCost,
        },
        currentMargin: calculation.netMargin,
        marginPercent: calculation.marginPercent,
      };

      const result = await getProfitabilityAdvice(data);
      setAdvice(result);
      toast.success("✅ Analyse générée avec succès");
    } catch (error) {
      console.error("Erreur lors de l'analyse:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la génération de l'analyse"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Déterminer la couleur selon le score
  const getScoreColor = (score: number): string => {
    if (score >= 8) return "#10b981"; // Vert
    if (score >= 5) return "#f59e0b"; // Orange
    return "#ef4444"; // Rouge
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 8) return "Excellente";
    if (score >= 5) return "Moyenne";
    return "Faible";
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Conseiller Business IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!advice ? (
          <>
            <p className="text-sm text-slate-600">
              Obtenez une analyse stratégique de votre rentabilité avec des
              conseils actionnables personnalisés.
            </p>
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !calculation || !calculation.sellingPrice}
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyser mon business avec l'IA
                </>
              )}
            </Button>
            {calculation && !calculation.sellingPrice && (
              <p className="text-xs text-orange-600 text-center">
                ⚠️ Configurez un prix de vente pour obtenir une analyse
              </p>
            )}
          </>
        ) : (
          <>
            {/* Jauge circulaire avec le score */}
            <div className="flex items-center justify-center py-4">
              <div className="w-32 h-32">
                <CircularProgressbar
                  value={advice.score * 10}
                  text={`${advice.score}/10`}
                  styles={buildStyles({
                    pathColor: getScoreColor(advice.score),
                    textColor: getScoreColor(advice.score),
                    trailColor: "#e5e7eb",
                    textSize: "20px",
                    fontWeight: "bold",
                  })}
                />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                Rentabilité: {getScoreLabel(advice.score)}
              </p>
            </div>

            {/* Analyse */}
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 mb-2">
                📊 Analyse
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                {advice.analysis}
              </p>
            </div>

            {/* Plan d'action */}
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">
                🎯 Plan d'action
              </h4>
              <ul className="space-y-2">
                {advice.actions.map((action, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="flex-1">{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bouton pour réanalyser */}
            <Button
              onClick={handleAnalyze}
              disabled={isLoading}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Réanalyser
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
