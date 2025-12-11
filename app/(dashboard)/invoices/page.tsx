/**
 * Page des Factures
 * Affiche la liste des factures de l'utilisateur connecté
 */

import { getInvoices, calculateInvoiceTotalWithVat } from "../actions/invoices";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/**
 * Fonction utilitaire pour obtenir le label du statut
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Brouillon",
    SENT: "Envoyée",
    PAID: "Payée",
    OVERDUE: "En retard",
    CANCELLED: "Annulée",
  };
  return labels[status] || status;
}

/**
 * Fonction utilitaire pour obtenir la couleur du badge selon le statut
 */
function getStatusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "PAID") {
    return "default"; // Vert (primary)
  }
  if (status === "SENT" || status === "OVERDUE") {
    return "secondary"; // Jaune/Orange
  }
  return "outline"; // Gris pour DRAFT et CANCELLED
}

/**
 * Page des Factures
 */
export default async function InvoicesPage() {
  // Récupération des factures (redirige vers /sign-in si non connecté)
  const invoices = await getInvoices();

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mes Factures</h1>
        <p className="mt-2 text-muted-foreground">
          Gérez toutes vos factures client depuis un seul endroit
        </p>
      </div>

      {/* Tableau des factures */}
      {invoices.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">
            Aucune facture pour le moment
          </h2>
          <p className="text-muted-foreground max-w-md">
            Demandez à l&apos;IA de créer votre première facture !
            <br />
            Par exemple : &quot;Facture Martin 500€ pour du coaching&quot;
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Montant Total</TableHead>
                <TableHead className="text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const total = calculateInvoiceTotalWithVat(invoice.rows);
                const formattedDate = new Date(invoice.issuedDate).toLocaleDateString(
                  "fr-FR",
                  {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }
                );

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.number}</TableCell>
                    <TableCell>{formattedDate}</TableCell>
                    <TableCell>{invoice.client.name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {total.toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={getStatusBadgeVariant(invoice.status)}
                        className={
                          invoice.status === "PAID"
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : invoice.status === "SENT" || invoice.status === "OVERDUE"
                            ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                            : undefined
                        }
                      >
                        {getStatusLabel(invoice.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

