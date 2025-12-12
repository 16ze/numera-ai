"use client";

/**
 * Composant client pour gérer la redirection vers l'onboarding
 * Utilisé uniquement comme solution de secours si le layout ne fonctionne pas
 */

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface OnboardingRedirectProps {
  shouldRedirect: boolean;
}

export function OnboardingRedirect({ shouldRedirect }: OnboardingRedirectProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (shouldRedirect && !pathname.startsWith("/onboarding")) {
      router.push("/onboarding");
    }
  }, [shouldRedirect, pathname, router]);

  return null;
}

