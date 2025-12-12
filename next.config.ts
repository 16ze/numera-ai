import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour permettre l'upload de gros fichiers (photos de téléphone)
  // La limite par défaut est de 1 MB, on l'augmente à 20 MB pour les photos
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb", // Limite pour les uploads d'images (photos de téléphone)
    },
  },
};

export default nextConfig;
