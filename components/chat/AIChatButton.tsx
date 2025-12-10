"use client";

/**
 * Composant AIChatButton - Bouton flottant pour ouvrir le chatbot financier
 * Interface de chat style ChatGPT avec messages scrollables
 * Utilise useChat de ai/react pour la communication avec l'API
 */

import { cn } from "@/lib/utils";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Type pour un message de chat
 */
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/**
 * Composant AIChatButton
 */
export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Bonjour Bryan, je suis ton CFO. Une dépense à ajouter ou une question sur ta tréso ?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Scroll automatique vers le bas quand de nouveaux messages arrivent
   */
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  /**
   * Focus sur l'input quand la fenêtre s'ouvre
   */
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  /**
   * Gestion de l'envoi d'un message
   */
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erreur API:", response.status, errorText);
        throw new Error(
          `Erreur ${response.status}: ${
            errorText || "Erreur lors de la requête"
          }`
        );
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Lecture du stream (format TextStream de Vercel AI SDK)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, aiMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Le format TextStream utilise des lignes séparées par \n
        const lines = buffer.split("\n");
        // Garder la dernière ligne incomplète dans le buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // Format TextStream peut être :
          // 1. Format SSE : "data: {...}" ou "0: {...}"
          // 2. Format direct JSON
          let jsonStr = "";
          
          if (line.startsWith("data: ")) {
            jsonStr = line.slice(6);
          } else if (line.startsWith("0:")) {
            jsonStr = line.slice(2);
          } else if (line.startsWith("{")) {
            jsonStr = line;
          } else {
            // Log les lignes non reconnues
            console.log("Ligne non parsée:", line);
            continue;
          }

          try {
            const data = JSON.parse(jsonStr);
            
            // Log pour déboguer
            console.log("Chunk reçu:", data);

            // Format TextStream : text-delta contient le texte
            if (data.type === "text-delta") {
              // Le texte peut être dans textDelta, delta, ou directement dans text
              const textChunk = data.textDelta || data.delta || data.text || "";
              if (textChunk) {
                assistantContent += textChunk;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.content = assistantContent;
                  }
                  return updated;
                });
              }
            }
          } catch (e) {
            // Log pour déboguer
            console.warn("Erreur parsing chunk:", e, line);
          }
        }
      }

      // Traiter le dernier buffer
      if (buffer.trim() && buffer.startsWith("0:")) {
        try {
          const data = JSON.parse(buffer.slice(2));
          if (data.type === "text-delta") {
            const textChunk = data.textDelta || data.delta || data.text || "";
            if (textChunk) {
              assistantContent += textChunk;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === "assistant") {
                  lastMsg.content = assistantContent;
                }
                return updated;
              });
            }
          }
        } catch (e) {
          console.warn("Erreur parsing dernier buffer:", e);
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Désolé, une erreur s'est produite. Veuillez réessayer.";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Erreur: ${errorMessage}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Gestion de la soumission du formulaire
   */
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSend();
  };

  /**
   * Gestion de la touche Enter pour envoyer
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading && input.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-110 hover:shadow-xl",
          isOpen && "hidden"
        )}
        aria-label="Ouvrir le chat"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Fenêtre de chat */}
      {isOpen && (
        <div className="fixed bottom-8 right-8 z-50 flex h-[600px] w-[400px] flex-col rounded-lg border bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">CFO IA</h3>
                <p className="text-xs text-muted-foreground">En ligne</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Fermer le chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Zone de messages (scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </div>
            ))}

            {/* Indicateur de chargement */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-muted px-4 py-2">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>L&apos;IA réfléchit...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input en bas */}
          <div className="border-t p-4">
            <form onSubmit={onSubmit} className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tapez votre message..."
                disabled={isLoading}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors",
                  input.trim() && !isLoading
                    ? "hover:bg-primary/90"
                    : "cursor-not-allowed opacity-50"
                )}
                aria-label="Envoyer le message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
