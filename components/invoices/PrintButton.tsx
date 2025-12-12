'use client';

/**
 * Bouton d'impression pour les factures
 * Composant client car il utilise window.print()
 */

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

/**
 * Composant bouton pour imprimer/générer un PDF de la facture
 * Caché automatiquement lors de l'impression grâce à la classe print:hidden
 */
export function PrintButton() {
  return (
    <Button 
      onClick={() => window.print()} 
      variant="outline"
      className="gap-2 print:hidden"
    >
      <Printer className="h-4 w-4" />
      Imprimer / PDF
    </Button>
  );
}


