"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper Client Component pour charger UserButton uniquement côté client
 * 
 * Ce composant résout l'erreur d'hydration en empêchant le rendu serveur
 * du UserButton de Clerk qui nécessite le contexte client pour fonctionner.
 */
const UserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { 
    ssr: false,
    loading: () => (
      // Placeholder pendant le chargement (même taille que le UserButton)
      <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" />
    )
  }
);

/**
 * Props du UserButtonWrapper
 */
interface UserButtonWrapperProps {
  appearance?: {
    elements?: {
      avatarBox?: string;
      userButtonTrigger?: string;
    };
  };
  afterSignOutUrl?: string;
  showName?: boolean;
}

/**
 * Wrapper pour UserButton de Clerk
 * 
 * @param props - Props passées au UserButton
 */
export function UserButtonWrapper({
  appearance,
  afterSignOutUrl = "/sign-in",
  showName = false,
}: UserButtonWrapperProps) {
  return (
    <UserButton
      appearance={appearance}
      afterSignOutUrl={afterSignOutUrl}
      showName={showName}
    />
  );
}

