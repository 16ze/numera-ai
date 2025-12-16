"use client";

/**
 * Composant Client du Simulateur de Rentabilité Avancé
 * Design refondu : Split View moderne avec Tabs et zone résultat sticky
 */

import {
  calculateServiceProfitability,
  deleteResource,
  deleteServiceRecipe,
  upsertResource,
  upsertServiceRecipe,
  type ServiceProfitabilityResult,
} from "@/app/actions/simulator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  ChefHat,
  Droplet,
  Home,
  Loader2,
  Package,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Supply {
  id: string;
  name: string;
  supplier: string | null;
  purchasePrice: number;
  totalQuantity: number;
  unit: string;
}

interface Equipment {
  id: string;
  name: string;
  supplier: string | null;
  purchasePrice: number;
  lifespanMonths: number;
  weeklyUses: number;
}

interface Overhead {
  id: string;
  name: string;
  monthlyCost: number;
  category: "FIXED" | "URSSAF_PERCENT";
}

interface ServiceRecipe {
  id: string;
  name: string;
  laborTimeMinutes: number;
  laborHourlyCost: number;
  suppliesUsed: Array<{
    id: string;
    quantityUsed: number;
    supply: Supply;
  }>;
  equipmentUsed: Array<{
    id: string;
    equipment: Equipment;
  }>;
}

interface SimulatorClientProps {
  initialResources: {
    supplies: Supply[];
    equipment: Equipment[];
    overheads: Overhead[];
  };
  initialServiceRecipes: ServiceRecipe[];
}

