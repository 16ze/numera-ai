import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

/**
 * Page d'inscription Clerk avec image en arrière-plan
 *
 * Cette page affiche le composant SignUp de Clerk avec une interface personnalisée
 * et une image professionnelle en arrière-plan pour améliorer l'expérience utilisateur.
 */
export default function SignUpPage() {
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
                Rejoignez des milliers
                <br />
                d&apos;entrepreneurs
              </h2>
              <p className="text-xl text-white/95 drop-shadow-md">
                Simplifiez votre comptabilité dès aujourd&apos;hui
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
                    Gratuit pour commencer
                  </h3>
                  <p className="text-white/90 drop-shadow-sm">
                    Aucune carte bancaire requise
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg drop-shadow-md mb-1">
                    Configuration en 2 minutes
                  </h3>
                  <p className="text-white/90 drop-shadow-sm">
                    Commencez immédiatement après l&apos;inscription
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
                    Support dédié
                  </h3>
                  <p className="text-white/90 drop-shadow-sm">
                    Notre équipe est là pour vous aider
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
                  "border border-slate-200 hover:bg-slate-50 hover:border-blue-600 text-slate-600 font-medium h-10 transition-all duration-200",
                formButtonPrimary:
                  "bg-blue-600 hover:bg-blue-700 text-sm normal-case shadow-md hover:shadow-lg transition-all duration-200",
                footerActionLink:
                  "text-blue-600 hover:text-blue-700 font-medium transition-colors",
                formFieldInput:
                  "border-slate-200 focus:border-blue-600 focus:ring-blue-600 transition-all duration-200",
                formFieldLabel: "text-slate-700 font-medium",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
