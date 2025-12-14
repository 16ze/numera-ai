"use client";

/**
 * Composant InteractiveCards - Cartes interactives avec Dialog et graphiques
 * Affiche 4 cartes cliquables qui ouvrent un Dialog avec un graphique détaillé
 */

import type { HistoryDataPoint } from "@/app/(dashboard)/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Euro, TrendingDown, Wallet } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Props du composant InteractiveCards
 */
interface InteractiveCardsProps {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  annualRevenue: number;
  historyData: HistoryDataPoint[];
}

/**
 * Type pour les métriques disponibles
 */
type MetricType = "revenue" | "expenses" | "net" | "annual";

/**
 * Formatage monétaire en EUR (format français)
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Composant InteractiveCards
 */
export function InteractiveCards({
  totalRevenue,
  totalExpenses,
  netIncome,
  annualRevenue,
  historyData,
}: InteractiveCardsProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  /**
   * Ouvre le Dialog avec la métrique sélectionnée
   */
  const handleCardClick = (metric: MetricType) => {
    setSelectedMetric(metric);
    setIsDialogOpen(true);
  };

  /**
   * Prépare les données du graphique selon la métrique sélectionnée
   */
  const getChartData = () => {
    if (!selectedMetric) return [];

    return historyData.map((item) => {
      switch (selectedMetric) {
        case "revenue":
          return { name: item.name, value: item.income };
        case "expenses":
          return { name: item.name, value: item.expense };
        case "net":
          return { name: item.name, value: item.net };
        case "annual":
          // Pour le CA annuel, on affiche le cumul progressif
          return { name: item.name, value: item.income };
        default:
          return { name: item.name, value: 0 };
      }
    });
  };

  /**
   * Retourne le titre du Dialog selon la métrique
   */
  const getDialogTitle = (): string => {
    switch (selectedMetric) {
      case "revenue":
        return "Détail du Chiffre d'Affaires Mensuel";
      case "expenses":
        return "Détail des Dépenses Mensuelles";
      case "net":
        return "Détail du Résultat Net Mensuel";
      case "annual":
        return "Détail du Chiffre d'Affaires Annuel";
      default:
        return "Détails";
    }
  };

  /**
   * Retourne la couleur de la barre selon la métrique
   */
  const getBarColor = (): string => {
    switch (selectedMetric) {
      case "revenue":
        return "#22c55e"; // green-500
      case "expenses":
        return "#ef4444"; // red-500
      case "net":
        return netIncome >= 0 ? "#22c55e" : "#ef4444";
      case "annual":
        return "#3b82f6"; // blue-500
      default:
        return "#6b7280";
    }
  };

  /**
   * Retourne le nom de la série pour le graphique
   */
  const getSeriesName = (): string => {
    switch (selectedMetric) {
      case "revenue":
        return "Chiffre d'Affaires";
      case "expenses":
        return "Dépenses";
      case "net":
        return "Résultat Net";
      case "annual":
        return "CA Mensuel";
      default:
        return "Valeur";
    }
  };

  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Carte CA Mensuel */}
        <Card
          className="cursor-pointer hover:scale-105 transition-all duration-200 hover:shadow-lg"
          onClick={() => handleCardClick("revenue")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Chiffre d'Affaires
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">Ce mois-ci</p>
          </CardContent>
        </Card>

        {/* Carte Dépenses */}
        <Card
          className="cursor-pointer hover:scale-105 transition-all duration-200 hover:shadow-lg"
          onClick={() => handleCardClick("expenses")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">Ce mois-ci</p>
          </CardContent>
        </Card>

        {/* Carte Résultat Net */}
        <Card
          className="cursor-pointer hover:scale-105 transition-all duration-200 hover:shadow-lg"
          onClick={() => handleCardClick("net")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Résultat Net</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                netIncome >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(netIncome)}
            </div>
            <p className="text-xs text-muted-foreground">Bénéfice estimé</p>
          </CardContent>
        </Card>

        {/* Carte CA Annuel */}
        <Card
          className="cursor-pointer hover:scale-105 transition-all duration-200 hover:shadow-lg"
          onClick={() => handleCardClick("annual")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Annuel</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(annualRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Depuis le 1er janvier
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog avec graphique */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              Évolution sur les 12 derniers mois
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: "#000" }}
                />
                <Bar
                  dataKey="value"
                  fill={getBarColor()}
                  name={getSeriesName()}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
