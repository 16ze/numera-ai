import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion - Numera AI",
  description: "Connectez-vous à votre compte Numera AI",
};

/**
 * Layout pour les pages d'authentification (sign-in, sign-up)
 * 
 * Ce layout n'inclut PAS la sidebar ni le header principal,
 * pour une expérience d'authentification épurée et centrée.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {children}
    </div>
  );
}

