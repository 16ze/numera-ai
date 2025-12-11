import { prisma } from "@/app/lib/prisma";
import { openai } from "@ai-sdk/openai";
import { currentUser } from "@clerk/nextjs/server";
import { streamText, tool } from "ai";
import { z } from "zod";

// On laisse 30 secondes max pour éviter les timeouts
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Récupération de l'utilisateur Clerk connecté
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    console.log("📩 Message reçu, début du traitement...");
    console.log("📝 Nombre de messages:", messages?.length || 0);

    const result = streamText({
      // 1. Force l'utilisation du modèle gpt-4o (pas le mini) pour assurer la fiabilité
      model: openai("gpt-4o"),
      messages,

      // 2. INDISPENSABLE : stopWhen permet de continuer jusqu'à ce qu'il n'y ait plus d'appels d'outils
      // Par défaut, streamText s'arrête après 1 step, on doit le remplacer
      // On continue jusqu'à 5 steps max OU jusqu'à ce qu'il n'y ait plus de tool calls
      stopWhen: ({ steps }) => {
        // Continue tant qu'il y a moins de 5 steps
        // ET que le dernier step a des tool calls (donc pas encore de réponse finale)
        if (steps.length >= 5) return true;
        const lastStep = steps[steps.length - 1];
        // Si le dernier step n'a pas de tool calls, on peut s'arrêter
        return lastStep.toolCalls.length === 0 && steps.length > 1;
      },

      // 3. Prompt système autoritaire pour forcer la réponse textuelle
      system: `Tu es le CFO de Numera Corp.

      PROTOCOL STRICT :

      1. Si l'utilisateur demande des chiffres -> Appelle l'outil (getStats, etc).

      2. ATTENDS le résultat de l'outil.

      3. IMPORTANT : Une fois le résultat reçu, TU DOIS RÉDIGER une phrase de réponse (ex: "Votre CA est de 4000€").
      NE T'ARRÊTE JAMAIS APRÈS L'EXÉCUTION DE L'OUTIL. PARLE À L'UTILISATEUR.

      Devise : Euros (€).`,

      tools: {
        getStats: tool({
          description:
            "Donne le CA (income), les dépenses (expense) et le résultat net du mois en cours.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getStats' en cours...");

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.warn(
                  "⚠️ Utilisateur ou company non trouvé, retour de zéros"
                );
                return { revenue: 0, expense: 0, net: 0 };
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1);
              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

              console.log(
                `📅 Analyse du ${start.toLocaleDateString()} au ${end.toLocaleDateString()}`
              );

              const transactions = await prisma.transaction.findMany({
                where: {
                  companyId,
                  date: { gte: start, lte: end },
                },
              });

              console.log(`📊 ${transactions.length} transactions trouvées.`);

              const revenue = transactions
                .filter((t) => t.type === "INCOME")
                .reduce((acc, t) => acc + Number(t.amount), 0);

              const expense = transactions
                .filter((t) => t.type === "EXPENSE")
                .reduce((acc, t) => acc + Number(t.amount), 0);

              const net = revenue - expense;

              console.log(
                `💰 Succès : Recettes=${revenue} | Dépenses=${expense} | Net=${net}`
              );

              // On retourne le résultat
              return { revenue, expense, net };
            } catch (err) {
              console.error("❌ CRASH dans execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error("Erreur technique lors du calcul.");
            }
          },
        }),
      },

      // 4. Callback onFinish pour logger le moment exact où l'IA a fini
      onFinish: (result) => {
        console.log("✅✅✅ STREAMTEXT TERMINÉ ✅✅✅");
        console.log("📊 Finish reason:", result.finishReason);
        console.log("🔧 Tool calls:", result.toolCalls?.length || 0);
        console.log("📝 Usage:", result.usage);
        console.log(
          "📄 Texte généré:",
          result.text?.substring(0, 200) || "Aucun texte"
        );
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(
            "🛠️ Outils appelés:",
            result.toolCalls.map((t) => t.toolName)
          );
        }
      },

      // 5. Callback onError pour logger les erreurs
      onError: (error) => {
        console.error("❌ ERREUR DANS streamText :", error);
        console.error(
          "Stack trace:",
          error instanceof Error ? error.stack : "N/A"
        );
      },
    });

    // 6. On renvoie le stream au format UIMessageStream (standard Vercel AI v5)
    // toUIMessageStreamResponse() envoie les métadonnées des outils ET le texte
    // Cela permet au client de gérer correctement le cycle complet des outils
    console.log("📤 Envoi de la réponse streamée...");
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("❌ ERREUR GENERALE API :", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
