"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper Client Component pour charger AIChatButton uniquement côté client
 * 
 * Ce composant résout l'erreur d'hydration en empêchant le rendu serveur
 * du bouton de chat flottant qui contient des états et effets côté client.
 */
const AIChatButton = dynamic(
  () => import("@/components/chat/AIChatButton").then((mod) => mod.AIChatButton),
  { 
    ssr: false,
    loading: () => null // Pas de loader pour un bouton flottant
  }
);

export function AIChatButtonWrapper() {
  return <AIChatButton />;
}


