/**
 * Page de visualisation d'une facture
 * Design professionnel A4 imprimable type Stripe/Qonto
 */

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { PrintButton } from "@/components/invoices/PrintButton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Page de visualisation d'une facture
 * Format A4 professionnel pour impression/PDF
 */
export default async function InvoicePage({ 
  params 
}: { 
  params: Promise<{ invoiceId: string }> | { invoiceId: string };
}) {
  // Gérer les params synchrones et asynchrones (Next.js 15+)
  const resolvedParams = typeof params === 'object' && 'then' in params 
    ? await params 
    : params;
  
  const invoiceId = resolvedParams.invoiceId;

  if (!invoiceId) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // 1. Récupérer la facture avec toutes les infos (Client, Lignes, Entreprise)
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      rows: true,
      company: {
        include: {
          user: true, // Pour vérifier la sécurité
        },
      },
    },
  });

  // 2. Sécurité : Vérifier que la facture appartient bien à l'utilisateur connecté
  // (On vérifie via l'entreprise liée)
  if (!invoice || invoice.company.userId !== user.id) {
    return notFound();
  }

  // 3. Calculs des totaux
  const totalHT = invoice.rows.reduce(
    (acc, row) => acc + (Number(row.quantity) * Number(row.unitPrice)),
    0
  );
  const totalVAT = invoice.rows.reduce(
    (acc, row) => acc + (Number(row.quantity) * Number(row.unitPrice) * (Number(row.vatRate) / 100)),
    0
  );
  const totalTTC = totalHT + totalVAT;

  /**
   * Formate un montant en euros
   */
  const formatPrice = (amount: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <div className="flex flex-col items-center gap-8 py-8 bg-slate-50 min-h-screen">
      {/* Barre d'actions (Cachée à l'impression) */}
      <div className="w-full max-w-[210mm] flex justify-between items-center print:hidden px-4 md:px-0">
        <Link 
          href="/invoices" 
          className="flex items-center text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour aux factures
        </Link>
        <PrintButton />
      </div>

      {/* --- LA FEUILLE A4 (C'est ça qui s'imprime) --- */}
      {/* L'ID "invoice-print-area" est crucial pour le CSS global */}
      <div 
        id="invoice-print-area" 
        className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[15mm] shadow-lg text-slate-900 print:shadow-none print:w-full"
      >
        {/* EN-TÊTE */}
        <div className="flex justify-between items-start mb-16">
          {/* Vendeur (Toi) */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {invoice.company.name}
            </h1>
            <div className="text-sm text-slate-500 space-y-1">
              {invoice.company.address && <p>{invoice.company.address}</p>}
              {invoice.company.siret && <p>SIRET : {invoice.company.siret}</p>}
              {invoice.company.vatNumber && <p>TVA : {invoice.company.vatNumber}</p>}
            </div>
          </div>

          {/* Infos Facture */}
          <div className="text-right">
            <h2 className="text-4xl font-light text-slate-200 mb-4">FACTURE</h2>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-semibold text-slate-700">Numéro :</span>{" "}
                {invoice.number}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Date :</span>{" "}
                {format(new Date(invoice.issuedDate), 'dd MMMM yyyy', { locale: fr })}
              </p>
              {invoice.dueDate && (
                <p>
                  <span className="font-semibold text-slate-700">Échéance :</span>{" "}
                  {format(new Date(invoice.dueDate), 'dd MMMM yyyy', { locale: fr })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CLIENT */}
        <div className="mb-16 flex justify-end">
          <div className="w-1/3 text-right">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">
              Facturé à
            </p>
            <p className="font-bold text-lg">{invoice.client.name}</p>
            {invoice.client.address && (
              <p className="text-slate-600 text-sm whitespace-pre-line">
                {invoice.client.address}
              </p>
            )}
            {invoice.client.email && (
              <p className="text-slate-600 text-sm">{invoice.client.email}</p>
            )}
          </div>
        </div>

        {/* TABLEAU DES LIGNES */}
        <table className="w-full mb-12">
          <thead>
            <tr className="border-b-2 border-slate-100">
              <th className="text-left py-3 text-sm font-semibold text-slate-600">
                Description
              </th>
              <th className="text-right py-3 text-sm font-semibold text-slate-600 w-24">
                Qté
              </th>
              <th className="text-right py-3 text-sm font-semibold text-slate-600 w-32">
                Prix U.
              </th>
              <th className="text-right py-3 text-sm font-semibold text-slate-600 w-24">
                TVA
              </th>
              <th className="text-right py-3 text-sm font-semibold text-slate-600 w-32">
                Total HT
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {invoice.rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50">
                <td className="py-4 text-slate-800">{row.description}</td>
                <td className="py-4 text-right text-slate-500">
                  {Number(row.quantity)}
                </td>
                <td className="py-4 text-right text-slate-500">
                  {formatPrice(Number(row.unitPrice))}
                </td>
                <td className="py-4 text-right text-slate-500">
                  {Number(row.vatRate)}%
                </td>
                <td className="py-4 text-right font-medium text-slate-800">
                  {formatPrice(Number(row.quantity) * Number(row.unitPrice))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTAUX */}
        <div className="flex justify-end mb-20">
          <div className="w-1/2 space-y-3">
            <div className="flex justify-between text-slate-500 text-sm">
              <span>Total HT</span>
              <span>{formatPrice(totalHT)}</span>
            </div>
            {totalVAT > 0 && (
              <div className="flex justify-between text-slate-500 text-sm">
                <span>TVA ({invoice.rows[0]?.vatRate || 20}%)</span>
                <span>{formatPrice(totalVAT)}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t-2 border-slate-100 pt-3">
              <span className="font-bold text-lg text-slate-900">Total TTC</span>
              <span className="font-bold text-2xl text-blue-600">
                {formatPrice(totalTTC)}
              </span>
            </div>
          </div>
        </div>

        {/* PIED DE PAGE */}
        <div className="border-t border-slate-100 pt-8 text-center text-xs text-slate-400">
          <p className="mb-2">Merci de votre confiance.</p>
          <p>
            En cas de retard de paiement, une pénalité de 3 fois le taux
            d&apos;intérêt légal sera appliquée.
          </p>
          {invoice.company.siret && (
            <p className="mt-2">
              SAS {invoice.company.name} au capital de 1000€ - SIRET{" "}
              {invoice.company.siret}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
