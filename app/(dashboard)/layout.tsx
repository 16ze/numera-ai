import { AIChatButtonWrapper } from "@/components/chat/AIChatButtonWrapper";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserButtonWrapper } from "@/components/layout/UserButtonWrapper";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { redirect } from "next/navigation";

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

  // Vérification : si l'utilisateur est connecté mais n'a pas de SIRET configuré
  const company = user.companies[0];
  
  if (company && (!company.siret || company.siret.trim() === "")) {
    // Rediriger vers l'onboarding si l'entreprise n'a pas de SIRET
    // La page /onboarding n'est pas dans ce layout, donc elle sera accessible
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar fixe à gauche */}
      <Sidebar />

      {/* Contenu principal */}
      <div className="flex flex-1 flex-col ml-64">
        {/* Header avec UserButton Clerk */}
        <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-white px-6 print:hidden">
          {/* Spacer pour pousser l'avatar à droite */}
          <div className="flex-1"></div>
          
          {/* Avatar utilisateur aligné à droite */}
          <div className="flex items-center">
            <UserButtonWrapper
              appearance={{
                elements: {
                  avatarBox: "h-10 w-10",
                },
              }}
              afterSignOutUrl="/sign-in"
            />
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Bouton de chat flottant (accessible partout) - Chargé uniquement côté client */}
      <AIChatButtonWrapper />
    </div>
  );
}
