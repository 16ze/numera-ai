import Link from "next/link";
import Image from "next/image";

/**
 * Layout pour les pages légales
 * Design simple et centré avec header et footer
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header simple */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <Link href="/" className="flex items-center space-x-3">
            <img
              src="/logo.png"
              alt="Numera AI"
              className="h-10 w-auto object-contain"
            />
            <span className="text-xl font-bold text-slate-900">Numera AI</span>
          </Link>
        </div>
      </header>

      {/* Contenu principal centré */}
      <main className="flex-1 container mx-auto px-6 py-12 max-w-4xl">
        {children}
      </main>

      {/* Footer simple */}
      <footer className="border-t bg-white mt-auto">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-600">
              © 2024 Numera AI. Tous droits réservés.
            </p>
            <nav className="flex gap-6 text-sm">
              <Link
                href="/legal/privacy"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Politique de Confidentialité
              </Link>
              <Link
                href="/legal/data-retention"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Conservation des Données
              </Link>
              <Link
                href="/"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                Accueil
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

