"use client";

/**
 * Composant CashFlowChart - Graphique de prévisions de trésorerie
 * Affiche un AreaChart avec les données réelles (passé) et projetées (futur)
 */

import type { ForecastDataPoint } from "@/app/actions/forecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

/**
 * Props du composant CashFlowChart
 */
interface CashFlowChartProps {
  forecastData: ForecastDataPoint[];
  currentBalance: number;
  burnRate: number;
  hasEnoughData: boolean;
}

/**
 * Formatage monétaire en EUR (format français)
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Composant CashFlowChart
 */
export function CashFlowChart({
  forecastData,
  currentBalance,
  burnRate,
  hasEnoughData,
}: CashFlowChartProps) {
  // Séparation des données réelles et projetées
  const realData = forecastData.filter((d) => d.type === "real");
  const projectedData = forecastData.filter((d) => d.type === "projected");

  // Pour connecter les deux zones, on ajoute le dernier point réel au début des projections
  const connectedProjectedData =
    realData.length > 0
      ? [realData[realData.length - 1], ...projectedData]
      : projectedData;

  // Combinaison pour le graphique complet
  const chartData = [...realData, ...projectedData];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <CardTitle>Prévisions de Trésorerie (6 mois)</CardTitle>
          </div>
          {!hasEnoughData && (
            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
              ⚠️ Données limitées
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            <p>Aucune donnée disponible pour la prévision</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <defs>
                  {/* Dégradé pour la partie réelle (bleu) */}
                  <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                  {/* Dégradé pour la partie projetée (violet) */}
                  <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={{ stroke: "#cbd5e1" }}
                />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => {
                    const type = props.payload?.type;
                    const label = type === "real" ? "Solde réel" : "Solde prévu";
                    return [formatCurrency(value), label];
                  }}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "8px 12px",
                  }}
                  labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                />
                {/* Zone réelle (passé) - trait plein bleu */}
                {realData.length > 0 && (
                  <Area
                    type="monotone"
                    dataKey="solde"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorReal)"
                    fillOpacity={0.6}
                    data={realData}
                    name="Solde réel"
                    connectNulls={true}
                  />
                )}
                {/* Zone projetée (futur) - trait pointillé violet, connectée au dernier point réel */}
                {connectedProjectedData.length > 1 && (
                  <Area
                    type="monotone"
                    dataKey="solde"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="url(#colorProjected)"
                    fillOpacity={0.3}
                    data={connectedProjectedData}
                    name="Solde prévu"
                    connectNulls={true}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
            {/* Légende et informations */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span>Réel (passé)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-500 border-2 border-dashed border-purple-600"></div>
                <span>Projeté (futur)</span>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <span>
                  Solde actuel: <strong className="text-slate-900">{formatCurrency(currentBalance)}</strong>
                </span>
                <span>
                  Dépenses moyennes: <strong className="text-slate-900">{formatCurrency(burnRate)}/mois</strong>
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
