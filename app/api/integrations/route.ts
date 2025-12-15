import { getIntegrations } from "@/app/actions/integrations";
import { NextResponse } from "next/server";

/**
 * Route API pour récupérer les intégrations de l'utilisateur
 * Utilisée par le composant client pour recharger les données
 */
export async function GET() {
  try {
    const integrations = await getIntegrations();
    return NextResponse.json(integrations);
  } catch (error) {
    console.error("Erreur lors de la récupération des intégrations:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des intégrations" },
      { status: 500 }
    );
  }
}
