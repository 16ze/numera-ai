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
 */
async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  // Récupérer le pathname depuis les headers (ajouté par le middleware)
  const headersList = await headers();
  
  // Méthode correcte pour accéder aux headers dans Next.js 16
  let pathname = "";
  try {
    const pathnameHeader = headersList.get("x-pathname");
    pathname = pathnameHeader || "";
  } catch (error) {
    // Si les headers ne sont pas disponibles, continuer sans vérification
    // (peut arriver dans certains contextes)
    console.warn("Impossible de récupérer le pathname depuis les headers");
  }

  // Routes publiques qui ne nécessitent pas de vérification d'onboarding
  const publicRoutes = ["/sign-in", "/sign-up"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Si on est sur une route publique ou sur /onboarding, on laisse passer
  if (isPublicRoute || pathname === "/onboarding") {
    return <>{children}</>;
  }

  try {
    // Récupérer l'utilisateur connecté (redirige vers /sign-in si non connecté)
    const user = await getCurrentUser();

    // Vérifier si l'utilisateur a une entreprise avec un SIRET
    const company = user.companies[0];

    if (company && (!company.siret || company.siret.trim() === "")) {
      // Si l'utilisateur n'a pas de SIRET et n'est pas sur /onboarding, rediriger
      redirect("/onboarding");
    }
  } catch (error) {
    // Si getCurrentUser() redirige ou lance une erreur, laisser Next.js gérer
    // (probablement redirection vers /sign-in)
    // Ne pas intercepter les redirections
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error; // Ré-throw les redirections Next.js
    }
    // Pour les autres erreurs, continuer normalement
    // (l'utilisateur n'est peut-être pas connecté, Clerk gérera)
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
