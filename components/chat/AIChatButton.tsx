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
import { Bot, Loader2, MessageCircle, Send, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Type représentant un message dans le chat
 */
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolInvocations?: Array<{
    toolName: string;
    state: "call" | "result";
    result?: unknown;
  }>;
};

/**
 * Composant AIChatButton
 *
 * Affiche un bouton flottant qui ouvre une fenêtre de chat avec l'assistant CFO.
 * Gère le streaming des réponses et les appels d'outils de manière automatique.
 */
export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Scroll automatique vers le bas lors de l'ajout de nouveaux messages
   */
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  /**
   * Gestion de l'envoi d'un message
   * Envoie le message à l'API et traite le stream de réponse
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Création du message utilisateur
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Envoi de la requête à l'API
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

      // Création du message assistant (vide au départ)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        toolInvocations: [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Lecture du UIMessageStream (format SSE de Vercel AI SDK v5)
      // Le format est: data: {"type":"text-delta","delta":"..."}
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let textContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Garde la dernière ligne incomplète

        for (const line of lines) {
          if (!line.trim()) continue;
          if (!line.startsWith("data: ")) continue;

          const jsonData = line.slice(6); // Enlève "data: "

          // Ignore le marqueur de fin de stream
          if (jsonData.trim() === "[DONE]") continue;

          try {
            const event = JSON.parse(jsonData);

            switch (event.type) {
              case "text-delta": // Chunk de texte
                textContent += event.delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.content = textContent;
                    // Si on reçoit du texte, les outils sont terminés
                    if (lastMsg.toolInvocations) {
                      for (const tool of lastMsg.toolInvocations) {
                        if (tool.state === "call") {
                          tool.state = "result";
                        }
                      }
                    }
                  }
                  return updated;
                });
                break;

              case "tool-input-start": // Début d'appel d'outil
                console.log("🔧 Tool call détecté:", event.toolName);
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    if (!lastMsg.toolInvocations) {
                      lastMsg.toolInvocations = [];
                    }
                    // Ajoute le tool call s'il n'existe pas déjà
                    if (
                      !lastMsg.toolInvocations.find(
                        (t) => t.toolName === event.toolName
                      )
                    ) {
                      lastMsg.toolInvocations.push({
                        toolName: event.toolName,
                        state: "call",
                      });
                    }
                  }
                  return updated;
                });
                break;

              case "tool-output-available": // Résultat d'outil disponible
                console.log("✅ Tool result reçu:", event.output);
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (
                    lastMsg &&
                    lastMsg.role === "assistant" &&
                    lastMsg.toolInvocations
                  ) {
                    const tool = lastMsg.toolInvocations.find(
                      (t) => t.toolName === event.toolName
                    );
                    if (tool) {
                      tool.result = event.output;
                      // Garde l'état "call" jusqu'à ce qu'on reçoive du texte
                    }
                  }
                  return updated;
                });
                break;

              case "finish":
                console.log("📊 Stream terminé, raison:", event.finishReason);
                break;

              case "error":
                console.error("❌ Erreur du stream:", event);
                throw new Error(event.error || "Erreur du stream");
            }
          } catch (parseError) {
            console.error("Erreur de parsing:", parseError, "Line:", line);
          }
        }
      }

      // Vérification finale : si pas de texte généré
      if (!textContent.trim()) {
        console.warn("⚠️ Aucun texte généré par l'IA");
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content =
              "Désolé, je n'ai pas pu générer de réponse. Les données ont été récupérées mais la réponse textuelle n'a pas été générée. Veuillez réessayer.";
          }
          return updated;
        });
      } else {
        console.log("✅ Texte final généré:", textContent);
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
      {/* BOUTON FLOTTANT - Affiche/masque la fenêtre de chat - Responsive */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 md:bottom-8 md:right-8 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 transition-all z-50"
        >
          <MessageCircle className="h-8 w-8 text-white" />
        </Button>
      )}

      {/* FENÊTRE DE CHAT - Responsive */}
      {isOpen && (
        <Card className="fixed bottom-4 right-4 w-[95vw] h-[85vh] md:bottom-8 md:right-8 md:w-[400px] md:h-[600px] shadow-2xl flex flex-col z-50 border-2 border-slate-200 max-w-full">
          {/* HEADER - Affiche le titre et le bouton de fermeture */}
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

          {/* CONTENU - Liste des messages */}
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4">
              {/* Message de bienvenue si aucun message */}
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground mt-10">
                  <p>👋 Bonjour ! Je peux analyser tes finances.</p>
                </div>
              )}

              {/* Affichage de chaque message */}
              {messages.map((m) => {
                // Détection des appels d'outils en cours
                const toolInvocations = m.toolInvocations || [];
                const hasActiveTools = toolInvocations.some(
                  (t) => t.state === "call"
                );

                return (
                  <div
                    key={m.id}
                    className={`flex gap-2 mb-4 ${
                      m.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* AVATAR - Utilisateur ou Assistant */}
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
                      {/* INDICATEUR D'OUTIL EN COURS */}
                      {hasActiveTools && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs mb-1">
                          <div className="flex items-center gap-2 font-medium text-slate-600">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                            Analyse en cours...
                          </div>
                        </div>
                      )}

                      {/* MESSAGE TEXTE */}
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

                      {/* INDICATEUR DE CHARGEMENT (si pas de contenu et pas d'outils) */}
                      {!m.content && !toolInvocations.length && (
                        <div className="bg-slate-50 rounded-2xl px-4 py-2 text-sm text-muted-foreground italic">
                          Analyse en cours...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* INDICATEUR DE CHARGEMENT GLOBAL */}
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

              {/* Élément pour le scroll automatique */}
              <div ref={messagesEndRef} />
            </ScrollArea>
          </CardContent>

          {/* FOOTER - Formulaire d'envoi de message */}
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
