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
import { useChat } from "@ai-sdk/react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Send,
  User,
  X,
} from "lucide-react";
import { useState } from "react";

export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  // maxSteps coté client est parfois nécessaire selon la version du SDK
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      maxSteps: 5,
    });

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 transition-all z-50"
        >
          <MessageCircle className="h-8 w-8 text-white" />
        </Button>
      )}

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

                  <div className={`flex flex-col gap-1 max-w-[80%]`}>
                    {/* AFFICHAGE TECHNIQUE DES OUTILS (C'est ça qui manquait !) */}
                    {m.toolInvocations?.map((toolInvocation) => {
                      const toolCallId = toolInvocation.toolCallId;
                      const addResult = "result" in toolInvocation;

                      return (
                        <div
                          key={toolCallId}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs mb-1"
                        >
                          <div className="flex items-center gap-2 font-medium text-slate-600">
                            {addResult ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ) : (
                              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                            )}
                            {toolInvocation.toolName === "getStats"
                              ? "Analyse des comptes..."
                              : "Recherche..."}
                          </div>
                        </div>
                      );
                    })}

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
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-3 border-t bg-white">
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Une question sur le CA ?"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading}
                className="bg-blue-600"
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
