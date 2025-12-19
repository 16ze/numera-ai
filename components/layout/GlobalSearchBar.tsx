"use client";

/**
 * Composant de barre de recherche globale avec dropdown de résultats
 * 
 * Fonctionnalités :
 * - Input de recherche dans le header
 * - Dropdown de résultats flottant sous l'input
 * - Debounce 300ms pour optimiser les appels API
 * - Gestion du focus et clic extérieur
 * - Redirection vers les pages appropriées au clic
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, User, Receipt, Wallet, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchGlobal } from "@/app/actions/search";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Type pour les résultats de recherche (basé sur le retour de searchGlobal)
 * Note: Les types sont flexibles car searchGlobal retourne directement les résultats Prisma
 */
type SearchResults = {
  clients: Array<{
    id: string;
    name: string;
    email: string | null;
    [key: string]: unknown; // Permet les propriétés supplémentaires de Prisma
  }>;
  invoices: Array<{
    id: string;
    number: string;
    client: { name: string } | null;
    rows?: Array<{
      quantity: number | string;
      unitPrice: number | string;
      vatRate: number | string;
    }>;
    status: string;
    [key: string]: unknown;
  }>;
  documents: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    [key: string]: unknown;
  }>;
  transactions: Array<{
    id: string;
    description: string | null;
    amount: number | { toString: () => string } | string; // Support Decimal de Prisma
    category: string;
    date: Date;
    [key: string]: unknown;
  }>;
};

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

export function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    clients: [],
    invoices: [],
    documents: [],
    transactions: [],
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce de la query (300ms)
  const debouncedQuery = useDebounce(query, 300);

  // Recherche lorsque la query debounced change
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      // Utiliser un callback pour éviter le warning setState dans useEffect
      const performSearch = async () => {
        setIsLoading(true);
        try {
          const data = await searchGlobal(debouncedQuery);
          setResults(data);
          setIsOpen(true);
        } catch (error) {
          console.error("Erreur recherche globale:", error);
          setResults({
            clients: [],
            invoices: [],
            documents: [],
            transactions: [],
          });
        } finally {
          setIsLoading(false);
        }
      };

      performSearch();
    } else {
      setResults({
        clients: [],
        invoices: [],
        documents: [],
        transactions: [],
      });
      setIsOpen(false);
    }
  }, [debouncedQuery]);

  // Gestion du clic extérieur pour fermer le dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Fonction de redirection
  const handleSelect = useCallback(
    (type: string, id: string, url?: string) => {
      setQuery("");
      setIsOpen(false);

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

  const showDropdown = isOpen && (query.trim().length >= 2 || isLoading);

  return (
    <div ref={containerRef} className="relative w-64 md:w-96">
      {/* INPUT DE RECHERCHE */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Rechercher..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            // Délai pour permettre le clic sur les résultats
            setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                // Le dropdown se fermera via handleClickOutside
              }
            }, 200);
          }}
          className="pl-9 pr-9 h-9"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* DROPDOWN DE RÉSULTATS */}
      {showDropdown && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">
                Recherche en cours...
              </span>
            </div>
          )}

          {/* N'affiche "Aucun résultat" que si on a fini de charger et qu'il n'y a rien */}
          {!isLoading &&
            query.trim().length >= 2 &&
            results.clients.length === 0 &&
            results.invoices.length === 0 &&
            results.documents.length === 0 &&
            results.transactions.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Aucun résultat trouvé pour &quot;{query}&quot;
              </div>
            )}

          {!isLoading && totalResults > 0 && (
            <div className="p-2">
              {/* CLIENTS */}
              {results.clients.length > 0 && (
                <div className="mb-4">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Clients
                  </div>
                  {results.clients.map((client: SearchResults["clients"][0]) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelect("client", client.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-100 transition-colors text-left"
                    >
                      <User className="h-4 w-4 text-blue-500 shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">
                          {client.name}
                        </span>
                        {client.email && (
                          <span className="text-xs text-muted-foreground truncate">
                            {client.email}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* FACTURES */}
              {results.invoices.length > 0 && (
                <div className="mb-4">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Factures
                  </div>
                  {results.invoices.map((invoice: SearchResults["invoices"][0]) => {
                    // Calcul du total TTC depuis les rows
                    const totalHT = invoice.rows?.reduce(
                      (sum: number, row: { quantity: number; unitPrice: number; vatRate: number }) =>
                        sum +
                        Number(row.quantity) * Number(row.unitPrice),
                      0
                    ) || 0;
                    const totalVAT = invoice.rows?.reduce(
                      (sum: number, row: { quantity: number; unitPrice: number; vatRate: number }) =>
                        sum +
                        Number(row.quantity) *
                          Number(row.unitPrice) *
                          (Number(row.vatRate) / 100),
                      0
                    ) || 0;
                    const totalTTC = totalHT + totalVAT;

                    return (
                      <button
                        key={invoice.id}
                        onClick={() => handleSelect("invoice", invoice.id)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-100 transition-colors text-left"
                      >
                        <Receipt className="h-4 w-4 text-green-500 shrink-0" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium text-sm truncate">
                            {invoice.number}
                          </span>
                          {invoice.client?.name && (
                            <span className="text-xs text-muted-foreground truncate">
                              {invoice.client.name} • {formatPrice(totalTTC)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {invoice.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* DOCUMENTS */}
              {results.documents.length > 0 && (
                <div className="mb-4">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Documents
                  </div>
                  {results.documents.map((document: SearchResults["documents"][0]) => (
                    <button
                      key={document.id}
                      onClick={() =>
                        handleSelect("document", document.id, document.url)
                      }
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-100 transition-colors text-left"
                    >
                      <FileText className="h-4 w-4 text-purple-500 shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">
                          {document.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {document.type}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* TRANSACTIONS */}
              {results.transactions.length > 0 && (
                <div>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Transactions
                  </div>
                  {results.transactions.map((transaction: SearchResults["transactions"][0]) => (
                    <button
                      key={transaction.id}
                      onClick={() => handleSelect("transaction", transaction.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-100 transition-colors text-left"
                    >
                      <Wallet className="h-4 w-4 text-orange-500 shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">
                          {transaction.description || "Sans description"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {formatPrice(
                            typeof transaction.amount === "number"
                              ? transaction.amount
                              : typeof transaction.amount === "object" && "toString" in transaction.amount
                              ? parseFloat(transaction.amount.toString())
                              : parseFloat(String(transaction.amount))
                          )} • {transaction.category} • {formatDate(transaction.date)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


