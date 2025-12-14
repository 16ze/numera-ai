import { getDashboardData } from "@/app/(dashboard)/actions/dashboard";
import { NextResponse } from "next/server";

/**
 * Route API pour récupérer les données du Dashboard
 * Permet la mise à jour dynamique sans rechargement de page
 * 
 * Note: L'authentification est gérée par getDashboardData() via getCurrentUser()
 */
export async function GET() {
  try {
    const data = await getDashboardData();
    
    // Headers pour éviter le cache côté client
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des données du dashboard:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données" },
      { status: 500 }
    );
  }
}
