"use client";

/**
 * Composant MobileNav - Navigation mobile avec menu hamburger
 * Affiche un header avec logo et bouton menu qui ouvre un Sheet (side panel)
 */

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  FileText,
  LayoutDashboard,
  ListOrdered,
  Menu,
  Settings,
  Users,
  Calculator,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
    name: "Rentabilité",
    href: "/profitability",
    icon: Calculator,
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
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Éviter les problèmes d'hydratation en rendant le Sheet uniquement côté client
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Header mobile fixe en haut */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white px-4 md:hidden">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img
            src="/logo.png"
            alt="Numera AI"
            className="h-10 w-auto object-contain"
          />
        </Link>

        {/* Bouton Menu Hamburger - Rendu uniquement côté client pour éviter les problèmes d'hydratation */}
        {mounted ? (
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
                  <div className="flex items-center justify-center">
                    <img
                      src="/logo.png"
                      alt="Numera AI"
                      className="h-12 w-auto object-contain"
                    />
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
                          ? "bg-slate-900 text-white shadow-sm"
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
                        avatarBox: "h-10 w-10",
                        userButtonTrigger: "focus:shadow-none w-full gap-3",
                        userButtonBox:
                          "w-full flex items-center gap-3 justify-center",
                      },
                    }}
                    afterSignOutUrl="/sign-in"
                    showName
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          // Placeholder pendant le SSR pour éviter le décalage de layout
          <Button variant="ghost" size="icon" className="md:hidden" disabled>
            <Menu className="h-6 w-6" />
            <span className="sr-only">Ouvrir le menu</span>
          </Button>
        )}
      </header>
    </>
  );
}
