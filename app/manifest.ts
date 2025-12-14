import type { MetadataRoute } from "next";

/**
 * Manifest PWA pour Numera AI
 * Définit l'identité de l'application Progressive Web App
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Numera AI - Assistant Comptable",
    short_name: "Numera AI",
    description:
      "Gérez votre comptabilité, vos factures et vos dépenses avec l'IA.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff", // Couleur de fond du splash screen (écran de démarrage)
    theme_color: "#000000", // Couleur de la barre de statut
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable", // Permet au navigateur de générer le splash screen
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable", // Permet au navigateur de générer le splash screen
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any", // Pour iOS
      },
    ],
  };
}