export function SimulatorClient({
  initialResources,
  initialServiceRecipes,
}: SimulatorClientProps) {
  // État des ressources
  const [supplies, setSupplies] = useState<Supply[]>(initialResources.supplies);
  const [equipment, setEquipment] = useState<Equipment[]>(
    initialResources.equipment
  );
  const [overheads, setOverheads] = useState<Overhead[]>(
    initialResources.overheads
  );

  // État de la recette en cours
  const [serviceRecipes, setServiceRecipes] = useState<ServiceRecipe[]>(
    initialServiceRecipes
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(
    initialServiceRecipes[0]?.id || null
  );
  const [recipeName, setRecipeName] = useState(
    initialServiceRecipes[0]?.name || ""
  );
  const [laborTimeMinutes, setLaborTimeMinutes] = useState<number[]>([
    initialServiceRecipes[0]?.laborTimeMinutes || 60,
  ]);
  const [laborHourlyCost, setLaborHourlyCost] = useState<number[]>([
    initialServiceRecipes[0]?.laborHourlyCost || 25,
  ]);
  const [selectedSupplies, setSelectedSupplies] = useState<
    Array<{ supplyId: string; quantityUsed: number }>
  >(
    initialServiceRecipes[0]?.suppliesUsed.map((s) => ({
      supplyId: s.supply.id,
      quantityUsed: s.quantityUsed,
    })) || []
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(
    initialServiceRecipes[0]?.equipmentUsed.map((e) => e.equipment.id) || []
  );

  // État du résultat
  const [calculation, setCalculation] =
    useState<ServiceProfitabilityResult | null>(null);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Calcul automatique quand les données changent
  useEffect(() => {
    if (selectedRecipeId && recipeName) {
      handleCalculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedRecipeId,
    recipeName,
    laborTimeMinutes[0],
    laborHourlyCost[0],
    selectedSupplies,
    selectedEquipment,
    supplies,
    equipment,
    overheads,
  ]);

  /**
   * Calcul de la rentabilité
   */
  const handleCalculate = async () => {
    // Si pas de recette sauvegardée, on ne peut pas calculer
    if (!selectedRecipeId) {
      setCalculation(null);
      return;
    }

    if (!recipeName.trim()) {
      return;
    }

    setIsCalculating(true);
    try {
      const result = await calculateServiceProfitability(
        selectedRecipeId,
        sellingPrice > 0 ? sellingPrice : undefined
      );
      setCalculation(result);
    } catch (error) {
      console.error("Erreur calcul:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors du calcul"
      );
      setCalculation(null);
    } finally {
      setIsCalculating(false);
    }
  };

  /**
   * Sauvegarde d'une ressource
   */
  const handleSaveResource = async (
    type: "supply" | "equipment" | "overhead",
    data: any
  ) => {
    setIsSaving(true);
    try {
      await upsertResource(type, data);
      toast.success("✅ Ressource sauvegardée");
      // Recharger les ressources
      const { getResources } = await import("@/app/actions/simulator");
      const resources = await getResources();
      setSupplies(resources.supplies);
      setEquipment(resources.equipment);
      setOverheads(resources.overheads);
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la sauvegarde"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Suppression d'une ressource
   */
  const handleDeleteResource = async (
    type: "supply" | "equipment" | "overhead",
    id: string
  ) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette ressource ?")) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteResource(type, id);
      toast.success("✅ Ressource supprimée");
      // Recharger les ressources
      const { getResources } = await import("@/app/actions/simulator");
      const resources = await getResources();
      setSupplies(resources.supplies);
      setEquipment(resources.equipment);
      setOverheads(resources.overheads);
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Sauvegarde de la recette
   */
  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) {
      toast.error("Veuillez saisir un nom pour la recette");
      return;
    }

    setIsSaving(true);
    try {
      const result = await upsertServiceRecipe({
        id: selectedRecipeId || undefined,
        name: recipeName,
        laborTimeMinutes: laborTimeMinutes[0],
        laborHourlyCost: laborHourlyCost[0],
        supplyIds: selectedSupplies,
        equipmentIds: selectedEquipment,
      });
      toast.success("✅ Recette sauvegardée");
      setSelectedRecipeId(result.serviceRecipeId);

      // Recharger les recettes
      const { getServiceRecipes } = await import("@/app/actions/simulator");
      const recipes = await getServiceRecipes();
      setServiceRecipes(recipes);

      // Mettre à jour les données de la recette sélectionnée
      const updatedRecipe = recipes.find(
        (r) => r.id === result.serviceRecipeId
      );
      if (updatedRecipe) {
        setSelectedSupplies(
          updatedRecipe.suppliesUsed.map((s) => ({
            supplyId: s.supply.id,
            quantityUsed: s.quantityUsed,
          }))
        );
        setSelectedEquipment(
          updatedRecipe.equipmentUsed.map((e) => e.equipment.id)
        );
      }

      // Le calcul se déclenchera automatiquement via useEffect
    } catch (error) {
      console.error("Erreur sauvegarde recette:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la sauvegarde"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Suppression d'une recette
   */
  const handleDeleteRecipe = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette recette ?")) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteServiceRecipe(id);
      toast.success("✅ Recette supprimée");

      // Recharger les recettes
      const { getServiceRecipes } = await import("@/app/actions/simulator");
      const recipes = await getServiceRecipes();
      setServiceRecipes(recipes);

      // Sélectionner la première recette ou réinitialiser
      if (recipes.length > 0) {
        const firstRecipe = recipes[0];
        setSelectedRecipeId(firstRecipe.id);
        setRecipeName(firstRecipe.name);
        setLaborTimeMinutes([firstRecipe.laborTimeMinutes]);
        setLaborHourlyCost([firstRecipe.laborHourlyCost]);
        setSelectedSupplies(
          firstRecipe.suppliesUsed.map((s) => ({
            supplyId: s.supply.id,
            quantityUsed: s.quantityUsed,
          }))
        );
        setSelectedEquipment(
          firstRecipe.equipmentUsed.map((e) => e.equipment.id)
        );
      } else {
        setSelectedRecipeId(null);
        setRecipeName("");
        setLaborTimeMinutes([60]);
        setLaborHourlyCost([25]);
        setSelectedSupplies([]);
        setSelectedEquipment([]);
      }
    } catch (error) {
      console.error("Erreur suppression recette:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Données pour le graphique Donut
  const donutChartData = calculation
    ? [
        {
          name: "Consommables",
          value: calculation.suppliesCost,
          color: "#3b82f6", // Bleu
        },
        {
          name: "Matériel",
          value: calculation.equipmentCost,
          color: "#10b981", // Vert
        },
        {
          name: "Main d'œuvre",
          value: calculation.laborCost,
          color: "#f59e0b", // Orange
        },
        {
          name: "Charges fixes",
          value: calculation.overheadCost,
          color: "#8b5cf6", // Violet
        },
      ].filter((item) => item.value > 0)
    : [];

  // Calcul de la marge pour le feedback visuel
  const marginPercent = calculation?.marginPercent ?? 0;
  const isProfitable =
    calculation?.netMargin !== undefined && calculation.netMargin >= 0;
  const isHighMargin = marginPercent > 20;
  const isLoss = !isProfitable;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* COLONNE GAUCHE : Zone de travail (span-2) */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Configurez vos ressources, composez votre recette et gérez vos
              charges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="resources" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="resources"
                  className="flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Ressources
                </TabsTrigger>
                <TabsTrigger value="recipe" className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4" />
                  Recette
                </TabsTrigger>
                <TabsTrigger
                  value="overheads"
                  className="flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  Charges
                </TabsTrigger>
              </TabsList>

              {/* ONGLET 1 : RESSOURCES */}
              <TabsContent value="resources" className="space-y-6 mt-6">
                {/* Consommables */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Droplet className="h-5 w-5 text-blue-500" />
                      Consommables ({supplies.length})
                    </h3>
                  </div>
                  <ResourceForm
                    type="supply"
                    resources={supplies}
                    onSave={handleSaveResource}
                    onDelete={handleDeleteResource}
                    isSaving={isSaving}
                  />
                </div>

                {/* Matériel */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-500" />
                      Matériel ({equipment.length})
                    </h3>
                  </div>
                  <ResourceForm
                    type="equipment"
                    resources={equipment}
                    onSave={handleSaveResource}
                    onDelete={handleDeleteResource}
                    isSaving={isSaving}
                  />
                </div>
              </TabsContent>

              {/* ONGLET 2 : RECETTE */}
              <TabsContent value="recipe" className="space-y-6 mt-6">
                {/* Sélection/Liste des recettes */}
                {serviceRecipes.length > 0 && (
                  <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
                    <Label className="text-sm font-semibold text-slate-700 mb-2 block">
                      Recettes existantes
                    </Label>
                    {serviceRecipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        className={`flex items-center justify-between p-2 bg-white rounded border ${
                          selectedRecipeId === recipe.id
                            ? "border-blue-500 bg-blue-50"
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecipeId(recipe.id);
                            setRecipeName(recipe.name);
                            setLaborTimeMinutes([recipe.laborTimeMinutes]);
                            setLaborHourlyCost([recipe.laborHourlyCost]);
                            setSelectedSupplies(
                              recipe.suppliesUsed.map((s) => ({
                                supplyId: s.supply.id,
                                quantityUsed: s.quantityUsed,
                              }))
                            );
                            setSelectedEquipment(
                              recipe.equipmentUsed.map((e) => e.equipment.id)
                            );
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="font-medium text-sm">
                            {recipe.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {recipe.laborTimeMinutes} min -{" "}
                            {recipe.laborHourlyCost} €/h
                          </div>
                        </button>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRecipe(recipe.id)}
                            disabled={isSaving}
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nom du service */}
                <div className="space-y-2">
                  <Label htmlFor="recipeName" className="text-base font-medium">
                    Nom du service
                  </Label>
                  <Input
                    id="recipeName"
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="Ex: Coupe + Brushing"
                    className="h-11"
                  />
                </div>

                {/* Temps de main d'œuvre */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">
                      Temps de main d'œuvre
                    </Label>
                    <span className="text-lg font-semibold text-slate-700">
                      {laborTimeMinutes[0]} min
                    </span>
                  </div>
                  <Slider
                    value={laborTimeMinutes}
                    onValueChange={setLaborTimeMinutes}
                    min={5}
                    max={180}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">
                    Glissez pour ajuster la durée (5-180 minutes)
                  </p>
                </div>

                {/* Taux horaire */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">
                      Taux horaire
                    </Label>
                    <span className="text-lg font-semibold text-slate-700">
                      {laborHourlyCost[0]} €/h
                    </span>
                  </div>
                  <Slider
                    value={laborHourlyCost}
                    onValueChange={setLaborHourlyCost}
                    min={10}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">
                    Coût horaire de la main d'œuvre
                  </p>
                </div>

                {/* Consommables utilisés */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    Consommables utilisés
                  </Label>
                  <div className="space-y-2">
                    {selectedSupplies.map((selected, index) => {
                      const supply = supplies.find(
                        (s) => s.id === selected.supplyId
                      );
                      if (!supply) return null;

                      const unitCost =
                        supply.purchasePrice / supply.totalQuantity;
                      const costForQuantity = unitCost * selected.quantityUsed;

                      return (
                        <Card
                          key={`${selected.supplyId}-${index}`}
                          className="p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Droplet className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">
                                  {supply.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Input
                                  type="number"
                                  value={selected.quantityUsed}
                                  onChange={(e) => {
                                    const newSupplies = [...selectedSupplies];
                                    newSupplies[index].quantityUsed =
                                      parseFloat(e.target.value) || 0;
                                    setSelectedSupplies(newSupplies);
                                  }}
                                  className="w-24 h-8"
                                  min="0"
                                  step="0.1"
                                />
                                <span className="text-sm text-slate-500">
                                  {supply.unit}
                                </span>
                                <span className="text-sm font-semibold text-slate-700 ml-auto">
                                  {costForQuantity.toFixed(2)} €
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedSupplies(
                                  selectedSupplies.filter((_, i) => i !== index)
                                );
                              }}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                    <select
                      onChange={(e) => {
                        const supplyId = e.target.value;
                        if (supplyId) {
                          const supply = supplies.find(
                            (s) => s.id === supplyId
                          );
                          if (supply) {
                            setSelectedSupplies([
                              ...selectedSupplies,
                              { supplyId, quantityUsed: 1 },
                            ]);
                            e.target.value = "";
                          }
                        }
                      }}
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        + Ajouter un consommable
                      </option>
                      {supplies
                        .filter(
                          (s) =>
                            !selectedSupplies.some(
                              (sel) => sel.supplyId === s.id
                            )
                        )
                        .map((supply) => (
                          <option key={supply.id} value={supply.id}>
                            {supply.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Matériel utilisé */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    Matériel utilisé
                  </Label>
                  <div className="space-y-2">
                    {equipment.map((eq) => {
                      const isSelected = selectedEquipment.includes(eq.id);
                      const costPerService =
                        eq.purchasePrice /
                        (eq.lifespanMonths * 4.33 * eq.weeklyUses);

                      return (
                        <Card
                          key={eq.id}
                          className={`p-3 transition-colors ${
                            isSelected ? "border-green-500 bg-green-50/50" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedEquipment([
                                      ...selectedEquipment,
                                      eq.id,
                                    ]);
                                  } else {
                                    setSelectedEquipment(
                                      selectedEquipment.filter(
                                        (id) => id !== eq.id
                                      )
                                    );
                                  }
                                }}
                              />
                              <Zap className="h-4 w-4 text-green-500" />
                              <span className="font-medium">{eq.name}</span>
                            </div>
                            {isSelected && (
                              <span className="text-sm font-semibold text-slate-700">
                                {costPerService.toFixed(2)} €/prestation
                              </span>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={handleSaveRecipe}
                  disabled={isSaving || !recipeName.trim()}
                  className="w-full h-11"
                  size="lg"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <Receipt className="mr-2 h-4 w-4" />
                      Sauvegarder la recette
                    </>
                  )}
                </Button>
              </TabsContent>

              {/* ONGLET 3 : CHARGES */}
              <TabsContent value="overheads" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Home className="h-5 w-5 text-purple-500" />
                      Charges ({overheads.length})
                    </h3>
                  </div>
                  <ResourceForm
                    type="overhead"
                    resources={overheads}
                    onSave={handleSaveResource}
                    onDelete={handleDeleteResource}
                    isSaving={isSaving}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* COLONNE DROITE : Zone de résultat sticky (span-1) */}
      <div className="lg:col-span-1">
        <div className="sticky top-6">
          <Card className="border-2 shadow-lg">
            <CardHeader className="border-b pb-5 px-6">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Receipt className="h-6 w-6 text-blue-600" />
                Le Ticket de Vérité
              </CardTitle>
              <CardDescription className="mt-1.5 text-sm">
                Coût de revient détaillé de votre prestation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 px-6 pb-6">
              {isCalculating ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : calculation ? (
                <>
                  {/* Graphique Donut - Répartition des coûts */}
                  {donutChartData.length > 0 && (
                    <div className="space-y-4 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-blue-500"></div>
                        <Label className="text-sm font-semibold text-slate-800">
                          Répartition des coûts
                        </Label>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={donutChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {donutChartData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) =>
                                `${value.toFixed(2)} €`
                              }
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={50}
                              iconType="circle"
                              wrapperStyle={{ paddingTop: "12px" }}
                              formatter={(value) => value}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Liste des coûts détaillés avec icônes */}
                  <div className="space-y-3 border-t border-slate-200 pt-5">
                    <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-blue-100">
                          <Droplet className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Consommables
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {calculation.suppliesCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-green-100">
                          <Zap className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Matériel
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {calculation.equipmentCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-orange-100">
                          <Wrench className="h-4 w-4 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Main d'œuvre
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {calculation.laborCost.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-purple-100">
                          <Home className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Charges fixes
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {calculation.overheadCost.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {/* TOTAL COÛT DE REVIENT */}
                  <div className="border-t-2 border-slate-300 pt-5 mt-2">
                    <div className="bg-slate-50 border-2 border-slate-300 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
                          Total Coût de Revient
                        </span>
                        <span className="text-3xl font-extrabold text-slate-700">
                          {calculation.totalCost.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Zone mise en avant : Prix de vente et Marge */}
                  <div
                    className={`rounded-xl p-6 space-y-5 transition-all shadow-md ${
                      isLoss
                        ? "bg-gradient-to-br from-red-50 to-red-100/50 border-2 border-red-300"
                        : isHighMargin
                          ? "bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-300"
                          : "bg-gradient-to-br from-blue-50 to-blue-100/50 border-2 border-blue-300"
                    }`}
                  >
                    <div className="space-y-3">
                      <Label
                        htmlFor="sellingPrice"
                        className={`text-sm font-bold ${
                          isLoss
                            ? "text-red-800"
                            : isHighMargin
                              ? "text-green-800"
                              : "text-blue-800"
                        }`}
                      >
                        💰 Prix de Vente (€)
                      </Label>
                      <Input
                        id="sellingPrice"
                        type="number"
                        value={sellingPrice || ""}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value) || 0;
                          setSellingPrice(price);
                          // Recalculer avec le nouveau prix
                          if (selectedRecipeId && price > 0) {
                            calculateServiceProfitability(
                              selectedRecipeId,
                              price
                            ).then(setCalculation);
                          }
                        }}
                        placeholder="Ex: 50"
                        className={`h-12 text-lg font-semibold ${
                          isLoss
                            ? "border-red-300 focus:border-red-500"
                            : isHighMargin
                              ? "border-green-300 focus:border-green-500"
                              : "border-blue-300 focus:border-blue-500"
                        }`}
                      />
                    </div>

                    {/* Résultat Marge Nette */}
                    {calculation.sellingPrice !== undefined &&
                      calculation.netMargin !== undefined && (
                        <div className="space-y-2 pt-2 border-t border-slate-300/50">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm font-bold uppercase tracking-wide ${
                                isLoss
                                  ? "text-red-800"
                                  : isHighMargin
                                    ? "text-green-800"
                                    : "text-blue-800"
                              }`}
                            >
                              {isLoss ? "❌ PERTE" : "✅ Marge Nette"}
                            </span>
                            <span
                              className={`text-4xl font-extrabold ${
                                isLoss
                                  ? "text-red-600"
                                  : isHighMargin
                                    ? "text-green-600"
                                    : "text-blue-600"
                              }`}
                            >
                              {calculation.netMargin >= 0 ? "+" : ""}
                              {calculation.netMargin.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex items-center justify-end">
                            <p
                              className={`text-base font-bold ${
                                isLoss
                                  ? "text-red-600"
                                  : isHighMargin
                                    ? "text-green-600"
                                    : "text-blue-600"
                              }`}
                            >
                              Marge : {calculation.marginPercent?.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Diagnostic de Rentabilité */}
                    {calculation.sellingPrice !== undefined &&
                      calculation.sellingPrice > 0 && (
                        <ProfitabilityDiagnosis
                          totalCost={calculation.totalCost}
                          sellingPrice={calculation.sellingPrice}
                        />
                      )}
                  </div>
                </>
              ) : (
                <div className="text-center py-16 space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <Receipt className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    Configurez votre recette
                  </p>
                  <p className="text-xs text-slate-500">
                    pour voir le calcul de rentabilité
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Composant pour ajouter/modifier/supprimer une ressource
 */
function ResourceForm({
  type,
  resources,
  onSave,
  onDelete,
  isSaving,
}: {
  type: "supply" | "equipment" | "overhead";
  resources: any[];
  onSave: (type: any, data: any) => Promise<void>;
  onDelete: (type: any, id: string) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(type, formData);
    setFormData({});
    setEditingId(null);
  };

  const handleEdit = (resource: any) => {
    setFormData(resource);
    setEditingId(resource.id);
  };

  const handleCancel = () => {
    setFormData({});
    setEditingId(null);
  };

  if (type === "supply") {
    return (
      <div className="space-y-4">
        {/* Liste des consommables existants */}
        {resources.length > 0 && (
          <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center justify-between p-2 bg-white rounded border"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{resource.name}</div>
                  <div className="text-xs text-slate-500">
                    {resource.purchasePrice} € / {resource.totalQuantity}{" "}
                    {resource.unit}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(resource)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(type, resource.id)}
                    disabled={isSaving}
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulaire d'ajout/modification */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {editingId && (
            <div className="text-sm font-medium text-blue-600 mb-2">
              Modification en cours...
            </div>
          )}
          <Input
            placeholder="Nom (ex: Shampooing)"
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-10"
            required
          />
          <Input
            placeholder="Fournisseur (ex: L'Oréal)"
            value={formData.supplier || ""}
            onChange={(e) =>
              setFormData({ ...formData, supplier: e.target.value })
            }
            className="h-10"
          />
          <Input
            type="number"
            placeholder="Prix d'achat (€)"
            value={formData.purchasePrice || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                purchasePrice: parseFloat(e.target.value) || 0,
              })
            }
            className="h-10"
            required
            min="0"
            step="0.01"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Quantité totale"
              value={formData.totalQuantity || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  totalQuantity: parseFloat(e.target.value) || 0,
                })
              }
              className="flex-1 h-10"
              required
              min="0"
              step="0.1"
            />
            <Input
              placeholder="Unité (ml, g...)"
              value={formData.unit || "ml"}
              onChange={(e) =>
                setFormData({ ...formData, unit: e.target.value })
              }
              className="w-24 h-10"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isSaving}
              size="sm"
              className="flex-1 h-10"
            >
              {editingId ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </>
              )}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                size="sm"
                className="h-10"
              >
                Annuler
              </Button>
            )}
          </div>
        </form>
      </div>
    );
  }

  if (type === "equipment") {
    return (
      <div className="space-y-4">
        {/* Liste du matériel existant */}
        {resources.length > 0 && (
          <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center justify-between p-2 bg-white rounded border"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{resource.name}</div>
                  <div className="text-xs text-slate-500">
                    {resource.purchasePrice} € - {resource.lifespanMonths} mois
                    - {resource.weeklyUses} utilisations/semaine
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(resource)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(type, resource.id)}
                    disabled={isSaving}
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulaire d'ajout/modification */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {editingId && (
            <div className="text-sm font-medium text-blue-600 mb-2">
              Modification en cours...
            </div>
          )}
          <Input
            placeholder="Nom (ex: Lampe UV)"
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-10"
            required
          />
          <Input
            placeholder="Fournisseur"
            value={formData.supplier || ""}
            onChange={(e) =>
              setFormData({ ...formData, supplier: e.target.value })
            }
            className="h-10"
          />
          <Input
            type="number"
            placeholder="Prix d'achat (€)"
            value={formData.purchasePrice || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                purchasePrice: parseFloat(e.target.value) || 0,
              })
            }
            className="h-10"
            required
            min="0"
            step="0.01"
          />
          <Input
            type="number"
            placeholder="Durée de vie (mois)"
            value={formData.lifespanMonths || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                lifespanMonths: parseInt(e.target.value) || 0,
              })
            }
            className="h-10"
            required
            min="1"
          />
          <Input
            type="number"
            placeholder="Utilisations/semaine"
            value={formData.weeklyUses || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                weeklyUses: parseInt(e.target.value) || 0,
              })
            }
            className="h-10"
            required
            min="1"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isSaving}
              size="sm"
              className="flex-1 h-10"
            >
              {editingId ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </>
              )}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                size="sm"
                className="h-10"
              >
                Annuler
              </Button>
            )}
          </div>
        </form>
      </div>
    );
  }

  if (type === "overhead") {
    return (
      <div className="space-y-4">
        {/* Liste des charges existantes */}
        {resources.length > 0 && (
          <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center justify-between p-2 bg-white rounded border"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{resource.name}</div>
                  <div className="text-xs text-slate-500">
                    {resource.monthlyCost} €/mois -{" "}
                    {resource.category === "FIXED" ? "Fixe" : "% du CA"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(resource)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(type, resource.id)}
                    disabled={isSaving}
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulaire d'ajout/modification */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {editingId && (
            <div className="text-sm font-medium text-blue-600 mb-2">
              Modification en cours...
            </div>
          )}
          <Input
            placeholder="Nom (ex: Loyer)"
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-10"
            required
          />
          <Input
            type="number"
            placeholder="Coût mensuel (€) ou % du CA"
            value={formData.monthlyCost || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                monthlyCost: parseFloat(e.target.value) || 0,
              })
            }
            className="h-10"
            required
            min="0"
            step="0.01"
          />
          <select
            value={formData.category || "FIXED"}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="FIXED">Fixe (ex: Loyer)</option>
            <option value="URSSAF_PERCENT">% du CA (ex: URSSAF)</option>
          </select>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isSaving}
              size="sm"
              className="flex-1 h-10"
            >
              {editingId ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </>
              )}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                size="sm"
                className="h-10"
              >
                Annuler
              </Button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return null;
}

/**
 * Composant de diagnostic de rentabilité
 * Explique clairement la situation financière et donne des conseils concrets
 */
function ProfitabilityDiagnosis({
  totalCost,
  sellingPrice,
}: {
  totalCost: number;
  sellingPrice: number;
}) {
  const margin = sellingPrice - totalCost;
  const marginPercent = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

  // Scénario A : Vente à perte
  if (sellingPrice < totalCost) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-3 mt-4">
        <div className="flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div className="flex-1 space-y-2">
            <h4 className="font-bold text-red-900 text-base">
              DANGER : Vente à perte
            </h4>
            <p className="text-sm text-red-800 leading-relaxed">
              Chaque prestation vous coûte{" "}
              <span className="font-bold">{Math.abs(margin).toFixed(2)} €</span>{" "}
              de votre poche. Vous ne couvrez pas vos frais.
            </p>
            <div className="bg-red-100 border border-red-300 rounded-md p-3 mt-2">
              <p className="text-sm font-semibold text-red-900">
                💡 Conseil : Augmentez votre prix au moins à{" "}
                <span className="font-extrabold">{totalCost.toFixed(2)} €</span>{" "}
                pour être à l'équilibre.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scénario B : Marge faible (< 20%)
  if (marginPercent < 20) {
    return (
      <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 space-y-3 mt-4">
        <div className="flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div className="flex-1 space-y-2">
            <h4 className="font-bold text-orange-900 text-base">
              Rentabilité Fragile
            </h4>
            <p className="text-sm text-orange-800 leading-relaxed">
              Vous ne gagnez que{" "}
              <span className="font-bold">{margin.toFixed(2)} €</span> par
              prestation. Au moindre imprévu, vous êtes en danger.
            </p>
            <div className="bg-orange-100 border border-orange-300 rounded-md p-3 mt-2">
              <p className="text-sm font-semibold text-orange-900">
                💡 Conseil : Essayez de réduire le coût matière ou d'augmenter
                légèrement le tarif pour atteindre au moins 20% de marge.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scénario C : Marge saine (> 20%)
  return (
    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 space-y-3 mt-4">
      <div className="flex items-start gap-2">
        <span className="text-lg">✅</span>
        <div className="flex-1 space-y-2">
          <h4 className="font-bold text-green-900 text-base">
            Excellente Rentabilité
          </h4>
          <p className="text-sm text-green-800 leading-relaxed">
            Bravo ! Vous dégagez{" "}
            <span className="font-bold">{margin.toFixed(2)} €</span> de bénéfice
            net à chaque fois (marge de{" "}
            <span className="font-bold">{marginPercent.toFixed(1)}%</span>).
          </p>
          <div className="bg-green-100 border border-green-300 rounded-md p-3 mt-2">
            <p className="text-sm font-semibold text-green-900">
              💡 C'est un prix juste qui assure la pérennité de votre
              entreprise.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
