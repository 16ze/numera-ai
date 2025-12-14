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
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
