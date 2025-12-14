"use client";

/**
 * Composant OverdueAlerts - Affiche les alertes de factures en retard
 * Le "Bad Cop" - Centre de tir pour les relances
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getOverdueInvoices, generateReminderEmail, sendReminderEmail } from "@/app/actions/reminders";
import type { OverdueInvoice } from "@/app/actions/reminders";
import { Mail, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Formate un montant en euros
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function OverdueAlerts() {
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<OverdueInvoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Chargement des factures en retard
  useEffect(() => {
    const loadOverdueInvoices = async () => {
      try {
        setIsLoading(true);
        const invoices = await getOverdueInvoices();
        setOverdueInvoices(invoices);
      } catch (error) {
        console.error("Erreur lors du chargement des factures en retard:", error);
        toast.error("Erreur lors du chargement des factures en retard");
      } finally {
        setIsLoading(false);
      }
    };

    loadOverdueInvoices();
  }, []);

  // Gestion du clic sur "Relancer"
  const handleRemindClick = async (invoice: OverdueInvoice) => {
    if (!invoice.clientEmail) {
      toast.error(`Le client "${invoice.clientName}" n'a pas d'adresse email. Ajoutez un email au client avant de relancer.`);
      return;
    }

    setSelectedInvoice(invoice);
    setIsDialogOpen(true);
    setEmailSubject("");
    setEmailBody("");

    // Génération automatique de l'email
    try {
      setIsGenerating(true);
      const emailData = await generateReminderEmail(invoice.id);
      setEmailSubject(emailData.subject);
      setEmailBody(emailData.body);
      toast.success("Email de relance généré par l'IA");
    } catch (error) {
      console.error("Erreur lors de la génération de l'email:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la génération de l'email de relance"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Envoi de l'email de relance
  const handleSendReminder = async () => {
    if (!selectedInvoice) return;

    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Le sujet et le corps de l'email sont requis");
      return;
    }

    try {
      setIsSending(true);
      await sendReminderEmail(selectedInvoice.id, emailSubject, emailBody);
      toast.success(`Relance envoyée à ${selectedInvoice.clientName}`);
      setIsDialogOpen(false);
      
      // Recharger la liste des factures en retard
      const invoices = await getOverdueInvoices();
      setOverdueInvoices(invoices);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'envoi de l'email de relance"
      );
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Chargement des factures...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si tout est à jour
  if (overdueInvoices.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-900">Tout est à jour 👍</p>
              <p className="text-sm text-green-700">
                Aucune facture en retard
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si des factures sont en retard
  return (
    <>
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-900">
              ⚠️ {overdueInvoices.length} Facture{overdueInvoices.length > 1 ? "s" : ""} en retard
            </CardTitle>
          </div>
          <CardDescription className="text-red-700">
            Des factures nécessitent une relance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {overdueInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between rounded-lg border border-red-200 bg-white p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {invoice.clientName}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      - {invoice.number}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm">
                    <span className="font-medium text-slate-700">
                      {formatCurrency(invoice.totalAmount)}
                    </span>
                    <span
                      className={`font-semibold ${
                        invoice.daysOverdue >= 15
                          ? "text-red-600"
                          : "text-orange-600"
                      }`}
                    >
                      {invoice.daysOverdue} jour{invoice.daysOverdue > 1 ? "s" : ""} de retard
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => handleRemindClick(invoice)}
                  disabled={!invoice.clientEmail}
                  variant="outline"
                  size="sm"
                  className="ml-4"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Relancer
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modale de relance */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Relance - Facture {selectedInvoice?.number}</DialogTitle>
            <DialogDescription>
              Email de relance pour {selectedInvoice?.clientName}
            </DialogDescription>
          </DialogHeader>

          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-3 text-sm text-muted-foreground">
                L&apos;IA rédige la relance...
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sujet de l'email */}
              <div className="space-y-2">
                <Label htmlFor="email-subject">Sujet</Label>
                <Textarea
                  id="email-subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Sujet de l'email..."
                  className="min-h-[60px]"
                />
              </div>

              {/* Corps de l'email */}
              <div className="space-y-2">
                <Label htmlFor="email-body">Corps du message</Label>
                <Textarea
                  id="email-body"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Corps de l'email..."
                  className="min-h-[200px]"
                />
              </div>

              {/* Boutons d'action */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSending}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSendReminder}
                  disabled={isSending || !emailSubject.trim() || !emailBody.trim()}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      🚀 Envoyer la relance
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
