"use client";

/**
 * Page d'erreur affichée quand Plaid n'est pas configuré
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";

export function PlaidNotConfigured() {
  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Alerte principale */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-orange-900">
                  Configuration Plaid Requise
                </CardTitle>
                <CardDescription className="text-orange-700">
                  Les variables d&apos;environnement Plaid ne sont pas configurées
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-800 mb-4">
              Pour utiliser la connexion bancaire, vous devez configurer un compte Plaid (gratuit en mode Sandbox).
            </p>
          </CardContent>
        </Card>

        {/* Guide rapide */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>🚀 Configuration Rapide (5 minutes)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-slate-900">Créer un compte Plaid (Gratuit)</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Rendez-vous sur{" "}
                    <a
                      href="https://dashboard.plaid.com/signup"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      dashboard.plaid.com/signup
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-slate-900">Obtenir vos clés API</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Dans le dashboard : <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">Team Settings → Keys</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Copiez votre <strong>client_id</strong> et <strong>sandbox secret</strong>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-slate-900">Ajouter dans .env.local</p>
                  <div className="mt-2 bg-slate-900 text-slate-100 p-3 rounded-md text-xs font-mono overflow-x-auto">
                    <div># Plaid Configuration</div>
                    <div>PLAID_CLIENT_ID=your_client_id_here</div>
                    <div>PLAID_SECRET=your_sandbox_secret_here</div>
                    <div>PLAID_ENV=sandbox</div>
                    <div className="mt-2"># URL de votre application</div>
                    <div>NEXT_PUBLIC_APP_URL=http://localhost:3000</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  4
                </div>
                <div>
                  <p className="font-medium text-slate-900">Redémarrer le serveur</p>
                  <div className="mt-1 bg-slate-900 text-slate-100 p-2 rounded-md text-xs font-mono">
                    npm run dev
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button asChild variant="default" className="gap-2">
                <a
                  href="https://dashboard.plaid.com/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Créer un compte Plaid
                </a>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/settings">
                  Retour aux paramètres
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documentation */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-900 font-medium mb-1">
                  Documentation complète disponible
                </p>
                <p className="text-sm text-blue-700">
                  Consultez <span className="font-mono">PLAID_QUICKSTART.md</span> et{" "}
                  <span className="font-mono">PLAID_SETUP.md</span> à la racine du projet pour plus d&apos;informations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identifiants de test */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">🧪 Identifiants de test (Sandbox)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-3">
              Une fois configuré, utilisez ces identifiants pour tester :
            </p>
            <div className="bg-slate-50 p-3 rounded-md space-y-1 text-sm">
              <div>
                <span className="text-slate-600">Institution :</span>{" "}
                <span className="font-medium">Platypus</span>
              </div>
              <div>
                <span className="text-slate-600">Username :</span>{" "}
                <span className="font-mono font-medium">user_good</span>
              </div>
              <div>
                <span className="text-slate-600">Password :</span>{" "}
                <span className="font-mono font-medium">pass_good</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

