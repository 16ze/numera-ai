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
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        {/* Logo et titre */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground">
            N
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Numera AI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Créez votre compte gratuitement
          </p>
        </div>

        {/* Composant Clerk SignUp */}
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-xl border",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "border hover:bg-accent",
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              footerActionLink: "text-primary hover:text-primary/90",
            },
          }}
        />
      </div>
    </div>
  );
}

