"use client";

/**
 * Composant Client pour la page des Clients
 * Gère l'état local (dialog, recherche, etc.)
 */

import { useState, useMemo } from "react";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { DeleteClientButton } from "@/components/clients/DeleteClientButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Edit, Search } from "lucide-react";
import type { ClientWithStats } from "@/app/actions/clients";

/**
 * Props du composant ClientsPageClient
 */
interface ClientsPageClientProps {
  initialClients: ClientWithStats[];
}

/**
 * Composant Client pour la page des Clients
 */
export function ClientsPageClient({
  initialClients,
}: ClientsPageClientProps) {
  const [clients, setClients] = useState<ClientWithStats[]>(initialClients);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] =
    useState<ClientWithStats | null>(null);

  /**
   * Filtre les clients selon la recherche
   */
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) {
      return clients;
    }

    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.address?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  /**
   * Ouvre le dialog pour créer un nouveau client
   */
  const handleCreateClick = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  /**
   * Ouvre le dialog pour modifier un client
   */
  const handleEditClick = (client: ClientWithStats) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  /**
   * Gère la fermeture du dialog
   */
  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingClient(null);
    }
  };

  /**
   * Met à jour la liste des clients après une modification/création
   */
  const handleClientUpdated = () => {
    // Recharger la page pour récupérer les données mises à jour
    window.location.reload();
  };

  /**
   * Génère les initiales d'un nom pour l'avatar
   */
  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  /**
   * Formate un montant en euros
   */
  const formatMoney = (amount: number): string => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes Clients</h1>
          <p className="mt-2 text-muted-foreground">
            Gérez votre base de données clients (CRM)
          </p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau Client
        </Button>
      </div>

      {/* Barre de recherche */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client (nom, email, adresse)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tableau des clients */}
      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="mb-4 rounded-full bg-muted p-6">
            <svg
              className="h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {searchQuery
              ? "Aucun client trouvé"
              : "Aucun client pour le moment"}
          </h2>
          <p className="text-muted-foreground max-w-md mb-6">
            {searchQuery
              ? "Essayez une autre recherche ou créez un nouveau client."
              : "Commencez par ajouter votre premier client. Vous pourrez ensuite créer des factures pour eux."}
          </p>
          {!searchQuery && (
            <Button onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter mon premier client
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead className="text-right">Total Facturé</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id} className="hover:bg-slate-50">
                  {/* Client (Avatar + Nom) */}
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-slate-900">
                          {client.name}
                        </div>
                        {client.siret && (
                          <div className="text-xs text-muted-foreground">
                            SIRET: {client.siret}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Contact (Email) */}
                  <TableCell>
                    {client.email ? (
                      <a
                        href={`mailto:${client.email}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {client.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Entreprise (Adresse) */}
                  <TableCell>
                    {client.address ? (
                      <div className="text-sm text-slate-700">
                        {client.address}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Total Facturé */}
                  <TableCell className="text-right">
                    {client.invoiceCount > 0 ? (
                      <div className="flex flex-col items-end">
                        <Badge className="bg-green-500 hover:bg-green-500/80 text-white mb-1">
                          {formatMoney(client.totalInvoiced)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {client.invoiceCount}{" "}
                          {client.invoiceCount === 1 ? "facture" : "factures"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEditClick(client)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DeleteClientButton
                          clientId={client.id}
                          clientName={client.name}
                          onDeleted={handleClientUpdated}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog pour créer/modifier un client */}
      <ClientDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        initialData={editingClient || undefined}
      />
    </div>
  );
}
