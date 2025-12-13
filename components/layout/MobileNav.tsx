"use client";

/**
 * Composant MobileNav - Navigation mobile avec menu hamburger
 * Affiche un header avec logo et bouton menu qui ouvre un Sheet (side panel)
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  FileText,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserButtonWrapper } from "./UserButtonWrapper";

/**
 * Configuration des liens de navigation (même que Sidebar)
 */
const navigationItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Transactions",
    href: "/transactions",
    icon: ListOrdered,
  },
  {
    name: "Factures",
    href: "/invoices",
    icon: FileText,
  },
  {
    name: "Clients",
    href: "/clients",
    icon: Users,
  },
  {
    name: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

/**
 * Composant MobileNav
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Header mobile fixe en haut */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white px-4 md:hidden">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-base shadow-sm">
            N
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Numera AI
            </span>
            <span className="text-[10px] text-slate-500 font-medium -mt-0.5">
              CFO Virtuel
            </span>
          </div>
        </Link>

        {/* Bouton Menu Hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Ouvrir le menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="text-left">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-lg shadow-md">
                    N
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight text-slate-900">
                      Numera AI
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      CFO Virtuel
                    </span>
                  </div>
                </div>
              </SheetTitle>
            </SheetHeader>

            {/* Navigation */}
            <nav className="flex flex-col space-y-1 p-4">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-blue-50 text-blue-600 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Profile dans le footer */}
            <div className="absolute bottom-0 left-0 right-0 border-t p-4 bg-slate-50">
              <div className="flex items-center gap-3 w-full">
                <UserButtonWrapper
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "h-10 w-10",
                      userButtonTrigger: "w-full",
                      userButtonBox: "w-full",
                    },
                  }}
                  afterSignOutUrl="/sign-in"
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}

