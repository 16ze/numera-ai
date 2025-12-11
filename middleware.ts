import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Middleware Clerk pour Next.js
 * 
 * Ce middleware protège automatiquement toutes les routes de l'application,
 * sauf celles définies comme publiques ci-dessous.
 * 
 * Routes publiques :
 * - Pages d'authentification (/sign-in, /sign-up)
 * - Assets statiques (/_next/static, /_next/image)
 * - Favicons et fichiers publics
 * - API publiques si nécessaire
 */

// Définition des routes publiques (non protégées)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)", // Pour les webhooks Clerk si vous en avez
]);

export default clerkMiddleware((auth, request) => {
  // Si la route n'est pas publique, on protège avec Clerk
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

