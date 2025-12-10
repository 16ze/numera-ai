"use client";

/**
 * Composant UserNav - Navigation utilisateur en haut à droite
 * Affiche l'avatar de l'utilisateur connecté
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Composant UserNav
 */
export function UserNav() {
  // Pour l'instant, on simule un utilisateur connecté
  const user = {
    name: "Demo User",
    email: "demo@numera.ai",
    initials: "DU",
  };

  return (
    <div className="flex items-center space-x-4">
      <Avatar>
        <AvatarImage src="" alt={user.name} />
        <AvatarFallback>{user.initials}</AvatarFallback>
      </Avatar>
    </div>
  );
}

