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
  try {
    // Essayer de récupérer le pathname depuis les headers (ajouté par le middleware)
    let pathname = "";
    try {
      const headersList = headers();
      // Dans Next.js 16, headers() peut être synchrone ou asynchrone selon le contexte
      const pathnameHeader = typeof headersList.get === "function" 
        ? headersList.get("x-pathname") 
        : null;
      pathname = pathnameHeader || "";
    } catch (error) {
      // Si les headers ne sont pas disponibles, continuer sans vérification du pathname
      // Le middleware et les layouts spécifiques géreront la protection
    }

    // Routes publiques qui ne nécessitent pas de vérification d'onboarding
    const publicRoutes = ["/sign-in", "/sign-up", "/onboarding"];
    const isPublicRoute = publicRoutes.some((route) =>
      pathname.startsWith(route)
    );

    // Si on est sur une route publique, on laisse passer
    if (isPublicRoute) {
      return <>{children}</>;
    }

    // Récupérer l'utilisateur connecté (redirige vers /sign-in si non connecté)
    // Cette fonction gère déjà les redirections, donc on ne l'appelle que si nécessaire
    const user = await getCurrentUser();

    // Vérifier si l'utilisateur a une entreprise avec un SIRET
    const company = user.companies[0];

    if (company && (!company.siret || company.siret.trim() === "")) {
      // Si l'utilisateur n'a pas de SIRET, rediriger vers /onboarding
      redirect("/onboarding");
    }
  } catch (error) {
    // Si getCurrentUser() ou redirect() lance une redirection Next.js, la propager
    if (error && typeof error === "object" && "digest" in error) {
      // C'est une redirection Next.js, la propager
      throw error;
    }
    // Pour les autres erreurs (utilisateur non connecté, etc.), laisser passer
    // Clerk et le middleware géreront les redirections appropriées
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
