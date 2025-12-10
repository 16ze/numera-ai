import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';

// On configure le temps max d'exécution à 30s (par défaut Vercel coupe vite)
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    system: `Tu es un Assistant CFO (Directeur Financier) expert pour l'entreprise 'Numera Corp'.
    Ton rôle est d'analyser les finances et d'aider l'entrepreneur.
    
    Règles :
    - Réponds de manière concise et professionnelle.
    - Utilise TOUJOURS le formatage monétaire (ex: 1 200,00 €).
    - Si on te demande 'Combien j'ai gagné ?', utilise l'outil getStats.
    - Si tu ne trouves pas l'info, dis-le honnêtement.
    `,
    // maxSteps est dans les settings, pas directement dans streamText
    // On peut l'ajouter via providerOptions si nécessaire
    tools: {
      getStats: tool({
        description: 'Récupère le Chiffre d\'Affaires (revenue), les Dépenses (expenses) et le Net du mois en cours.',
        parameters: z.object({}),
        execute: async () => {
          // Logique identique à ton dashboard
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          // On récupère la company de démo
          const user = await prisma.user.findUnique({ where: { email: 'demo@numera.ai' }, include: { companies: true }});
          if (!user?.companies[0]) throw new Error("Pas d'entreprise trouvée");
          const companyId = user.companies[0].id;

          const transactions = await prisma.transaction.findMany({
            where: {
              companyId,
              date: { gte: start, lte: end }
            }
          });

          const revenue = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + Number(t.amount), 0);
          const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + Number(t.amount), 0);

          return {
            revenue,
            expense,
            net: revenue - expense,
            month: now.toLocaleString('fr-FR', { month: 'long' })
          };
        },
      }),
      getLastTransactions: tool({
        description: 'Récupère les 5 dernières transactions bancaires.',
        parameters: z.object({}),
        execute: async () => {
          const user = await prisma.user.findUnique({ where: { email: 'demo@numera.ai' }, include: { companies: true }});
          if (!user?.companies[0]) throw new Error("Pas d'entreprise trouvée");
          
          return await prisma.transaction.findMany({
            where: { companyId: user.companies[0].id },
            orderBy: { date: 'desc' },
            take: 5,
            select: { date: true, description: true, amount: true, type: true }
          });
        },
      }),
    },
  });

  return result.toTextStreamResponse();
}
