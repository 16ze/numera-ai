"use client";

/**
 * Composant client pour gérer la liste des comptes bancaires
 */

import { useState } from "react";
import { ConnectBankButton } from "@/components/bank/ConnectBankButton";
import { syncTransactions, deleteBankAccount } from "@/app/actions/bank";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Building2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Type pour un compte bancaire
 */
type BankAccount = {
  id: string;
  bankName: string;
  mask: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
};

/**
 * Props du composant
 */
interface BankAccountsClientProps {
  initialBankAccounts: BankAccount[];
}

/**
 * Composant client pour afficher et gérer les comptes bancaires
 */
export function BankAccountsClient({
  initialBankAccounts,
}: BankAccountsClientProps) {
  const [bankAccounts, setBankAccounts] = useState(initialBankAccounts);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * Rafraîchir la liste des comptes
   */
  const handleRefresh = () => {
    window.location.reload();
  };

  /**
   * Synchronise les transactions d'un compte
   */
  const handleSync = async (bankAccountId: string) => {
    setSyncingId(bankAccountId);

    try {
      const result = await syncTransactions(bankAccountId);
      toast.success(
        `${result.addedCount} nouvelle(s) transaction(s) synchronisée(s) !`
      );
      handleRefresh();
    } catch (error) {
      console.error("Erreur sync:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la synchronisation"
      );
    } finally {
      setSyncingId(null);
    }
  };

  /**
   * Supprime un compte bancaire
   */
  const handleDelete = async (bankAccountId: string, bankName: string) => {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir déconnecter le compte ${bankName} ?`
      )
    ) {
      return;
    }

    setDeletingId(bankAccountId);

    try {
      await deleteBankAccount(bankAccountId);
      toast.success("Compte bancaire déconnecté");
      setBankAccounts((prev) => prev.filter((acc) => acc.id !== bankAccountId));
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la déconnexion");
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Formate une date
   */
  const formatDate = (date: Date | null): string => {
    if (!date) return "Jamais";
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Carte de connexion */}
      <Card>
        <CardHeader>
          <CardTitle>Vos comptes bancaires</CardTitle>
          <CardDescription>
            Connectez vos comptes bancaires pour synchroniser automatiquement vos transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectBankButton onSuccess={handleRefresh} />
        </CardContent>
      </Card>

      {/* Liste des comptes connectés */}
      {bankAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comptes connectés ({bankAccounts.length})</CardTitle>
            <CardDescription>
              Gérez vos comptes bancaires et synchronisez vos transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banque</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Dernière sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">{account.bankName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.mask ? (
                        <Badge variant="secondary" className="font-mono">
                          •••• {account.mask}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Non disponible
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {formatDate(account.lastSyncedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          onClick={() => handleSync(account.id)}
                          disabled={syncingId === account.id}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          {syncingId === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Synchroniser
                        </Button>
                        <Button
                          onClick={() =>
                            handleDelete(account.id, account.bankName)
                          }
                          disabled={deletingId === account.id}
                          variant="outline"
                          size="sm"
                          className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingId === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Déconnecter
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Message si aucun compte */}
      {bankAccounts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun compte bancaire connecté
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cliquez sur le bouton ci-dessus pour connecter votre premier
                compte
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

