import { SignUp } from "@clerk/nextjs";

/**
 * Page d'inscription Clerk
 * 
 * Cette page affiche le composant SignUp de Clerk avec une interface personnalisée.
 * Elle est accessible via /sign-up et gère automatiquement :
 * - Création de compte par email/mot de passe
 * - OAuth (Google, GitHub, etc.)
 * - Vérification d'email
 * - Validation du mot de passe
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo et titre */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-3xl font-bold text-primary-foreground shadow-lg">
            N
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Commencez avec Numera AI
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Créez votre compte gratuitement en quelques secondes
          </p>
        </div>

        {/* Composant Clerk SignUp */}
        <div className="rounded-2xl bg-white p-1 shadow-2xl">
          <SignUp
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
            En créant un compte, vous acceptez nos{" "}
            <a href="#" className="text-primary hover:underline">
              Conditions d&apos;utilisation
            </a>{" "}
            et notre{" "}
            <a href="#" className="text-primary hover:underline">
              Politique de confidentialité
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

