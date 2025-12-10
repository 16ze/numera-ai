"use client";

/**
 * Composant AIChatButton - Bouton flottant pour ouvrir le chatbot financier
 * Interface de chat style ChatGPT avec messages scrollables
 * Utilise useChat de ai/react pour la communication avec l'API
 */

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Composant AIChatButton
 */
export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Utilisation du hook useChat pour gérer la conversation
  const { messages, sendMessage, status } = useChat({
    messages: [
      {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Bonjour Bryan, je suis ton CFO. Une dépense à ajouter ou une question sur ta tréso ?",
          },
        ],
      },
    ],
  });

  const isLoading = status === "streaming";

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
   * Gestion de la soumission du formulaire
   */
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage({ text: input.trim() });
      setInput("");
    }
  };

  /**
   * Gestion de la touche Enter pour envoyer
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading && input.trim()) {
      e.preventDefault();
      sendMessage({ text: input.trim() });
      setInput("");
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
            {messages.map((message: UIMessage) => {
              const content = message.parts
                .filter((part) => part.type === "text")
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("");
              return (
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
                    <p className="text-sm whitespace-pre-wrap">{content}</p>
                  </div>
                </div>
              );
            })}

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

