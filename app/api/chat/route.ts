import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';

// On augmente le temps max pour être large
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    console.log("📩 Message reçu du chat...");
    console.log("📝 Nombre de messages:", messages?.length || 0);

    const result = streamText({
      // On passe à gpt-4o-mini qui est BEAUCOUP plus rapide pour les tests
      // Une fois que ça marche, tu pourras remettre 'gpt-4o'
      model: openai('gpt-4o-mini'), 
      messages,
      system: `Tu es un Assistant CFO expert.
      Règles :
      - Utilise l'outil getStats si on te demande le CA, les recettes ou les dépenses.
      - Réponds toujours en Euros avec le format : 1 200,00 €.
      - Sois concis.
      - Si une erreur survient, dis "J'ai eu un bug technique, réessayez plus tard."`,
      // Note: maxSteps n'est pas disponible directement dans cette version
      // Les tools fonctionnent quand même pour un appel unique
      tools: {
        getStats: tool({
          description: 'Donne le CA (income) et les dépenses (expense) du mois.',
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getStats' déclenché !");
            
            try {
              // 1. Récupérer l'utilisateur
              console.log("🔍 Recherche de l'utilisateur demo@numera.ai...");
              const user = await prisma.user.findUnique({
                where: { email: 'demo@numera.ai' },
                include: { companies: true }
              });

              if (!user || user.companies.length === 0) {
                console.error("❌ Erreur : Utilisateur demo introuvable");
                throw new Error("Utilisateur démo introuvable en base.");
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // 2. Dates du mois
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1);
              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              console.log(`📅 Période : ${start.toLocaleDateString('fr-FR')} - ${end.toLocaleDateString('fr-FR')}`);

              // 3. Requête Prisma
              console.log("🔎 Requête Prisma en cours...");
              const transactions = await prisma.transaction.findMany({
                where: {
                  companyId,
                  date: { gte: start, lte: end }
                }
              });

              console.log(`📊 ${transactions.length} transactions trouvées pour ce mois.`);

              // 4. Calculs
              const revenue = transactions
                .filter(t => t.type === 'INCOME')
                .reduce((acc, t) => acc + Number(t.amount), 0);
                
              const expense = transactions
                .filter(t => t.type === 'EXPENSE')
                .reduce((acc, t) => acc + Number(t.amount), 0);

              console.log(`💰 Résultat calculé : Recettes=${revenue}, Dépenses=${expense}, Net=${revenue - expense}`);

              const result = {
                revenue,
                expense,
                net: revenue - expense,
                month: now.toLocaleString('fr-FR', { month: 'long' })
              };

              console.log("✅ Outil getStats terminé avec succès");
              return result;

            } catch (error) {
              console.error("❌ CRASH DANS L'OUTIL getStats :", error);
              console.error("Stack trace:", error instanceof Error ? error.stack : 'N/A');
              // On lance l'erreur pour que l'IA puisse la gérer
              throw new Error("Une erreur technique est survenue lors du calcul des statistiques.");
            }
          },
        }),
      },
      onError: (error) => {
        console.error("❌ ERREUR DANS streamText :", error);
        console.error("Stack trace:", error instanceof Error ? error.stack : 'N/A');
      },
      onFinish: (result) => {
        console.log("✅ streamText terminé");
        console.log("📈 Finish reason:", result.finishReason);
        console.log("🔧 Tool calls:", result.toolCalls?.length || 0);
      },
    });

    console.log("📤 Envoi de la réponse streamée...");
    return result.toTextStreamResponse();

  } catch (error) {
    console.error("❌ ERREUR GENERALE API :", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : 'N/A');
    return new Response(
      JSON.stringify({ 
        error: 'Erreur serveur',
        message: error instanceof Error ? error.message : 'Erreur inconnue'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
