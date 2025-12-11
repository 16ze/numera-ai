/**
 * Page de visualisation d'une facture
 * Design professionnel type Stripe/Qonto pour impression
 */

import { notFound } from "next/navigation";
import { getInvoiceById } from "../../actions/invoices";
import {
  calculateInvoiceTotal,
  calculateInvoiceTotalWithVat,
} from "../../utils/invoice-calculations";
import { PrintButton } from "./PrintButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Page de visualisation d'une facture
 */
export default async function InvoicePage({
  params,
}: {
  params: { invoiceId: string };
}) {
  let invoice;
  
  try {
    // Récupération de la facture (avec vérification de sécurité intégrée)
    invoice = await getInvoiceById(params.invoiceId);
  } catch (error) {
    // Si la facture n'existe pas ou n'appartient pas à l'utilisateur -> 404
    notFound();
  }

  // Calculs des totaux
  const totalHT = calculateInvoiceTotal(invoice.rows);
  const totalTTC = calculateInvoiceTotalWithVat(invoice.rows);
  const totalTVA = totalTTC - totalHT;

  // Formatage des dates
  const issuedDate = new Date(invoice.issuedDate).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white">
      {/* Bouton d'impression (caché lors de l'impression) */}
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      {/* Conteneur facture format A4 */}
      <div
        id="invoice-print-area"
        className="mx-auto w-full max-w-[210mm] bg-white shadow-lg print:shadow-none"
      >
        <div className="p-12 print:p-8">
          {/* En-tête : Logo/Entreprise (gauche) vs Client/Infos (droite) */}
          <div className="mb-12 grid grid-cols-2 gap-8">
            {/* Colonne gauche : Entreprise */}
            <div>
              {invoice.company.logoUrl ? (
                <img
                  src={invoice.company.logoUrl}
                  alt={invoice.company.name}
                  className="mb-4 h-16 w-auto"
                />
              ) : (
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-2xl font-bold text-primary-foreground">
                  {invoice.company.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h1 className="text-2xl font-bold text-slate-900">
                {invoice.company.name}
              </h1>
              {invoice.company.address && (
                <p className="mt-2 text-sm text-slate-600">
                  {invoice.company.address}
                </p>
              )}
              {invoice.company.siret && (
                <p className="mt-1 text-xs text-slate-500">
                  SIRET : {invoice.company.siret}
                </p>
              )}
              {invoice.company.vatNumber && (
                <p className="text-xs text-slate-500">
                  TVA : {invoice.company.vatNumber}
                </p>
              )}
            </div>

            {/* Colonne droite : Client + Infos facture */}
            <div className="text-right">
              <div className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Facture pour
                </h2>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {invoice.client.name}
                </p>
                {invoice.client.address && (
                  <p className="mt-1 text-sm text-slate-600">
                    {invoice.client.address}
                  </p>
                )}
                {invoice.client.email && (
                  <p className="mt-1 text-sm text-slate-600">
                    {invoice.client.email}
                  </p>
                )}
                {invoice.client.siret && (
                  <p className="mt-1 text-xs text-slate-500">
                    SIRET : {invoice.client.siret}
                  </p>
                )}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Facture N°</span>
                  <span className="font-semibold text-slate-900">
                    {invoice.number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Date</span>
                  <span className="text-slate-900">{issuedDate}</span>
                </div>
                {dueDate && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">
                      Échéance
                    </span>
                    <span className="text-slate-900">{dueDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tableau des lignes */}
          <div className="mb-8 overflow-hidden rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[50%]">Description</TableHead>
                  <TableHead className="text-center">Qté</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="text-right">TVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.rows.map((row) => {
                  const lineTotal = row.quantity * row.unitPrice;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.unitPrice.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right">
                        {row.vatRate > 0 ? `${row.vatRate}%` : "Exonéré"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {lineTotal.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totaux alignés à droite */}
          <div className="ml-auto w-full max-w-md space-y-2">
            <div className="flex justify-between border-t border-slate-200 pt-4 text-sm">
              <span className="font-medium text-slate-600">Sous-total HT</span>
              <span className="text-slate-900">{totalHT.toFixed(2)} €</span>
            </div>
            {totalTVA > 0 && (
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-600">TVA</span>
                <span className="text-slate-900">{totalTVA.toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-slate-900 pt-4 text-lg font-bold">
              <span className="text-slate-900">Total TTC</span>
              <span className="text-slate-900">{totalTTC.toFixed(2)} €</span>
            </div>
          </div>

          {/* Pied de page */}
          <div className="mt-16 border-t border-slate-200 pt-8 text-xs text-slate-500">
            <p className="mb-2 font-semibold text-slate-700">
              Merci de votre confiance !
            </p>
            <p className="mb-1">
              Facture établie par {invoice.company.name}
              {invoice.company.siret && ` - SIRET : ${invoice.company.siret}`}
            </p>
            <p>
              En cas de retard de paiement, des pénalités de retard de 3 fois le
              taux d&apos;intérêt légal en vigueur seront appliquées.
            </p>
            <p className="mt-2">
              Une indemnité forfaitaire pour frais de recouvrement de 40€ sera
              due en cas de retard de paiement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

