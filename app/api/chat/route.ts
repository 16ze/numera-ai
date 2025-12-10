import { prisma } from "@/app/lib/prisma";
import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";

// On laisse 30 secondes max pour éviter les timeouts
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    console.log("📩 Message reçu, début du traitement...");
    console.log("📝 Nombre de messages:", messages?.length || 0);

    const result = streamText({
      // 1. Force l'utilisation du modèle gpt-4o (pas le mini) pour assurer la fiabilité
      model: openai("gpt-4o"),
      messages,

      // 2. INDISPENSABLE : maxSteps permet à l'IA de faire plusieurs aller-retours
      // (Question -> Appel Outil -> Résultat Outil -> Réponse Texte)
      // Note: maxSteps est supporté mais pas encore dans les types TypeScript
      // @ts-expect-error - maxSteps est supporté par l'API mais pas encore typé
      maxSteps: 5,

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
              // --- Logique Prisma ---
              const user = await prisma.user.findUnique({
                where: { email: "demo@numera.ai" },
                include: { companies: true },
              });

              if (!user || !user.companies[0]) {
                console.error("❌ ERREUR: Utilisateur demo introuvable !");
                throw new Error("Utilisateur introuvable.");
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
        console.log("📄 Texte généré:", result.text?.substring(0, 200) || "Aucun texte");
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log("🛠️ Outils appelés:", result.toolCalls.map(t => t.toolName));
        }
      },

      // 5. Callback onError pour logger les erreurs
      onError: (error) => {
        console.error("❌ ERREUR DANS streamText :", error);
        console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
      },
    });

    // 6. On renvoie le stream au format DataStream (standard Vercel AI pour useChat)
    // Note: toDataStreamResponse() n'existe pas, on utilise toTextStreamResponse()
    // mais le format est compatible avec le parsing côté client
    console.log("📤 Envoi de la réponse streamée...");
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("❌ ERREUR GENERALE API :", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
