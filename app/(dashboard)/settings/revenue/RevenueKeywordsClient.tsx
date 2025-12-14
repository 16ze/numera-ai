"use client";

/**
 * Composant client pour gérer les mots-clés de revenus
 * Permet d'ajouter/supprimer des tags (mots-clés)
 */

import { updateRevenueKeywords } from "@/app/actions/company";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface RevenueKeywordsClientProps {
  initialKeywords: string[];
}

export function RevenueKeywordsClient({
  initialKeywords,
}: RevenueKeywordsClientProps) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Ajoute un nouveau mot-clé
   */
  const handleAddKeyword = () => {
    const trimmed = inputValue.trim().toUpperCase();

    if (trimmed.length === 0) {
      toast.error("Le mot-clé ne peut pas être vide");
      return;
    }

    if (keywords.includes(trimmed)) {
      toast.error("Ce mot-clé existe déjà");
      setInputValue("");
      return;
    }

    setKeywords([...keywords, trimmed]);
    setInputValue("");
  };

  /**
   * Supprime un mot-clé
   */
  const handleRemoveKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter((k) => k !== keywordToRemove));
  };

  /**
   * Sauvegarde les mots-clés
   */
  const handleSave = async () => {
    try {
      setIsSaving(true);

      await updateRevenueKeywords(keywords);

      toast.success(
        `Mots-clés sauvegardés (${keywords.length} mot${keywords.length > 1 ? "s" : ""}-clé${keywords.length > 1 ? "s" : ""})`
      );
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la sauvegarde des mots-clés"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Gère la touche Entrée dans l'input
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  return (
    <div className="space-y-4">
      {/* Input pour ajouter un mot-clé */}
      <div className="flex gap-2">
        <Input
          placeholder="Ajouter un mot-clé (ex: STRIPE, VRST, VIR)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleAddKeyword}
          variant="outline"
          size="icon"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Liste des mots-clés */}
      {keywords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="px-3 py-1.5 text-sm flex items-center gap-2"
            >
              {keyword}
              <button
                type="button"
                onClick={() => handleRemoveKeyword(keyword)}
                className="ml-1 hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                aria-label={`Supprimer ${keyword}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Aucun mot-clé défini. Toutes les transactions INCOME seront comptées
          comme CA.
        </p>
      )}

      {/* Bouton de sauvegarde */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="min-w-[120px]"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
