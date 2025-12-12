/**
 * Page de visualisation d'une facture
 * Design professionnel A4 imprimable conforme à la législation française
 * Refonte UI/UX avec typographie optimisée et alignements précis
 */

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth-helper";
import { PrintButton } from "@/components/invoices/PrintButton";
import { InvoiceActions } from "@/components/invoices/InvoiceActions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Page de visualisation d'une facture
 * Format A4 professionnel conforme à la législation française
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }> | { invoiceId: string };
}) {
  // Gérer les params synchrones et asynchrones (Next.js 15+)
  const resolvedParams =
    typeof params === "object" && "then" in params ? await params : params;

  const invoiceId = resolvedParams.invoiceId;

  if (!invoiceId) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

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

  if (!invoice || invoice.company.userId !== user.id) return notFound();

  // --- LOGIQUE LEGALE ---
  const isAutoEntrepreneur = invoice.company.isAutoEntrepreneur;
  const showVAT = !isAutoEntrepreneur;

  // Calculs
  const totalHT = invoice.rows.reduce(
    (acc, row) => acc + Number(row.quantity) * Number(row.unitPrice),
    0
  );

  // Si auto-entrepreneur, la TVA est de 0
  const totalVAT = showVAT
    ? invoice.rows.reduce(
        (acc, row) =>
          acc +
          Number(row.quantity) *
            Number(row.unitPrice) *
            (Number(row.vatRate) / 100),
        0
      )
    : 0;

  const totalTTC = totalHT + totalVAT;

  /**
   * Formate un montant en euros
   */
  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);

  /**
   * Formate une date en français complet
   */
  const formatDate = (date: Date | string) => {
    return format(new Date(date), "d MMMM yyyy", { locale: fr });
  };

  return (
    <div className="flex flex-col items-center gap-8 py-8 bg-slate-50 min-h-screen">
      {/* Barre d'actions */}
      <div className="w-full max-w-[210mm] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden px-4 md:px-0">
        <Link
          href="/invoices"
          className="flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Link>
        <div className="flex items-center gap-4 flex-wrap">
          <InvoiceActions invoiceId={invoiceId} currentStatus={invoice.status} />
          <PrintButton />
        </div>
      </div>

      {/* --- FACTURE A4 --- */}
      <div
        id="invoice-print-area"
        className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg text-slate-900 print:shadow-none print:w-full flex flex-col"
        style={{ aspectRatio: "210 / 297" }}
      >
        {/* Contenu principal avec padding */}
        <div className="flex-1 flex flex-col p-[15mm]">
          {/* 1. EN-TÊTE & VENDEUR */}
          <div className="flex justify-between items-start mb-12">
            <div className="w-1/2">
              {/* Logo ou nom de l'entreprise */}
              <div className="flex items-start gap-4 mb-2">
                {invoice.company.logoUrl ? (
                  <img
                    src={invoice.company.logoUrl}
                    alt={`Logo ${invoice.company.name}`}
                    className="max-w-32 max-h-32 object-contain"
                    style={{ maxWidth: "128px", maxHeight: "128px" }}
                  />
                ) : (
                  <h1 className="text-xl font-bold uppercase tracking-normal">
                    {invoice.company.name}
                  </h1>
                )}
              </div>
              {invoice.company.logoUrl && (
                <h2 className="text-lg font-semibold text-slate-700 mt-2">
                  {invoice.company.name}
                </h2>
              )}
              <div className="text-sm text-slate-600 space-y-1">
                {invoice.company.address && (
                  <p className="tracking-normal">{invoice.company.address}</p>
                )}
                <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                  {invoice.company.siret && (
                    <p className="tracking-normal">
                      SIRET : {invoice.company.siret}
                    </p>
                  )}
                  {invoice.company.apeCode && (
                    <p className="tracking-normal">
                      Code APE : {invoice.company.apeCode}
                    </p>
                  )}
                  {invoice.company.vatNumber && (
                    <p className="tracking-normal">
                      TVA Intra : {invoice.company.vatNumber}
                    </p>
                  )}
                  {invoice.company.legalForm && (
                    <p className="tracking-normal">
                      Forme : {invoice.company.legalForm}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-3xl font-light text-slate-300 tracking-normal">
                FACTURE
              </h2>
              <p className="font-bold text-slate-700 mt-1 tracking-normal">
                N° {invoice.number}
              </p>
            </div>
          </div>

          {/* 2. DATES & CLIENT */}
          <div className="flex justify-between mb-16 border-t border-b border-slate-100 py-6">
            <div className="space-y-1 text-sm">
              <p className="tracking-normal">
                <span className="font-semibold text-slate-700">
                  Date d&apos;émission :
                </span>{" "}
                {formatDate(invoice.issuedDate)}
              </p>
              {invoice.dueDate && (
                <p className="tracking-normal">
                  <span className="font-semibold text-slate-700">
                    Date d&apos;échéance :
                  </span>{" "}
                  {formatDate(invoice.dueDate)}
                </p>
              )}
              <p className="tracking-normal">
                <span className="font-semibold text-slate-700">
                  Conditions :
                </span>{" "}
                {invoice.paymentTerms || "Paiement à 30 jours"}
              </p>
            </div>

            <div className="text-right w-1/3">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-normal">
                Facturé à
              </p>
              <p className="font-bold text-lg tracking-normal">
                {invoice.client.name}
              </p>
              {invoice.client.address && (
                <p className="text-slate-600 text-sm whitespace-pre-line tracking-normal mt-1">
                  {invoice.client.address}
                </p>
              )}
              {invoice.client.vatIntra && (
                <p className="text-xs text-slate-500 mt-1 tracking-normal">
                  TVA: {invoice.client.vatIntra}
                </p>
              )}
            </div>
          </div>

          {/* 3. LIGNES DE FACTURE */}
          <div className="mb-8 flex-1">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-800">
                  <th className="text-left py-3 text-sm font-bold uppercase tracking-normal">
                    Désignation
                  </th>
                  <th className="text-right py-3 text-sm font-bold uppercase tracking-normal w-20">
                    Qté
                  </th>
                  <th className="text-right py-3 text-sm font-bold uppercase tracking-normal w-32">
                    Prix U. HT
                  </th>
                  {showVAT && (
                    <th className="text-right py-3 text-sm font-bold uppercase tracking-normal w-20">
                      TVA
                    </th>
                  )}
                  <th className="text-right py-3 text-sm font-bold uppercase tracking-normal w-32">
                    Total HT
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {invoice.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 tracking-normal"
                  >
                    <td className="py-3 text-slate-700 text-left">
                      {row.description}
                    </td>
                    <td className="py-3 text-slate-500 text-right">
                      {Number(row.quantity)}
                    </td>
                    <td className="py-3 text-slate-500 text-right">
                      {formatPrice(Number(row.unitPrice))}
                    </td>
                    {showVAT && (
                      <td className="py-3 text-slate-500 text-right">
                        {Number(row.vatRate)}%
                      </td>
                    )}
                    <td className="py-3 text-slate-900 font-medium text-right">
                      {formatPrice(Number(row.quantity) * Number(row.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. TOTAUX */}
          <div className="flex justify-end mb-8">
            <div className="w-1/2 bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between text-slate-600 text-sm mb-2 tracking-normal">
                <span>Total HT</span>
                <span className="font-semibold">{formatPrice(totalHT)}</span>
              </div>

              {showVAT ? (
                <div className="flex justify-between text-slate-600 text-sm mb-2 tracking-normal">
                  <span>Total TVA</span>
                  <span>{formatPrice(totalVAT)}</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-right mb-2 italic tracking-normal">
                  TVA non applicable, art. 293 B du CGI
                </div>
              )}

              <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-2 tracking-normal">
                <span className="font-bold text-lg text-slate-900">
                  Net à payer
                </span>
                <span className="font-bold text-2xl text-blue-600">
                  {formatPrice(totalTTC)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. MENTIONS LÉGALES OBLIGATOIRES (Footer fixé en bas) */}
        <div className="border-t border-slate-100 p-[15mm] pt-4 mt-auto">
          <div className="text-[10px] text-slate-400 text-center leading-relaxed tracking-normal">
            <p>
              En cas de retard de paiement, application d&apos;une pénalité
              égale à 3 fois le taux d&apos;intérêt légal.
            </p>
            <p>
              Une indemnité forfaitaire de 40 € est due pour frais de
              recouvrement (Articles L441-6 et D441-5 du Code de commerce).
            </p>
            <p>Pas d&apos;escompte pour paiement anticipé.</p>
            <p className="mt-2 font-medium text-slate-500">
              {invoice.company.name} —{" "}
              {invoice.company.legalForm || "Entreprise"} au capital de{" "}
              {invoice.company.capital || "0"} € — SIRET :{" "}
              {invoice.company.siret}
              {invoice.company.apeCode && (
                <> — APE : {invoice.company.apeCode}</>
              )}
            </p>
            {/* Mention spécifique Auto-entrepreneur */}
            {isAutoEntrepreneur && (
              <p className="mt-1 font-bold">
                TVA non applicable, art. 293 B du CGI
              </p>
            )}
            {/* Mentions légales personnalisées */}
            {invoice.legalMentions && (
              <p className="mt-2 text-slate-500">{invoice.legalMentions}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
