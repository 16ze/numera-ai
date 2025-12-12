/**
 * Page de gestion des Clients (CRM)
 *
 * Affiche la liste des clients avec leurs statistiques (total facturé, nombre de factures)
 * Permet de créer, modifier et supprimer des clients
 */

import { getClients } from "@/app/actions/clients";
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
import { Plus, MoreVertical, Edit, Trash2, Search } from "lucide-react";
import { ClientsPageClient } from "./ClientsPageClient";

/**
 * Page des Clients (Server Component)
 * Récupère les données et passe au Client Component pour la gestion d'état
 */
export default async function ClientsPage() {
  const clients = await getClients();

  return <ClientsPageClient initialClients={clients} />;
}
