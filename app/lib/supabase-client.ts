/**
 * Client Supabase pour le stockage de fichiers (logos, etc.)
 * 
 * Variables d'environnement requises :
 * - NEXT_PUBLIC_SUPABASE_URL : URL de votre projet Supabase
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY : Clé anonyme publique (pour le client)
 * - SUPABASE_SERVICE_ROLE_KEY : Clé service role (pour les Server Actions, NE PAS EXPOSER AU CLIENT)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables d'environnement Supabase manquantes. Veuillez configurer NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans votre fichier .env.local"
  );
}

/**
 * Client Supabase pour le stockage de fichiers (côté client)
 * Utilise les clés publiques (NEXT_PUBLIC_*) pour être accessible côté client
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Client Supabase avec service role key (côté serveur uniquement)
 * Bypasse les politiques RLS - À UTILISER UNIQUEMENT DANS LES SERVER ACTIONS
 * 
 * ⚠️ IMPORTANT : Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY au client !
 */
export function getSupabaseServerClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante. Cette clé est requise pour les uploads côté serveur. " +
      "Trouvez-la dans Supabase Dashboard > Settings > API > service_role key"
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

