"use client";

/**
 * Composant AdvisorCard - Carte d'intelligence artificielle pour le dashboard
 * Affiche un conseil financier personnalisé généré par l'IA
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Sparkles } from "lucide-react";
import { getFinancialAdvice } from "@/app/actions/advisor";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carte de conseil du CFO virtuel
 * Analyse les données financières et donne un conseil stratégique
 */
export function AdvisorCard() {
  const [advice, setAdvice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdvice = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await getFinancialAdvice();
        setAdvice(result);
      } catch (err) {
        console.error("Erreur chargement conseil:", err);
        setError("Impossible de charger le conseil pour le moment");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdvice();
  }, []);

  return (
    <Card className="bg-gradient-to-br from-white via-white to-blue-50 border-blue-100 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-yellow-100">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Conseil du CFO
          </CardTitle>
          <Sparkles className="h-4 w-4 text-blue-500 ml-auto" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-sm text-slate-700 leading-relaxed">{advice}</p>
        )}
      </CardContent>
    </Card>
  );
}

