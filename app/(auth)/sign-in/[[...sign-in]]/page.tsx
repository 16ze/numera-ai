import { SignIn } from "@clerk/nextjs";

/**
 * Page de connexion Clerk
 *
 * Cette page affiche le composant SignIn de Clerk avec une interface personnalisée.
 * Elle est accessible via /sign-in et gère automatiquement :
 * - Connexion par email/mot de passe
 * - OAuth (Google, GitHub, etc.)
 * - Vérification d'email
 * - Récupération de mot de passe
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      {/* Partie gauche - Image/Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        {/* Pattern de fond décoratif */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Contenu */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl font-bold text-primary">
              N
            </div>
            <span className="text-2xl font-bold text-white">Numera AI</span>
          </div>
        </div>

        {/* Contenu central */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white mb-4">
              Gérez votre comptabilité en toute simplicité
            </h2>
            <p className="text-xl text-white/90">
              Une solution complète pour les entrepreneurs modernes
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">
                  Tableau de bord intuitif
                </h3>
                <p className="text-white/80">
                  Visualisez vos finances en un coup d&apos;œil
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">
                  Assistant CFO IA
                </h3>
                <p className="text-white/80">
                  Obtenez des réponses instantanées sur vos finances
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">
                  Automatisation intelligente
                </h3>
                <p className="text-white/80">
                  Gagnez du temps avec nos outils automatisés
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-white/60 text-sm">
          © 2024 Numera AI. Tous droits réservés.
        </div>
      </div>

      {/* Partie droite - Formulaire */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-2xl font-bold text-primary-foreground">
              N
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Numera AI</h1>
          </div>

          {/* Titre */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Connexion
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Accédez à votre espace comptable
            </p>
          </div>

          {/* Composant Clerk SignIn */}
          <div className="rounded-2xl bg-white p-1 shadow-2xl">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border-0 bg-transparent",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "border-2 border-slate-200 hover:border-primary hover:bg-slate-50 transition-all duration-200 font-medium",
                  formButtonPrimary:
                    "bg-primary hover:bg-primary/90 transition-all duration-200 font-semibold shadow-md hover:shadow-lg",
                  footerActionLink:
                    "text-primary hover:text-primary/80 font-medium transition-colors",
                  formFieldInput:
                    "border-2 border-slate-200 focus:border-primary transition-all duration-200",
                  formFieldLabel: "font-medium text-slate-700",
                  dividerLine: "bg-slate-200",
                  dividerText: "text-slate-500 font-medium",
                  identityPreviewText: "font-medium",
                  formHeaderTitle: "text-xl font-bold text-slate-900",
                  formHeaderSubtitle: "text-slate-600",
                },
              }}
            />
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-slate-500">
            <p>
              En vous connectant, vous acceptez nos Conditions
              d&apos;utilisation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
