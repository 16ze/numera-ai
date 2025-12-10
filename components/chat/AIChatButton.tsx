"use client";

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
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Send,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolInvocations?: Array<{
    toolName: string;
    state: "call" | "result";
  }>;
};

export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll automatique
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

      // Lire le stream texte
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

      // Variables pour détecter les phases
      let hasReceivedText = false;
      let toolCallDetected = false;
      let lastChunkTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("✅ Stream terminé. Contenu final:", assistantContent);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const currentTime = Date.now();

        // Si on reçoit un chunk mais pas encore de texte, c'est probablement un appel d'outil
        if (!hasReceivedText && chunk.length > 0) {
          const timeSinceLastChunk = currentTime - lastChunkTime;
          // Si on attend longtemps sans texte, c'est probablement un outil
          if (timeSinceLastChunk > 100 || !assistantContent.trim()) {
            toolCallDetected = true;
            console.log("🔧 Détection d'un appel d'outil");
          }
        }

        assistantContent += chunk;
        if (chunk.trim().length > 0) {
          hasReceivedText = true;
        }

        lastChunkTime = currentTime;

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
      if (!hasReceivedText || !assistantContent.trim()) {
        console.warn("⚠️ Aucun contenu reçu du stream");
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content =
              "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.";
          }
          return updated;
        });
      }
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
      {/* BOUTON FLOTTANT */}
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
          <CardHeader className="flex flex-row items-center justify-between py-3 border-b bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 p-2 rounded-full">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Assistant CFO</CardTitle>
                <p className="text-xs text-muted-foreground">Numera AI</p>
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

          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground mt-10">
                  <p>👋 Bonjour ! Je peux analyser tes finances.</p>
                </div>
              )}

              {messages.map((m) => {
                const toolInvocations = m.toolInvocations || [];
                const hasActiveTools = toolInvocations.some(
                  (t) => t.state === "call"
                );
                const hasCompletedTools = toolInvocations.some(
                  (t) => t.state === "result"
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

                    <div className="flex flex-col gap-1 max-w-[80%]">
                      {/* AFFICHAGE DES OUTILS */}
                      {hasActiveTools && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs mb-1">
                          <div className="flex items-center gap-2 font-medium text-slate-600">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                            ⚙️ Analyse en cours...
                          </div>
                        </div>
                      )}

                      {hasCompletedTools && !hasActiveTools && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs mb-1">
                          <div className="flex items-center gap-2 font-medium text-green-700">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ✅ Données récupérées
                          </div>
                        </div>
                      )}

                      {/* LE MESSAGE TEXTE FINAL */}
                      {m.content && (
                        <div
                          className={`rounded-2xl px-4 py-2 text-sm ${
                            m.role === "user"
                              ? "bg-slate-900 text-white rounded-tr-none"
                              : "bg-slate-100 text-slate-800 rounded-tl-none"
                          }`}
                        >
                          {m.content}
                        </div>
                      )}

                      {/* Si pas de contenu et pas d'outil = en attente */}
                      {!m.content && !toolInvocations.length && (
                        <div className="bg-slate-50 rounded-2xl px-4 py-2 text-sm text-muted-foreground italic">
                          Analyse en cours...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Indicateur de chargement */}
              {isLoading && (
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

          <CardFooter className="p-3 border-t bg-white">
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Une question sur le CA ?"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
