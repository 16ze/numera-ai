"use client";

import { Button } from "@/components/ui/button";

/**
 * Composant client pour le bouton d'impression
 * Séparé en composant client car il utilise window.print()
 */
export function PrintButton() {
  return (
    <Button
      onClick={() => window.print()}
      className="print:hidden"
      variant="outline"
    >
      🖨️ Imprimer / PDF
    </Button>
  );
}

