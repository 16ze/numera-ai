import { AIChatButtonWrapper } from "@/components/chat/AIChatButtonWrapper";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { UserButtonWrapper } from "@/components/layout/UserButtonWrapper";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { redirect } from "next/navigation";

/**
 * Layout pour les pages protégées (dashboard, transactions, etc.)
 *
 * Ce layout inclut :
 * - Desktop: Sidebar fixe à gauche + Header avec UserButton
 * - Mobile: Header avec logo et menu hamburger (Sheet)
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
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar Desktop - Cachée sur mobile */}
      {/* Sidebar en overlay avec z-index élevé, ne pousse pas le contenu */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Contenu principal - Marge réduite pour sidebar compacte */}
      <div className="flex flex-1 flex-col md:ml-20 w-full transition-all duration-300">
        {/* Header Desktop uniquement - Caché sur mobile */}
        <header className="sticky top-0 z-10 hidden md:flex h-16 items-center border-b bg-white px-6 print:hidden">
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

        {/* Header Mobile avec menu hamburger */}
        <MobileNav />

        {/* Contenu de la page - Responsive */}
        <main className="flex-1 overflow-y-auto w-full">{children}</main>
      </div>

      {/* Bouton de chat flottant (accessible partout) */}
      <AIChatButtonWrapper />
    </div>
  );
}
