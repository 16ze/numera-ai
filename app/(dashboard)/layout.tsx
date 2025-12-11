import { AIChatButton } from "@/components/chat/AIChatButton";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserNav } from "@/components/layout/UserNav";

/**
 * Layout pour les pages protégées (dashboard, transactions, etc.)
 *
 * Ce layout inclut la sidebar et le header avec UserNav.
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
        {/* Header avec UserNav */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b bg-white px-6">
          <UserNav />
        </header>

        {/* Contenu de la page */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Bouton de chat flottant (accessible partout) */}
      <AIChatButton />
    </div>
  );
}
