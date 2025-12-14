import withPWA from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour permettre l'upload de gros fichiers (photos de téléphone et PDFs)
  // La limite par défaut est de 1 MB, on l'augmente à 20 MB
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb", // Limite pour les uploads (images et PDFs)
    },
  },
  // Configuration Turbopack vide pour permettre l'utilisation de webpack par next-pwa
  // next-pwa utilise webpack, donc on doit permettre les deux systèmes
  turbopack: {},
  // Note: pdf-parse est utilisé uniquement dans les Server Actions (côté serveur)
  // Pas besoin de configuration webpack/turbopack spéciale
};

const pwaConfig = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  // Désactiver en dev pour éviter les bugs de cache pendant que tu codes
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

export default pwaConfig(nextConfig);
