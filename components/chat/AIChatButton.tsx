"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, MessageCircle, Send, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolInvocations?: Array<{
    toolName: string;
    state: "call" | "partial-call" | "result";
    args?: unknown;
    result?: unknown;
  }>;
};

export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll automatique vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Lire le stream texte (format TextStream de Vercel AI SDK)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        toolInvocations: [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Variable pour tracker l'état : on commence par supposer qu'un outil sera appelé
      let hasReceivedContent = false;
      let toolCallDetected = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("📥 Stream terminé. Contenu final:", assistantContent);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log("📦 Chunk reçu:", chunk.substring(0, 50));
        
        assistantContent += chunk;
        hasReceivedContent = true;

        // Si on reçoit du contenu après un délai, c'est probablement la réponse finale
        // Sinon, on est encore dans la phase d'appel d'outil
        const isToolCallPhase = !assistantContent.trim() && chunk.length > 0;
        if (isToolCallPhase && !toolCallDetected) {
          toolCallDetected = true;
          console.log("🔧 Détection d'un appel d'outil");
        }

        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = assistantContent;
            
            // Gérer les tool invocations
            if (!lastMsg.toolInvocations) {
              lastMsg.toolInvocations = [];
            }

            // Si on détecte un appel d'outil (pas encore de contenu)
            if (toolCallDetected && !assistantContent.trim()) {
              if (!lastMsg.toolInvocations.length) {
                lastMsg.toolInvocations.push({
                  toolName: "getStats",
                  state: "call",
                });
              }
            }
            // Si on a du contenu, l'outil est terminé
            else if (assistantContent.trim() && lastMsg.toolInvocations.length) {
              lastMsg.toolInvocations[0].state = "result";
            }
          }
          return [...updated];
        });
      }

      // Si on n'a pas reçu de contenu à la fin, c'est un problème
      if (!hasReceivedContent || !assistantContent.trim()) {
        console.warn("⚠️ Aucun contenu reçu du stream");
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.";
          }
          return updated;
        });
      }

      console.log("✅ Stream terminé, contenu final:", assistantContent);
    } catch (error) {
      console.error("❌ Erreur:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Erreur: ${
            error instanceof Error ? error.message : "Erreur inconnue"
          }`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* BOUTON FLOTTANT (En bas à droite) */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 transition-all z-50"
        >
          <MessageCircle className="h-8 w-8 text-white" />
        </Button>
      )}

      {/* FENÊTRE DE CHAT */}
      {isOpen && (
        <Card className="fixed bottom-8 right-8 w-[400px] h-[600px] shadow-2xl flex flex-col z-50 border-2 border-slate-200">
          {/* HEADER */}
          <CardHeader className="flex flex-row items-center justify-between py-3 border-b bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 p-2 rounded-full">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Assistant CFO</CardTitle>
                <p className="text-xs text-muted-foreground">
                  En ligne • Numera AI
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          {/* MESSAGES (ZONE DE SCROLL) */}
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground mt-10 space-y-2">
                  <p>👋 Bonjour ! Je suis ton assistant financier.</p>
                  <p>Je peux analyser tes factures et ta trésorerie.</p>
                  <div className="flex flex-col gap-2 mt-4 px-4">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-slate-100 justify-center py-2"
                      onClick={() => setInput("Combien j'ai gagné ce mois-ci ?")}
                    >
                      Combien j&apos;ai gagné ce mois-ci ?
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-slate-100 justify-center py-2"
                      onClick={() => setInput("Mes dernières dépenses ?")}
                    >
                      Mes dernières dépenses ?
                    </Badge>
                  </div>
                </div>
              )}

              {messages.map((m) => {
                // Vérifier si le message a des tool invocations
                const toolInvocations = m.toolInvocations || [];
                const hasToolInvocations = toolInvocations.length > 0;

                // Vérifier l'état des tool invocations
                const hasActiveTools = toolInvocations.some(
                  (tool) => tool.state === "call" || tool.state === "partial-call"
                );
                const hasCompletedTools = toolInvocations.some(
                  (tool) => tool.state === "result"
                );

                return (
                  <div
                    key={m.id}
                    className={`flex gap-2 mb-4 ${
                      m.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        m.role === "user"
                          ? "bg-slate-900 text-white"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {m.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2 text-sm max-w-[80%] ${
                        m.role === "user"
                          ? "bg-slate-900 text-white rounded-tr-none"
                          : "bg-slate-100 text-slate-800 rounded-tl-none"
                      }`}
                    >
                      {/* Cas 1 : L'IA utilise un outil (en cours) */}
                      {hasToolInvocations && hasActiveTools && (
                        <div className="mb-2">
                          <Badge
                            variant="outline"
                            className="text-xs font-normal opacity-70 bg-blue-50 border-blue-200"
                          >
                            ⚙️ Analyse en cours...
                          </Badge>
                        </div>
                      )}

                      {/* Cas 2 : L'outil a terminé (données récupérées) */}
                      {hasToolInvocations && hasCompletedTools && !hasActiveTools && (
                        <div className="mb-2">
                          <Badge
                            variant="outline"
                            className="text-xs font-normal opacity-70 bg-green-50 border-green-200 text-green-700"
                          >
                            ✅ Données récupérées
                          </Badge>
                        </div>
                      )}

                      {/* Cas 3 : Le contenu textuel final */}
                      {m.content && (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      )}

                      {/* Cas 4 : Pas de contenu et pas d'outil actif = en attente */}
                      {!m.content && !hasToolInvocations && (
                        <span className="italic opacity-50">
                          Analyse en cours...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Indicateur de chargement global */}
              {isLoading && messages.length > 0 && (
                <div className="flex gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-blue-600 animate-pulse" />
                  </div>
                  <div className="bg-slate-50 rounded-2xl px-4 py-2 text-sm text-muted-foreground italic">
                    En train d&apos;écrire...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </ScrollArea>
          </CardContent>

          {/* INPUT */}
          <CardFooter className="p-3 border-t bg-white">
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez une question sur vos finances..."
                className="focus-visible:ring-1 focus-visible:ring-blue-600"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <Bot className="h-4 w-4 animate-pulse" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
