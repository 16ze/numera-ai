"use client";

/**
 * Composant Client pour la page des Transactions
 * Gère l'état local, la sélection, les filtres, l'édition et la suppression
 */

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionCategory, TransactionType } from "@prisma/client";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Edit, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { TransactionWithCompany } from "../actions/transactions";
import {
  deleteManyTransactions,
  deleteTransaction,
  updateTransaction,
} from "../actions/transactions-management";

/**
 * Props du composant TransactionsPageClient
 */
interface TransactionsPageClientProps {
  initialTransactions: TransactionWithCompany[];
}

/**
 * Catégories de transactions pour l'affichage
 */
const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  TRANSPORT: "Transport",
  REPAS: "Repas",
  MATERIEL: "Matériel",
  PRESTATION: "Prestation",
  IMPOTS: "Impôts",
  SALAIRES: "Salaires",
  AUTRE: "Autre",
};

/**
 * Formate le montant en euros
 */
function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Formate la date pour l'affichage
 */
function formatDate(date: Date): string {
  return format(new Date(date), "dd/MM/yyyy", { locale: fr });
}

/**
 * Convertit une date en format YYYY-MM-DD pour les inputs
 */
function dateToInputFormat(date: Date): string {
  return format(new Date(date), "yyyy-MM-dd");
}

/**
 * Composant Client pour la page des Transactions
 */
