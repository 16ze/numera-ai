"use client";

/**
 * Composant BankBalanceCard - Affiche les soldes des comptes bancaires connectés
 * Affiche la liste des comptes bancaires avec leurs soldes actuels
 * Permet de supprimer des comptes avec confirmation
 */

import type { BankAccountData } from "@/app/(dashboard)/actions/dashboard";
import { deleteBankAccount } from "@/app/actions/bank";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

interface BankBalanceCardProps {
  bankAccounts: BankAccountData[];
}

export function BankBalanceCard({ bankAccounts }: BankBalanceCardProps) {
  const router = useRouter();
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Protection contre undefined
  const accounts = bankAccounts || [];

  // Calcul du total de tous les comptes
  const totalBalance = accounts.reduce((sum, acc) => {
    return sum + (acc.currentBalance ?? 0);
  }, 0);

  // Formatage de l'affichage du montant
  const formatMoney = (amount: number | null, currency: string = "EUR") => {
    if (amount === null) return "N/A";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  /**
   * Gère la suppression d'un compte bancaire
   */
  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      setIsDeleting(true);
      await deleteBankAccount(accountToDelete);
      toast.success("Compte supprimé avec succès");
      setAccountToDelete(null);
      // Rafraîchir la page pour mettre à jour les données
      router.refresh();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression du compte"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Ouvre le dialog de confirmation pour supprimer un compte
   */
  const openDeleteDialog = (accountId: string) => {
    setAccountToDelete(accountId);
  };

  // Si aucun compte connecté
  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Comptes Bancaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Aucun compte bancaire connecté
            </p>
            <Link href="/settings/bank">
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Connecter un compte
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5" />
          Comptes Bancaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Liste des comptes */}
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 group hover:bg-muted/50 rounded-lg px-2 py-2 -mx-2 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{account.bankName}</p>
                  <p className="text-sm text-muted-foreground">
                    ••••{account.mask || "****"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-lg">
                    {formatMoney(account.currentBalance, account.currency)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => openDeleteDialog(account.id)}
                  title="Supprimer ce compte"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Total */}
          {accounts.length > 1 && (
            <div className="flex items-center justify-between border-t pt-4 mt-4">
              <p className="font-semibold">Total</p>
              <p className="font-bold text-xl">
                {formatMoney(totalBalance, accounts[0]?.currency || "EUR")}
              </p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog
        open={accountToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setAccountToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte bancaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le compte et toutes ses
              transactions associées seront supprimés définitivement. Êtes-vous
              sûr de vouloir continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
