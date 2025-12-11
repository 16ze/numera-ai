import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  
  // Si l'utilisateur est connecté et tente d'accéder aux pages auth, rediriger vers /
  if (userId && (request.nextUrl.pathname.startsWith("/sign-in") || request.nextUrl.pathname.startsWith("/sign-up"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  
  // Si la route n'est pas publique, on vérifie l'authentification
  if (!isPublicRoute(request)) {
    // Si l'utilisateur n'est pas connecté, rediriger vers /sign-in
    if (!userId) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", request.url);
      return NextResponse.redirect(signInUrl);
    }
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
