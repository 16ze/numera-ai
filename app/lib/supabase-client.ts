/**
 * Client Supabase pour le stockage de fichiers (logos, etc.)
 * 
 * Variables d'environnement requises :
 * - NEXT_PUBLIC_SUPABASE_URL : URL de votre projet Supabase
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY : Clé anonyme publique de votre projet Supabase
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables d'environnement Supabase manquantes. Veuillez configurer NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans votre fichier .env.local"
  );
}

/**
 * Client Supabase pour le stockage de fichiers
 * Utilise les clés publiques (NEXT_PUBLIC_*) pour être accessible côté client et serveur
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

