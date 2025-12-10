"use client";

/**
 * Composant client pour le graphique Recettes vs Dépenses
 * Utilise Recharts qui nécessite "use client"
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ChartDataPoint } from "@/app/actions/dashboard";

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
 * Formatage de date (format français)
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Props du composant RevenueChart
 */
interface RevenueChartProps {
  data: ChartDataPoint[];
}

/**
 * Composant graphique pour afficher les recettes vs dépenses
 */
export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getDate()}/${date.getMonth() + 1}`;
          }}
        />
        <YAxis tickFormatter={(value) => formatCurrency(value)} />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelFormatter={(label) => {
            const date = new Date(label);
            return formatDate(date);
          }}
        />
        <Legend />
        <Bar
          dataKey="recettes"
          fill="#22c55e"
          name="Recettes"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="depenses"
          fill="#ef4444"
          name="Dépenses"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

