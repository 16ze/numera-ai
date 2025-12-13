/**
 * Configuration du client Plaid pour la connexion bancaire
 * 
 * Variables d'environnement requises :
 * - PLAID_CLIENT_ID : Client ID Plaid (Dashboard Plaid)
 * - PLAID_SECRET : Secret Plaid (Sandbox/Development/Production)
 * - PLAID_ENV : Environnement (sandbox, development, production)
 * - NEXT_PUBLIC_APP_URL : URL de l'application pour les redirections
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Validation des variables d'environnement
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  throw new Error(
    "Variables d'environnement Plaid manquantes. Configurez PLAID_CLIENT_ID et PLAID_SECRET dans .env.local"
  );
}

// Mapping de l'environnement
const plaidEnvironment =
  PLAID_ENV === "production"
    ? PlaidEnvironments.production
    : PLAID_ENV === "development"
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox;

// Configuration Plaid
const configuration = new Configuration({
  basePath: plaidEnvironment,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

/**
 * Client Plaid configuré
 * Utilisé dans les Server Actions pour interagir avec l'API Plaid
 */
export const plaidClient = new PlaidApi(configuration);

/**
 * URL de base de l'application (pour les redirections Plaid)
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

