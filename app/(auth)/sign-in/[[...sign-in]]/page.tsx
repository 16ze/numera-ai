import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

/**
 * Page de connexion Clerk avec image en arrière-plan
 *
 * Cette page affiche le composant SignIn de Clerk avec une interface personnalisée
 * et une image professionnelle en arrière-plan pour améliorer l'expérience utilisateur.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      {/* Partie gauche - Image en arrière-plan avec overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Image en arrière-plan */}
        <div className="absolute inset-0">
          <Image
            src="/images/auth-background.jpg"
            alt="Espace de travail comptable professionnel"
            fill
            className="object-cover"
            priority
            quality={90}
          />
        </div>

        {/* Overlay sombre pour améliorer la lisibilité */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-800/75 to-slate-900/80"></div>

        {/* Overlay avec effet de brillance subtil */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent"></div>

        {/* Contenu */}
        <div className="relative z-10 flex flex-col justify-between p-12 h-full">
          {/* Logo en haut */}
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm text-2xl font-bold text-blue-600 shadow-lg">
              N
            </div>
            <span className="text-2xl font-bold text-white drop-shadow-lg">
              Numera AI
            </span>
          </div>

          {/* Contenu central */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-lg leading-tight">
                Gérez votre comptabilité
                <br />
                en toute simplicité
              </h2>
              <p className="text-xl text-white/95 drop-shadow-md">
                Une solution complète pour les entrepreneurs modernes
              </p>
            </div>

            {/* Features */}
            <div className="space-y-5">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mt-0.5 ring-2 ring-white/30">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg drop-shadow-md mb-1">
                    Tableau de bord intuitif
                  </h3>
                  <p className="text-white/90 drop-shadow-sm">
                    Visualisez vos finances en un coup d&apos;œil
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mt-0.5 ring-2 ring-white/30">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg drop-shadow-md mb-1">
                    Assistant CFO IA
                  </h3>
                  <p className="text-white/90 drop-shadow-sm">
                    Obtenez des réponses instantanées sur vos finances
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-white/70 text-sm drop-shadow-sm">
            © 2024 Numera AI. Tous droits réservés.
          </div>
        </div>
      </div>

      {/* Partie droite - Formulaire */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl font-bold text-white shadow-lg">
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

          {/* Composant Clerk SignIn avec Styling + Routing correct */}
          <SignIn
            // 🚨 CES LIGNES SONT OBLIGATOIRES POUR QUE ÇA MARCHE
            routing="path"
            path="/sign-in"
            forceRedirectUrl="/"
            signUpUrl="/sign-up"
            // 🎨 DESIGN AMÉLIORÉ
            appearance={{
              elements: {
                // Container principal
                rootBox: "w-full",
                card: "shadow-none border-0 bg-transparent p-0",

                // En-tête (caché car on a notre propre titre)
                headerTitle: "hidden",
                headerSubtitle: "hidden",

                // Bouton social (Google)
                socialButtonsBlockButton:
                  "w-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 font-semibold h-12 rounded-lg transition-all duration-300 ease-in-out shadow-sm hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-3",

                // Séparateur "ou"
                dividerLine: "bg-slate-200",
                dividerText: "text-slate-500 text-sm font-medium",

                // Champs de formulaire
                formFieldInput:
                  "w-full h-12 px-4 border-2 border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 shadow-sm hover:border-slate-300",

                // Labels
                formFieldLabel:
                  "text-slate-700 font-semibold text-sm mb-2 block",

                // Bouton principal (Connexion)
                formButtonPrimary:
                  "w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 normal-case text-base",

                // Bouton secondaire (Mot de passe oublié, etc.)
                formButtonSecondary:
                  "text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200",

                // Lien footer (S'inscrire)
                footerActionLink:
                  "text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200 underline decoration-2 underline-offset-2 hover:decoration-blue-700",

                // Footer
                footer: "mt-6 text-center text-sm text-slate-500",

                // Messages d'erreur
                formFieldErrorText: "text-red-600 text-sm font-medium mt-1",
                alertText: "text-red-600 text-sm font-medium",

                // Clue (Dernière utilisation, etc.)
                formFieldHintText: "text-slate-500 text-xs mt-1",
                identityPreviewText: "text-slate-600 font-medium",
                identityPreviewEditButton: "text-blue-600 hover:text-blue-700",

                // Checkbox (Se souvenir de moi)
                formFieldCheckbox:
                  "border-slate-300 text-blue-600 focus:ring-blue-500 rounded",

                // Divider
                dividerRow: "my-6",
              },
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
          />
        </div>
      </div>
    </div>
  );
}
