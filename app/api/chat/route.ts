import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';

// On laisse 30 secondes max pour éviter les timeouts
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    console.log("📩 Message reçu, début du traitement...");

    const result = streamText({
      // On utilise le modèle "mini" pour que ce soit ultra rapide le temps des tests
      model: openai('gpt-4o-mini'),
      messages,
      // Note: maxSteps n'est pas disponible dans cette version de ai
      // Les tools fonctionnent pour un appel unique 
      system: `Tu es le CFO (Directeur Financier) de l'entreprise Numera Corp.
      Tu es précis, professionnel et direct.
      Toutes les sommes sont en Euros (€).
      Utilise l'outil 'getStats' si on te demande le CA, les recettes ou la trésorerie.`,
      
      tools: {
        getStats: tool({
          description: 'Donne le CA (income), les dépenses (expense) et le résultat net du mois en cours.',
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getStats' déclenché par l'IA !");
            
            try {
              // 1. Récupération utilisateur
              // Note : Si tu as une erreur ici, vérifie que le seed a bien créé cet email
              const user = await prisma.user.findUnique({
                where: { email: 'demo@numera.ai' },
                include: { companies: true }
              });

              if (!user || !user.companies[0]) {
                console.error("❌ ERREUR: Utilisateur demo introuvable !");
                throw new Error("Utilisateur introuvable.");
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // 2. Définition des dates (Mois en cours)
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1);
              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              
              console.log(`📅 Analyse du ${start.toLocaleDateString()} au ${end.toLocaleDateString()}`);

              // 3. Requête Base de données
              const transactions = await prisma.transaction.findMany({
                where: {
                  companyId,
                  date: { gte: start, lte: end }
                }
              });

              console.log(`📊 ${transactions.length} transactions trouvées.`);

              // 4. Calculs
              const revenue = transactions
                .filter(t => t.type === 'INCOME')
                .reduce((acc, t) => acc + Number(t.amount), 0);
                
              const expense = transactions
                .filter(t => t.type === 'EXPENSE')
                .reduce((acc, t) => acc + Number(t.amount), 0);

              const net = revenue - expense;

              console.log(`💰 Succès : Recettes=${revenue} | Dépenses=${expense}`);

              return {
                revenue,
                expense,
                net,
                message: `Analyse terminée pour ${now.toLocaleString('fr-FR', { month: 'long' })}.`
              };

            } catch (err) {
              console.error("❌ CRASH dans execute :", err);
              console.error("Stack trace:", err instanceof Error ? err.stack : 'N/A');
              throw new Error("Erreur technique lors du calcul.");
            }
          },
        }),
      },
    });

    // On renvoie le stream au format texte (standard Vercel AI)
    console.log("📤 Envoi de la réponse streamée...");
    return result.toTextStreamResponse();

  } catch (error) {
    console.error("❌ ERREUR GENERALE API :", error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), { status: 500 });
  }
}
