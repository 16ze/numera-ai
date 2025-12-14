import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// On définit les routes qui ne nécessitent pas d'être connecté
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Si on n'est pas sur une page publique, on protège
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Ajouter le pathname aux headers pour le layout
  const response = NextResponse.next();
  response.headers.set("x-pathname", req.nextUrl.pathname);
  return response;
});

export const config = {
  matcher: [
    // La regex magique qui laisse passer les fichiers PWA et statiques
    // Exclut : _next, fichiers statiques (images, CSS, JS sauf JSON), et fichiers PWA (sw.js, workbox-*.js, webmanifest)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // EXCLUSION EXPLICITE DES FICHIERS PWA :
    "/(api|trpc)(.*)",
  ],
};
