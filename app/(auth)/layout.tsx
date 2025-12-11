import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion - Numera AI",
  description: "Connectez-vous à votre compte Numera AI",
};

/**
 * Layout pour les pages d'authentification (sign-in, sign-up)
 * 
 * Ce layout n'inclut PAS la sidebar ni le header principal,
 * pour une expérience d'authentification épurée.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
