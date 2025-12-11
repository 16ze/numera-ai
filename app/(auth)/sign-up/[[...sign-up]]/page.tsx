import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      {/* Partie gauche - Image/Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 p-12 flex-col justify-between relative overflow-hidden">
        {/* Pattern de fond décoratif */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Contenu */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl font-bold text-blue-600">
              N
            </div>
            <span className="text-2xl font-bold text-white">Numera AI</span>
          </div>
        </div>

        {/* Contenu central */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white mb-4">
              Rejoignez des milliers d&apos;entrepreneurs
            </h2>
            <p className="text-xl text-white/90">
              Simplifiez votre comptabilité dès aujourd&apos;hui
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
                  Gratuit pour commencer
                </h3>
                <p className="text-white/80">Aucune carte bancaire requise</p>
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
                  Configuration en 2 minutes
                </h3>
                <p className="text-white/80">
                  Commencez immédiatement après l&apos;inscription
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">
                  Support dédié
                </h3>
                <p className="text-white/80">
                  Notre équipe est là pour vous aider
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl font-bold text-white">
              N
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Numera AI</h1>
          </div>

          {/* Titre */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Créer un compte
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Commencez gratuitement dès maintenant
            </p>
          </div>

          {/* Composant Clerk SignUp avec Styling + Routing correct */}
          <SignUp
            // 🚨 CES LIGNES SONT OBLIGATOIRES POUR QUE ÇA MARCHE
            routing="path"
            path="/sign-up"
            forceRedirectUrl="/"
            signInUrl="/sign-in"
            // 🎨 TON DESIGN
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 bg-transparent p-0",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium h-10",
                formButtonPrimary:
                  "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
                footerActionLink: "text-blue-600 hover:text-blue-700",
                formFieldInput:
                  "border-slate-200 focus:border-blue-600 focus:ring-blue-600",
                formFieldLabel: "text-slate-700 font-medium",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
