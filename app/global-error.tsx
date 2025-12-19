"use client";

/**
 * Composant d'erreur global pour l'application
 * Gère les erreurs critiques qui ne peuvent pas être récupérées
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log l'erreur critique pour le debugging
    console.error("❌ Erreur critique globale:", error);
  }, [error]);

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Erreur - Numera AI</title>
      </head>
      <body className="antialiased bg-slate-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-red-100 w-fit">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                Erreur critique
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 text-center">
                Une erreur critique s'est produite. Veuillez recharger la page
                ou contacter le support si le problème persiste.
              </p>

              {process.env.NODE_ENV === "development" && (
                <div className="bg-slate-100 p-3 rounded-lg">
                  <p className="text-xs font-mono text-slate-700 break-all">
                    {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-slate-500 mt-1">
                      ID: {error.digest}
                    </p>
                  )}
                </div>
              )}

              <Button onClick={reset} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Réessayer
              </Button>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
