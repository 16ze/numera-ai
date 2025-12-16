"use client";

/**
 * Composant Client du Simulateur de Rentabilité Avancé
 * Interface en 3 colonnes : Ressources, Recette, Ticket de Caisse
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { useEffect, useState } from "react";
// Note: Select component sera installé via shadcn
import {
  calculateServiceProfitability,
  upsertResource,
  upsertServiceRecipe,
  type ServiceProfitabilityResult,
} from "@/app/actions/simulator";
import {
  ChefHat,
  Home,
  Loader2,
  Package,
  Plus,
  Receipt,
  Trash2,
  Wrench,
} from "lucide-react";
import toast from "react-hot-toast";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

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

  // Données pour le graphique de répartition
  const pieChartData = calculation
    ? [
        {
          name: "Consommables",
          value: calculation.suppliesCost,
          color: "#3b82f6",
        },
        {
          name: "Matériel",
          value: calculation.equipmentCost,
          color: "#10b981",
        },
        {
          name: "Main d'œuvre",
          value: calculation.laborCost,
          color: "#f59e0b",
        },
        {
          name: "Charges fixes",
          value: calculation.overheadCost,
          color: "#8b5cf6",
        },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* COLONNE 1 : MES RESSOURCES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mes Ressources
          </CardTitle>
          <CardDescription>
            Configurez vos consommables, matériel et charges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* Consommables */}
            <AccordionItem value="supplies">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Consommables ({supplies.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ResourceForm
                  type="supply"
                  resources={supplies}
                  onSave={handleSaveResource}
                  isSaving={isSaving}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Matériel */}
            <AccordionItem value="equipment">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Matériel ({equipment.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ResourceForm
                  type="equipment"
                  resources={equipment}
                  onSave={handleSaveResource}
                  isSaving={isSaving}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Charges */}
            <AccordionItem value="overheads">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Charges ({overheads.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ResourceForm
                  type="overhead"
                  resources={overheads}
                  onSave={handleSaveResource}
                  isSaving={isSaving}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* COLONNE 2 : MA RECETTE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Ma Recette
          </CardTitle>
          <CardDescription>
            Construisez votre prestation brique par brique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nom du service */}
          <div>
            <Label htmlFor="recipeName">Nom du service</Label>
            <Input
              id="recipeName"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="Ex: Coupe + Brushing"
            />
          </div>

          {/* Temps de main d'œuvre */}
          <div>
            <Label>Temps de main d'œuvre : {laborTimeMinutes[0]} minutes</Label>
            <Slider
              value={laborTimeMinutes}
              onValueChange={setLaborTimeMinutes}
              min={5}
              max={300}
              step={5}
              className="mt-2"
            />
          </div>

          {/* Taux horaire */}
          <div>
            <Label>Taux horaire : {laborHourlyCost[0]} €/h</Label>
            <Slider
              value={laborHourlyCost}
              onValueChange={setLaborHourlyCost}
              min={10}
              max={100}
              step={1}
              className="mt-2"
            />
          </div>

          {/* Consommables utilisés */}
          <div>
            <Label>Consommables utilisés</Label>
            <div className="space-y-2 mt-2">
              {selectedSupplies.map((selected, index) => {
                const supply = supplies.find((s) => s.id === selected.supplyId);
                if (!supply) return null;

                const unitCost = supply.purchasePrice / supply.totalQuantity;
                const costForQuantity = unitCost * selected.quantityUsed;

                return (
                  <div
                    key={`${selected.supplyId}-${index}`}
                    className="flex items-center gap-2 p-2 border rounded"
                  >
                    <span className="flex-1 text-sm">
                      {supply.name} (
                      <Input
                        type="number"
                        value={selected.quantityUsed}
                        onChange={(e) => {
                          const newSupplies = [...selectedSupplies];
                          newSupplies[index].quantityUsed =
                            parseFloat(e.target.value) || 0;
                          setSelectedSupplies(newSupplies);
                        }}
                        className="w-20 h-8 inline-block"
                        min="0"
                        step="0.1"
                      />{" "}
                      {supply.unit})
                    </span>
                    <span className="text-xs text-slate-500">
                      {costForQuantity.toFixed(2)} €
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedSupplies(
                          selectedSupplies.filter((_, i) => i !== index)
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <select
                onChange={(e) => {
                  const supplyId = e.target.value;
                  if (supplyId) {
                    const supply = supplies.find((s) => s.id === supplyId);
                    if (supply) {
                      setSelectedSupplies([
                        ...selectedSupplies,
                        { supplyId, quantityUsed: 1 },
                      ]);
                      e.target.value = ""; // Reset le select
                    }
                  }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Ajouter un consommable
                </option>
                {supplies
                  .filter(
                    (s) =>
                      !selectedSupplies.some((sel) => sel.supplyId === s.id)
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
          <div>
            <Label>Matériel utilisé</Label>
            <div className="space-y-2 mt-2">
              {equipment.map((eq) => {
                const isSelected = selectedEquipment.includes(eq.id);
                const costPerService =
                  eq.purchasePrice / (eq.lifespanMonths * 4.33 * eq.weeklyUses);

                return (
                  <div
                    key={eq.id}
                    className="flex items-center gap-2 p-2 border rounded"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedEquipment([...selectedEquipment, eq.id]);
                        } else {
                          setSelectedEquipment(
                            selectedEquipment.filter((id) => id !== eq.id)
                          );
                        }
                      }}
                    />
                    <span className="flex-1 text-sm">{eq.name}</span>
                    {isSelected && (
                      <span className="text-xs text-slate-500">
                        {costPerService.toFixed(2)} €/prestation
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleSaveRecipe}
            disabled={isSaving || !recipeName.trim()}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              "💾 Sauvegarder la recette"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* COLONNE 3 : LE TICKET DE CAISSE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Le Ticket de Caisse
          </CardTitle>
          <CardDescription>Résultat du calcul</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCalculating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : calculation ? (
            <>
              {/* Liste des coûts */}
              <div className="space-y-2 border-b pb-4">
                <div className="flex justify-between text-sm">
                  <span>💧 Consommables</span>
                  <span className="font-semibold">
                    {calculation.suppliesCost.toFixed(2)} €
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>🔌 Usure Matériel</span>
                  <span className="font-semibold">
                    {calculation.equipmentCost.toFixed(2)} €
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>👷 Main d'œuvre</span>
                  <span className="font-semibold">
                    {calculation.laborCost.toFixed(2)} €
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>🏠 Quote-part Loyer</span>
                  <span className="font-semibold">
                    {calculation.overheadCost.toFixed(2)} €
                  </span>
                </div>
              </div>

              {/* TOTAL COÛT DE REVIENT */}
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-red-900">
                    TOTAL COÛT DE REVIENT
                  </span>
                  <span className="text-2xl font-bold text-red-600">
                    {calculation.totalCost.toFixed(2)} €
                  </span>
                </div>
              </div>

              {/* Prix de vente envisagé */}
              <div>
                <Label htmlFor="sellingPrice">Prix de vente envisagé (€)</Label>
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
                />
              </div>

              {/* Résultat marge */}
              {calculation.sellingPrice !== undefined &&
                calculation.netMargin !== undefined && (
                  <div
                    className={`border-2 rounded-lg p-4 ${
                      calculation.netMargin >= 0
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">
                        {calculation.netMargin >= 0
                          ? "✅ Marge nette"
                          : "❌ PERTE"}
                      </span>
                      <span
                        className={`text-2xl font-bold ${
                          calculation.netMargin >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {calculation.netMargin >= 0 ? "+" : ""}
                        {calculation.netMargin.toFixed(2)} €
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      Marge : {calculation.marginPercent?.toFixed(1)}%
                    </p>
                  </div>
                )}

              {/* Graphique de répartition */}
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
                        formatter={(value: number) => `${value.toFixed(2)} €`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              Configurez votre recette pour voir le calcul
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Composant pour ajouter/modifier une ressource
 */
function ResourceForm({
  type,
  resources,
  onSave,
  isSaving,
}: {
  type: "supply" | "equipment" | "overhead";
  resources: any[];
  onSave: (type: any, data: any) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<any>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(type, formData);
    setFormData({});
  };

  if (type === "supply") {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Nom (ex: Shampooing)"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input
          placeholder="Fournisseur (ex: L'Oréal)"
          value={formData.supplier || ""}
          onChange={(e) =>
            setFormData({ ...formData, supplier: e.target.value })
          }
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
            className="flex-1"
          />
          <Input
            placeholder="Unité (ml, g...)"
            value={formData.unit || "ml"}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            className="w-20"
          />
        </div>
        <Button type="submit" disabled={isSaving} size="sm" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </form>
    );
  }

  if (type === "equipment") {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Nom (ex: Lampe UV)"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input
          placeholder="Fournisseur"
          value={formData.supplier || ""}
          onChange={(e) =>
            setFormData({ ...formData, supplier: e.target.value })
          }
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
        />
        <Button type="submit" disabled={isSaving} size="sm" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </form>
    );
  }

  if (type === "overhead") {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Nom (ex: Loyer)"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
        <Button type="submit" disabled={isSaving} size="sm" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </form>
    );
  }

  return null;
}
