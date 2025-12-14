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
  disable: process.env.NODE_ENV === "development",
  // 1. Désactiver le cache pour la connexion (CRUCIAL - évite les boucles infinies)
  buildExcludes: [/middleware-manifest.json$/],
  publicExcludes: ["!robots.txt", "!sitemap.xml", "!manifest.webmanifest"],
  // 2. Ne pas mettre en cache les routes d'API ou d'Auth
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/sign-in.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https?:\/\/.*\/sign-up.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /\/api\/.*$/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /.*/i,
      handler: "NetworkFirst", // Pour le reste, on essaie le réseau d'abord
      options: {
        cacheName: "others",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
});

export default pwaConfig(nextConfig);
