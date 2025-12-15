"use client";

/**
 * Composant Simulateur de Rentabilité
 * Interface en 3 zones : Charges, Service, Verdict
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  calculateServicePrice,
  upsertCostProfile,
  upsertServiceDefinition,
  analyzeProfitability,
  type ServicePriceCalculation,
} from "@/app/actions/profitability";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Calculator, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface CostProfile {
  id?: string;
  monthlyFixedCosts: number;
  desiredMonthlySalary: number;
  socialChargesRate: number;
  workingDaysPerMonth: number;
  dailyHours: number;
  vacationWeeks: number;
}

interface ServiceDefinition {
  id?: string;
  name: string;
  durationMinutes: number;
  materialCost: number;
  platformFees: number;
}

interface ProfitabilitySimulatorProps {
  initialCostProfile: CostProfile | null;
  initialServices: ServiceDefinition[];
}

export function ProfitabilitySimulator({
  initialCostProfile,
  initialServices,
}: ProfitabilitySimulatorProps) {
  // État Zone 1 : Charges
  const [costProfile, setCostProfile] = useState<CostProfile>({
    monthlyFixedCosts: initialCostProfile?.monthlyFixedCosts || 0,
    desiredMonthlySalary: initialCostProfile?.desiredMonthlySalary || 2000,
    socialChargesRate: initialCostProfile?.socialChargesRate || 22,
    workingDaysPerMonth: initialCostProfile?.workingDaysPerMonth || 20,
    dailyHours: initialCostProfile?.dailyHours || 7,
    vacationWeeks: initialCostProfile?.vacationWeeks || 5,
  });

  // État Zone 2 : Service
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    (initialServices && initialServices.length > 0 && initialServices[0]?.id) || null
  );
  const [service, setService] = useState<ServiceDefinition>(
    (initialServices && initialServices.length > 0 && initialServices[0]) || {
      name: "",
      durationMinutes: 60,
      materialCost: 0,
      platformFees: 0,
    }
  );

  // État Zone 3 : Verdict
  const [marginPercent, setMarginPercent] = useState<number[]>([20]);
  const [calculation, setCalculation] = useState<ServicePriceCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Calcul du coût horaire en temps réel
  const hourlyCost = useMemo(() => {
    if (
      costProfile.desiredMonthlySalary === 0 ||
      costProfile.dailyHours === 0 ||
      costProfile.workingDaysPerMonth === 0
    ) {
      return 0;
    }

    // Salaire brut (net + charges)
    const socialChargesAmount =
      costProfile.desiredMonthlySalary * (costProfile.socialChargesRate / 100);
    const grossSalary = costProfile.desiredMonthlySalary + socialChargesAmount;

    // Coût total mensuel
    const totalMonthlyCost = grossSalary + costProfile.monthlyFixedCosts;

    // Heures travaillées réelles (en tenant compte des vacances)
    const weeksPerYear = 52;
    const workingWeeksPerYear = weeksPerYear - costProfile.vacationWeeks;
    const workingDaysPerYear =
      workingWeeksPerYear * (costProfile.workingDaysPerMonth / (52 / 12));
    const workingHoursPerYear = workingDaysPerYear * costProfile.dailyHours;
    const workingHoursPerMonth = workingHoursPerYear / 12;

    return totalMonthlyCost / workingHoursPerMonth;
  }, [costProfile]);

  // Calcul automatique du prix quand les données changent
  // Note: Ne se déclenche que si un service existe (selectedServiceId non null)
  useEffect(() => {
    if (selectedServiceId && service.name && service.durationMinutes > 0) {
      handleCalculatePrice();
    } else {
      // Réinitialiser le calcul si pas de service valide
      setCalculation(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId, service, costProfile, marginPercent[0]]);

  /**
   * Sauvegarde du profil de coûts
   */
  const handleSaveCostProfile = async () => {
    setIsSaving(true);
    try {
      await upsertCostProfile(costProfile);
      toast.success("✅ Profil de coûts sauvegardé");
    } catch (error) {
      console.error("Erreur sauvegarde profil:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la sauvegarde du profil"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Sauvegarde du service
   */
  const handleSaveService = async () => {
    if (!service.name.trim()) {
      toast.error("Veuillez saisir un nom pour le service");
      return;
    }

    setIsSaving(true);
    try {
      const result = await upsertServiceDefinition({
        id: selectedServiceId || undefined,
        ...service,
      });
      toast.success("✅ Service sauvegardé");
      setSelectedServiceId(result.serviceId);
      // Le calcul se déclenchera automatiquement via useEffect
    } catch (error) {
      console.error("Erreur sauvegarde service:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la sauvegarde du service"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Calcul du prix du service
   */
  const handleCalculatePrice = async () => {
    // Si pas de serviceId, on ne peut pas calculer (il faut d'abord sauvegarder le service)
    if (!selectedServiceId) {
      toast.error("Veuillez d'abord sauvegarder votre service");
      return;
    }

    if (!service.name || service.durationMinutes <= 0) {
      return;
    }

    setIsCalculating(true);
    try {
      const result = await calculateServicePrice(
        selectedServiceId,
        marginPercent[0]
      );
      setCalculation(result);
      // Réinitialiser l'analyse IA quand le calcul change
      setAiAnalysis(null);
    } catch (error) {
      console.error("Erreur calcul prix:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors du calcul du prix"
      );
    } finally {
      setIsCalculating(false);
    }
  };

  /**
   * Analyse IA de la rentabilité
   */
  const handleAnalyzeProfitability = async () => {
    if (!calculation) {
      toast.error("Veuillez d'abord calculer le prix du service");
      return;
    }

    setIsAnalyzing(true);
    try {
      const analysis = await analyzeProfitability(
        calculation,
        costProfile,
        service
      );
      setAiAnalysis(analysis);
    } catch (error) {
      console.error("Erreur analyse IA:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'analyse IA"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Données pour le camembert des coûts
  const pieChartData = calculation
    ? [
        {
          name: "Main d'œuvre",
          value: calculation.breakdown.laborCost,
          color: "#3b82f6",
        },
        {
          name: "Matériel",
          value: calculation.breakdown.materialCost,
          color: "#10b981",
        },
        {
          name: "Frais plateforme",
          value: calculation.breakdown.platformFees,
          color: "#f59e0b",
        },
        {
          name: "Marge",
          value: calculation.breakdown.margin,
          color: "#8b5cf6",
        },
        {
          name: "Taxes",
          value: calculation.breakdown.taxes,
          color: "#ef4444",
        },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ZONE 1 : MES CHARGES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Mes Charges
          </CardTitle>
          <CardDescription>
            Configurez votre structure de coûts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fixedCosts">Charges fixes mensuelles (€)</Label>
            <Input
              id="fixedCosts"
              type="number"
              value={costProfile.monthlyFixedCosts}
              onChange={(e) =>
                setCostProfile({
                  ...costProfile,
                  monthlyFixedCosts: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="Loyer, Électricité, Assurance..."
            />
          </div>

          <div>
            <Label htmlFor="salary">Salaire net souhaité (€/mois)</Label>
            <Input
              id="salary"
              type="number"
              value={costProfile.desiredMonthlySalary}
              onChange={(e) =>
                setCostProfile({
                  ...costProfile,
                  desiredMonthlySalary: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="charges">
              Charges sociales (%)
            </Label>
            <Input
              id="charges"
              type="number"
              value={costProfile.socialChargesRate}
              onChange={(e) =>
                setCostProfile({
                  ...costProfile,
                  socialChargesRate: parseFloat(e.target.value) || 0,
                })
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              22% auto-entrepreneur, 45% salarié
            </p>
          </div>

          <div>
            <Label htmlFor="workingDays">Jours travaillés/mois</Label>
            <Input
              id="workingDays"
              type="number"
              value={costProfile.workingDaysPerMonth}
              onChange={(e) =>
                setCostProfile({
                  ...costProfile,
                  workingDaysPerMonth: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="dailyHours">Heures par jour</Label>
            <Input
              id="dailyHours"
              type="number"
              value={costProfile.dailyHours}
              onChange={(e) =>
                setCostProfile({
                  ...costProfile,
                  dailyHours: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="vacation">Semaines de congés/an</Label>
            <Input
              id="vacation"
              type="number"
              value={costProfile.vacationWeeks}
              onChange={(e) =>
                setCostProfile({
                  ...costProfile,
                  vacationWeeks: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>

          {/* Affichage du coût horaire en temps réel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-900">
              Votre coût à l'heure est de :
            </p>
            <p className="text-2xl font-bold text-blue-600">
              {hourlyCost.toFixed(2)} €
            </p>
          </div>

          <Button
            onClick={handleSaveCostProfile}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              "💾 Sauvegarder"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ZONE 2 : MON SERVICE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Mon Service
          </CardTitle>
          <CardDescription>
            Définissez votre prestation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="serviceName">Nom du service</Label>
            <Input
              id="serviceName"
              value={service.name}
              onChange={(e) =>
                setService({ ...service, name: e.target.value })
              }
              placeholder="Ex: Coupe + Brushing"
            />
          </div>

          <div>
            <Label htmlFor="duration">Durée (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={service.durationMinutes}
              onChange={(e) =>
                setService({
                  ...service,
                  durationMinutes: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="material">Coût matériel (€)</Label>
            <Input
              id="material"
              type="number"
              value={service.materialCost}
              onChange={(e) =>
                setService({
                  ...service,
                  materialCost: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="Shampoing, produits, etc."
            />
          </div>

          <div>
            <Label htmlFor="platformFees">
              Frais plateforme (%)
            </Label>
            <Input
              id="platformFees"
              type="number"
              value={service.platformFees}
              onChange={(e) =>
                setService({
                  ...service,
                  platformFees: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="Ex: 15% Booking, 25% Uber"
            />
          </div>

          <Button
            onClick={handleSaveService}
            disabled={isSaving || !service.name.trim()}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              "💾 Sauvegarder"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ZONE 3 : LE VERDICT */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Le Verdict</CardTitle>
          <CardDescription>Résultat du calcul</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCalculating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : calculation ? (
            <>
              {/* Prix Recommandé */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-900 mb-1">
                  Prix Recommandé
                </p>
                <p className="text-4xl font-bold text-green-600">
                  {calculation.recommendedPrice.toFixed(2)} €
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Prix minimum : {calculation.minimumPrice.toFixed(2)} €
                </p>
              </div>

              {/* Slider Marge */}
              <div>
                <Label>Marge souhaitée : {marginPercent[0]}%</Label>
                <Slider
                  value={marginPercent}
                  onValueChange={setMarginPercent}
                  min={0}
                  max={50}
                  step={1}
                  className="mt-2"
                />
              </div>

              {/* Jauge d'Effort */}
              <div
                className={`border-2 rounded-lg p-4 ${
                  calculation.isRealistic
                    ? "bg-blue-50 border-blue-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {calculation.isRealistic ? (
                    <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold text-slate-900">
                      Pour gagner {costProfile.desiredMonthlySalary.toFixed(0)}€,
                      vous devez faire{" "}
                      <span className="text-2xl">
                        {calculation.clientsNeededPerMonth}
                      </span>{" "}
                      clients par mois
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Soit {calculation.monthlyHoursNeeded.toFixed(1)} heures de
                      travail
                    </p>
                    {!calculation.isRealistic && (
                      <p className="text-sm text-red-700 font-semibold mt-2">
                        ⚠️ Attention : Risque de burnout (plus de 150h/mois)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Camembert des coûts */}
              {pieChartData.length > 0 && (
                <div>
                  <Label className="mb-2 block">Répartition des coûts</Label>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          `${value.toFixed(2)} €`
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              Configurez vos charges et votre service pour voir le calcul
            </div>
          )}
        </CardContent>
      </Card>

      {/* CARTE ANALYSE IA (en dessous du simulateur) */}
      {calculation && (
        <Card className="lg:col-span-3 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              L'avis de l'Expert IA
            </CardTitle>
            <CardDescription>
              Analyse approfondie de votre rentabilité par notre expert comptable IA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!aiAnalysis ? (
              <div className="text-center py-8">
                <Button
                  onClick={handleAnalyzeProfitability}
                  disabled={isAnalyzing}
                  size="lg"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      🤖 Analyser ma rentabilité
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                      {aiAnalysis}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleAnalyzeProfitability}
                  disabled={isAnalyzing}
                  variant="outline"
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Réanalyse...
                    </>
                  ) : (
                    "🔄 Réanalyser"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
