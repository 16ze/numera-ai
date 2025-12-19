"use client";

/**
 * Composant de recherche globale style "Command K" (Spotlight macOS)
 * 
 * Fonctionnalités :
 * - Raccourci clavier Cmd+K (Mac) / Ctrl+K (Windows)
 * - Recherche dans Clients, Factures, Documents, Transactions
 * - Debounce pour optimiser les appels API
 * - Redirection vers les pages appropriées au clic
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, User, Receipt, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchGlobal, type GlobalSearchResult } from "@/app/actions/search";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Hook pour debounce
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult>({
    clients: [],
    invoices: [],
    documents: [],
    transactions: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Debounce de la query (300ms)
  const debouncedQuery = useDebounce(query, 300);

  // Recherche lorsque la query debounced change
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      setIsLoading(true);
      searchGlobal(debouncedQuery)
        .then((data) => {
          setResults(data);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Erreur recherche globale:", error);
          setResults({
            clients: [],
            invoices: [],
            documents: [],
            transactions: [],
          });
          setIsLoading(false);
        });
    } else {
      setResults({
        clients: [],
        invoices: [],
        documents: [],
        transactions: [],
      });
    }
  }, [debouncedQuery]);

  // Raccourci clavier Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "k") {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setOpen((open) => !open);
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fonction de redirection
  const handleSelect = useCallback(
    (type: string, id: string, url?: string) => {
      setOpen(false);
      setQuery("");

      switch (type) {
        case "client":
          router.push(`/clients`);
          break;
        case "invoice":
          router.push(`/invoices/${id}`);
          break;
        case "document":
          if (url) {
            window.open(url, "_blank");
          }
          break;
        case "transaction":
          router.push(`/transactions`);
          break;
      }
    },
    [router]
  );

  // Formatage du montant
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Formatage de la date
  const formatDate = (date: Date) => {
    return format(new Date(date), "dd MMM yyyy", { locale: fr });
  };

  const totalResults =
    results.clients.length +
    results.invoices.length +
    results.documents.length +
    results.transactions.length;

  return (
    <>
      {/* TRIGGER - Bouton de recherche */}
      <Button
        variant="outline"
        className="relative w-64 justify-start text-sm text-muted-foreground border rounded-md h-9 bg-background"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Rechercher...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* MODALE - CommandDialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Rechercher dans Clients, Factures, Documents, Transactions..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Recherche en cours...
              </span>
            </div>
          )}

          {!isLoading && totalResults === 0 && query.trim().length >= 2 && (
            <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          )}

          {!isLoading && query.trim().length < 2 && (
            <CommandEmpty>
              Tapez au moins 2 caractères pour rechercher...
            </CommandEmpty>
          )}

          {/* CLIENTS */}
          {results.clients.length > 0 && (
            <CommandGroup heading="Clients">
              {results.clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={`client-${client.id}`}
                  onSelect={() => handleSelect("client", client.id)}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="font-medium">{client.name}</span>
                    {client.email && (
                      <span className="text-xs text-muted-foreground">
                        {client.email}
                      </span>
                    )}
                    {client.companyName && (
                      <span className="text-xs text-muted-foreground">
                        {client.companyName}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* FACTURES */}
          {results.invoices.length > 0 && (
            <CommandGroup heading="Factures">
              {results.invoices.map((invoice) => (
                <CommandItem
                  key={invoice.id}
                  value={`invoice-${invoice.id}`}
                  onSelect={() => handleSelect("invoice", invoice.id)}
                  className="flex items-center gap-2"
                >
                  <Receipt className="h-4 w-4 text-green-500" />
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{invoice.number}</span>
                    {invoice.clientName && (
                      <span className="text-xs text-muted-foreground">
                        {invoice.clientName} • {formatPrice(invoice.totalAmount)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {invoice.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* DOCUMENTS */}
          {results.documents.length > 0 && (
            <CommandGroup heading="Documents">
              {results.documents.map((document) => (
                <CommandItem
                  key={document.id}
                  value={`document-${document.id}`}
                  onSelect={() =>
                    handleSelect("document", document.id, document.url)
                  }
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4 text-purple-500" />
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{document.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {document.type}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* TRANSACTIONS */}
          {results.transactions.length > 0 && (
            <CommandGroup heading="Transactions">
              {results.transactions.map((transaction) => (
                <CommandItem
                  key={transaction.id}
                  value={`transaction-${transaction.id}`}
                  onSelect={() => handleSelect("transaction", transaction.id)}
                  className="flex items-center gap-2"
                >
                  <Wallet className="h-4 w-4 text-orange-500" />
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">
                      {transaction.description || "Sans description"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatPrice(transaction.amount)} • {transaction.category}{" "}
                      • {formatDate(transaction.date)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}