export function TransactionsPageClient({
  initialTransactions,
}: TransactionsPageClientProps) {
  const [transactions] =
    useState<TransactionWithCompany[]>(initialTransactions);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithCompany | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionWithCompany | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Données pour l'édition
  const [editData, setEditData] = useState({
    description: "",
    amount: 0,
    date: "",
    category: "AUTRE" as TransactionCategory,
    type: "EXPENSE" as TransactionType,
  });

  /**
   * Filtre les transactions selon la recherche et la date
   */
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filtre par recherche textuelle
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.description?.toLowerCase().includes(query) ||
          CATEGORY_LABELS[tx.category].toLowerCase().includes(query)
      );
    }

    // Filtre par date
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.date);
        return (
          txDate.getFullYear() === filterDate.getFullYear() &&
          txDate.getMonth() === filterDate.getMonth() &&
          txDate.getDate() === filterDate.getDate()
        );
      });
    }

    return filtered;
  }, [transactions, searchQuery, dateFilter]);

  /**
   * Ouvre le dialog d'édition
   */
  const handleEditClick = (transaction: TransactionWithCompany) => {
    setEditingTransaction(transaction);
    setEditData({
      description: transaction.description || "",
      amount: transaction.amount,
      date: dateToInputFormat(transaction.date),
      category: transaction.category,
      type: transaction.type,
    });
    setEditDialogOpen(true);
  };

  /**
   * Sauvegarde les modifications
   */
  const handleSaveEdit = async () => {
    if (!editingTransaction) return;

    // Validation côté client
    if (editData.amount === 0) {
      toast.error("Le montant ne peut pas être égal à 0");
      return;
    }

    if (!editData.description.trim()) {
      toast.error("La description est requise");
      return;
    }

    try {
      setIsSaving(true);

      // Préparer les données à mettre à jour (ne pas inclure les valeurs invalides)
      const updateData: {
        description?: string;
        amount?: number;
        date?: string;
        category?: TransactionCategory;
      } = {};

      if (editData.description.trim()) {
        updateData.description = editData.description;
      }

      // Envoyer amount si la valeur n'est pas 0 (peut être négatif pour les dépenses)
      if (editData.amount !== 0) {
        updateData.amount = editData.amount;
      }

      if (editData.date) {
        updateData.date = editData.date;
      }

      if (editData.category) {
        updateData.category = editData.category;
      }

      await updateTransaction(editingTransaction.id, updateData);

      toast.success("Transaction mise à jour avec succès !");
      setEditDialogOpen(false);

      // Recharger la page pour récupérer les données mises à jour
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour de la transaction"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Ouvre le dialog de suppression
   */
  const handleDeleteClick = (transaction: TransactionWithCompany) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  /**
   * Confirme la suppression d'une transaction
   */
  const handleConfirmDelete = async () => {
    if (!selectedTransaction) return;

    try {
      setIsDeleting(true);

      await deleteTransaction(selectedTransaction.id);

      toast.success("Transaction supprimée avec succès !");
      setDeleteDialogOpen(false);
      setSelectedTransaction(null);

      // Recharger la page
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression de la transaction"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Supprime les transactions sélectionnées
   */
  const handleBulkDelete = async () => {
    // Récupérer les IDs réels des transactions sélectionnées
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => row.original.id);

    if (selectedIds.length === 0) {
      toast.error("Aucune transaction sélectionnée");
      return;
    }

    try {
      setIsDeleting(true);

      const result = await deleteManyTransactions(selectedIds);

      toast.success(
        `${result.count} transaction(s) supprimée(s) avec succès !`
      );
      setRowSelection({});

      // Recharger la page
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression des transactions"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Définition des colonnes de la table
   */
  const columns: ColumnDef<TransactionWithCompany>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Sélectionner tout"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Sélectionner la ligne"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.date),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) =>
          row.original.description || (
            <span className="text-muted-foreground italic">
              Sans description
            </span>
          ),
      },
      {
        accessorKey: "category",
        header: "Catégorie",
        cell: ({ row }) => (
          <Badge variant="outline">
            {CATEGORY_LABELS[row.original.category]}
          </Badge>
        ),
      },
      {
        accessorKey: "amount",
        header: "Montant",
        cell: ({ row }) => {
          const tx = row.original;
          // Utiliser le signe réel du montant plutôt que le type de transaction
          const isPositive = tx.amount >= 0;
          const displayAmount = Math.abs(tx.amount);

          return (
            <div
              className={`text-right font-bold ${
                isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {isPositive ? "+" : "-"}
              {formatMoney(displayAmount)}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const transaction = row.original;
          return (
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditClick(transaction)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(transaction)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  /**
   * Configuration de TanStack Table
   */
  const table = useReactTable({
    data: filteredTransactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <>
      {/* Filtres et actions */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-4 items-center">
            {/* Recherche textuelle */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (description, catégorie)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtre par date */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 w-[180px]"
                placeholder="Filtrer par date"
              />
              {dateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setDateFilter("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Bouton Bulk Delete */}
          {selectedCount > 0 && (
            <Button
              variant="default"
              onClick={() => {
                if (
                  confirm(
                    `Êtes-vous sûr de vouloir supprimer ${selectedCount} transaction(s) ?`
                  )
                ) {
                  handleBulkDelete();
                }
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer la sélection ({selectedCount})
            </Button>
          )}
        </div>

        {/* Résumé des résultats */}
        <div className="text-sm text-muted-foreground">
          {filteredTransactions.length} transaction(s){" "}
          {searchQuery || dateFilter ? "trouvée(s)" : "au total"}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Aucune transaction trouvée.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Précédent
          </Button>
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} sur{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </Button>
        </div>
      )}

      {/* Dialog d'édition */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier la transaction</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la transaction ci-dessous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editData.description}
                onChange={(e) =>
                  setEditData({ ...editData, description: e.target.value })
                }
                placeholder="Description de la transaction"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Montant</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editData.amount}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editData.date}
                  onChange={(e) =>
                    setEditData({ ...editData, date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Catégorie</Label>
              <Select
                id="edit-category"
                value={editData.category}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    category: e.target.value as TransactionCategory,
                  })
                }
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette transaction ? Cette
              action est irréversible.
              {selectedTransaction && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="font-semibold">
                    {selectedTransaction.description || "Sans description"}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatDate(selectedTransaction.date)} •{" "}
                    {formatMoney(selectedTransaction.amount)}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
