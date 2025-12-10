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
};

export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = assistantContent;
          }
          return updated;
        });
      }
    } catch (error) {
      console.error("Erreur:", error);
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
                    >
                      Combien j&apos;ai gagné ce mois-ci ?
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-slate-100 justify-center py-2"
                    >
                      Mes dernières dépenses ?
                    </Badge>
                  </div>
                </div>
              )}

              {messages.map((m) => (
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
                     {/* Cas 1 : L'IA utilise un outil (affiche un petit badge) */}
                     {"toolInvocations" in m &&
                       (m as { toolInvocations?: unknown }).toolInvocations && (
                         <div className="mb-2">
                           <Badge
                             variant="outline"
                             className="text-xs font-normal opacity-70"
                           >
                             ⚙️ Vérification des comptes...
                           </Badge>
                         </div>
                       )}

                     {/* Cas 2 : Le contenu textuel final */}
                     {m.content}

                     {/* Cas 3 : Sécurité si pas de contenu mais outil terminé */}
                     {!m.content &&
                       !(
                         "toolInvocations" in m &&
                         (m as { toolInvocations?: unknown }).toolInvocations
                       ) && (
                         <span className="italic opacity-50">
                           Analyse en cours...
                         </span>
                       )}
                   </div>
                </div>
              ))}

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

          {/* INPUT */}
          <CardFooter className="p-3 border-t bg-white">
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez une question sur vos finances..."
                className="focus-visible:ring-1 focus-visible:ring-blue-600"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
