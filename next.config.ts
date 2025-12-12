import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour permettre l'upload de gros fichiers (photos de téléphone)
  // Les Server Actions acceptent jusqu'à 50 MB par défaut, mais on peut augmenter
  // si nécessaire en utilisant l'API Route à la place
  // Pour les Server Actions avec FormData, la limite est gérée côté serveur
};

export default nextConfig;
