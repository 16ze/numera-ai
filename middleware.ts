import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Middleware Clerk pour Next.js - Configuration Officielle
 *
 * Ce middleware protège automatiquement toutes les routes de l'application
 * SAUF les routes publiques définies ci-dessous.
 *
 * IMPORTANT : Le matcher est configuré pour NE PAS bloquer les appels internes de Clerk
 */

// Routes publiques (accessibles sans authentification)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)", // Pour les webhooks Clerk si vous en avez
]);

export default clerkMiddleware(async (auth, request) => {
  // Protection automatique des routes privées
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    /*
     * Matcher officiel Clerk - NE PAS MODIFIER
     * 
     * Ce matcher :
     * - Exclut les fichiers statiques Next.js (_next)
     * - Exclut les images et assets (jpg, png, svg, etc.)
     * - Exclut les fichiers système (favicon, robots.txt, etc.)
     * - INCLUT toutes les routes API
     * - N'INTERFÈRE PAS avec les appels internes de Clerk
     */
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
