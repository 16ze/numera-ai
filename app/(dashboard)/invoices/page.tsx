/**
 * Page des Factures
 * Affiche la liste des factures de l'utilisateur connecté
 */

import { getInvoices } from "../actions/invoices";
import { calculateInvoiceTotalWithVat } from "../utils/invoice-calculations";
import Link from "next/link";
import { Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteInvoiceButton } from "./DeleteInvoiceButton";

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
                <TableHead className="text-right">Actions</TableHead>
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

                // Calcul de la couleur du montant selon l'échéance
                let amountColor = "text-slate-900"; // Par défaut (vert si payée)
                if (invoice.status !== "PAID" && invoice.dueDate) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dueDate = new Date(invoice.dueDate);
                  dueDate.setHours(0, 0, 0, 0);
                  const daysUntilDue = Math.floor(
                    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  if (daysUntilDue < 0) {
                    // Échéance dépassée : ROUGE
                    amountColor = "text-red-600 font-bold";
                  } else if (daysUntilDue <= 7) {
                    // Bientôt à l'échéance (7 jours ou moins) : ORANGE
                    amountColor = "text-orange-600 font-semibold";
                  } else {
                    // Tout est OK : VERT
                    amountColor = "text-green-600";
                  }
                } else if (invoice.status === "PAID") {
                  // Facture payée : VERT
                  amountColor = "text-green-600";
                }

                return (
                  <TableRow key={invoice.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {invoice.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-slate-900 hover:text-blue-600"
                      >
                        {formattedDate}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-slate-900 hover:text-blue-600"
                      >
                        {invoice.client.name}
                      </Link>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${amountColor}`}>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className={`hover:underline ${amountColor}`}
                      >
                        {total.toFixed(2)} €
                      </Link>
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
                          title={`Voir la facture ${invoice.number}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <DeleteInvoiceButton
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.number}
                        />
                      </div>
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

