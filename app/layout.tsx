import { frFR } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth-helper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Numera AI - Comptabilité pour entrepreneurs",
  description: "SaaS de comptabilité intelligent pour entrepreneurs",
};

/**
 * Composant wrapper pour vérifier l'onboarding
 * 
 * Ce composant vérifie si l'utilisateur connecté a complété l'onboarding
 * (a un SIRET) et redirige vers /onboarding si nécessaire.
 * 
 * Note: La vérification du pathname est gérée par le middleware et les layouts spécifiques
 * (dashboard layout), cette vérification est une couche de sécurité supplémentaire.
 */
async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  // Essayer de récupérer le pathname depuis les headers (ajouté par le middleware)
  // Dans Next.js 16, headers() retourne une Promise et doit être utilisé avec await
  let pathname = "";
  try {
    const headersList = await headers();
    // Accéder au header x-pathname - headers() retourne un Headers object en Next.js 16
    pathname = headersList.get("x-pathname") || "";
  } catch (error) {
    // Si les headers ne sont pas disponibles, continuer sans vérification du pathname
    // Le middleware et les layouts spécifiques géreront la protection
  }

  // Routes publiques qui ne nécessitent pas de vérification d'onboarding
  const publicRoutes = ["/sign-in", "/sign-up", "/onboarding"];
  const isPublicRoute = pathname ? publicRoutes.some((route) =>
    pathname.startsWith(route)
  ) : false;

  // Si on est sur une route publique, on laisse passer sans vérifier l'utilisateur
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Seulement vérifier l'onboarding si on n'est pas sur une route publique
  try {
    // Récupérer l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    // Vérifier si l'utilisateur a une entreprise avec un SIRET
    const company = user.companies[0];

    if (company && (!company.siret || company.siret.trim() === "")) {
      // Si l'utilisateur n'a pas de SIRET, rediriger vers /onboarding
      redirect("/onboarding");
    }
  } catch (error) {
    // Si getCurrentUser() ou redirect() lance une redirection Next.js, la propager
    // Les redirections Next.js ont une propriété 'digest' avec 'NEXT_REDIRECT'
    if (error && typeof error === "object") {
      const errorObj = error as any;
      if (errorObj.digest && typeof errorObj.digest === "string" && errorObj.digest.includes("NEXT_REDIRECT")) {
        throw error; // Ré-throw les redirections Next.js
      }
    }
    // Pour les autres erreurs, laisser passer
    // Le middleware Clerk gérera les redirections pour les utilisateurs non connectés
  }

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={frFR}
      appearance={{
        // Configuration globale pour tous les composants Clerk
        variables: {
          colorPrimary: "#2563eb",
          colorText: "#1e293b",
          colorTextSecondary: "#64748b",
          colorInputBackground: "#ffffff",
          colorInputText: "#1e293b",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        },
      }}
    >
      <html lang="fr">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}
        >
          <OnboardingGuard>{children}</OnboardingGuard>
        </body>
      </html>
    </ClerkProvider>
  );
}
