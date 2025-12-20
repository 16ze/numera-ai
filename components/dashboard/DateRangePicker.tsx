"use client";

/**
 * Composant DateRangePicker - Sélecteur de plage de dates
 * Permet de filtrer les données du dashboard par période
 * Utilise les paramètres d'URL pour persister la sélection
 */

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr as dateFnsFr } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { fr } from "react-day-picker/locale";

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  // Initialiser les dates depuis l'URL au chargement
  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (from && to) {
      try {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
          setDate({
            from: fromDate,
            to: toDate,
          });
        }
      } catch (error) {
        console.error("Erreur lors du parsing des dates de l'URL:", error);
      }
    }
  }, [searchParams]);

  /**
   * Met à jour l'URL avec les paramètres de date
   */
  const updateURL = (fromDate: Date | undefined, toDate: Date | undefined) => {
    const params = new URLSearchParams(searchParams.toString());

    if (fromDate && toDate) {
      params.set("from", format(fromDate, "yyyy-MM-dd"));
      params.set("to", format(toDate, "yyyy-MM-dd"));
    } else {
      params.delete("from");
      params.delete("to");
    }

    // Mettre à jour l'URL sans recharger la page
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  /**
   * Gère la sélection d'une plage de dates
   */
  const handleSelect = (range: DateRange | undefined) => {
    setDate(range);

    // Si les deux dates sont sélectionnées, mettre à jour l'URL
    if (range?.from && range?.to) {
      updateURL(range.from, range.to);
      setIsOpen(false); // Fermer le popover après sélection
    }
  };

  /**
   * Efface le filtre de date
   */
  const handleClear = () => {
    setDate(undefined);
    updateURL(undefined, undefined);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, "dd/MM/yyyy", { locale: fr })} -{" "}
                {format(date.to, "dd/MM/yyyy", { locale: fr })}
              </>
            ) : (
              format(date.from, "dd/MM/yyyy", { locale: fr })
            )
          ) : (
            <span>Période (mois en cours)</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={fr}
          />
          {date?.from && date?.to && (
            <div className="flex items-center justify-between border-t pt-3 mt-3">
              <div className="text-sm text-muted-foreground">
                {format(date.from, "dd/MM/yyyy", { locale: dateFnsFr })} -{" "}
                {format(date.to, "dd/MM/yyyy", { locale: dateFnsFr })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-8 px-2"
              >
                <X className="h-4 w-4" />
                Effacer
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
