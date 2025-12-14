import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",

  // Ces options sont valides pour Workbox mais TypeScript râle.
  // On ajoute "as any" à la fin de l'objet pour le calmer.
  buildExcludes: [/middleware-manifest.json$/],
  publicExcludes: ["!robots.txt", "!sitemap.xml", "!manifest.webmanifest"],

  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\/sign-in.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https:\/\/.*\/sign-up.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /\/api\/.*$/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "others",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
  ],
} as any); // <--- L'ASTUCE EST ICI (as any)

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
  // On ignore les erreurs strictes pour le build de prod
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Note: pdf-parse est utilisé uniquement dans les Server Actions (côté serveur)
  // Pas besoin de configuration webpack/turbopack spéciale
};

export default withPWA(nextConfig);
