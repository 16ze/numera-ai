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

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

