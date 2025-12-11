import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Middleware Clerk pour Next.js
 *
 * Ce middleware protège automatiquement toutes les routes de l'application.
 * Les routes publiques sont définies dans la configuration publicRoutes ci-dessous.
 *
 * Routes publiques :
 * - Pages d'authentification (/sign-in, /sign-up)
 * - API publiques (webhooks)
 */

// On définit les routes publiques (Login, Register)
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, request) => {
  // Si la route n'est pas publique, on protège
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Ignore les fichiers statiques (_next, images, etc.)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Protège toujours l'API et la racine
    '/(api|trpc)(.*)',
  ],
};
