import { AIChatButtonWrapper } from "@/components/chat/AIChatButtonWrapper";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserButtonWrapper } from "@/components/layout/UserButtonWrapper";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

/**
 * Layout pour les pages protégées (dashboard, transactions, etc.)
 *
 * Ce layout inclut la sidebar et le header avec le bouton utilisateur Clerk.
 * Force les utilisateurs sans SIRET à compléter l'onboarding.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Récupération de l'utilisateur connecté (redirige vers /sign-in si non connecté)
  const user = await getCurrentUser();

  // Récupération de l'URL actuelle
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  // Vérification : si l'utilisateur est connecté mais n'a pas de SIRET configuré
  const company = user.companies[0];
  
  if (company && (!company.siret || company.siret.trim() === "")) {
    // Si on n'est pas déjà sur la page d'onboarding, rediriger
    if (!pathname.startsWith("/onboarding")) {
      redirect("/onboarding");
    }
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar fixe à gauche */}
      <Sidebar />

      {/* Contenu principal */}
      <div className="flex flex-1 flex-col ml-64">
        {/* Header avec UserButton Clerk */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b bg-white px-6 print:hidden">
          <UserButtonWrapper
            appearance={{
              elements: {
                avatarBox: "h-10 w-10",
              },
            }}
            afterSignOutUrl="/sign-in"
          />
        </header>

        {/* Contenu de la page */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Bouton de chat flottant (accessible partout) - Chargé uniquement côté client */}
      <AIChatButtonWrapper />
    </div>
  );
}
