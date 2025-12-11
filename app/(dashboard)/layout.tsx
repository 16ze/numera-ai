import { AIChatButtonWrapper } from "@/components/chat/AIChatButtonWrapper";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserButtonWrapper } from "@/components/layout/UserButtonWrapper";

/**
 * Layout pour les pages protégées (dashboard, transactions, etc.)
 *
 * Ce layout inclut la sidebar et le header avec le bouton utilisateur Clerk.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Sidebar fixe à gauche */}
      <Sidebar />

      {/* Contenu principal */}
      <div className="flex flex-1 flex-col ml-64">
        {/* Header avec UserButton Clerk */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b bg-white px-6">
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
