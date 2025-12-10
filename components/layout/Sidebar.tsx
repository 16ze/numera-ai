"use client";

/**
 * Composant Sidebar - Navigation principale de l'application
 * Fixe à gauche avec logo et liens de navigation
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListOrdered,
  FileText,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Configuration des liens de navigation
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
    href: "/factures",
    icon: FileText,
  },
  {
    name: "Clients",
    href: "/clients",
    icon: Users,
  },
  {
    name: "Paramètres",
    href: "/parametres",
    icon: Settings,
  },
];

/**
 * Composant Sidebar
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed left-0 top-0 h-screen w-64 border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            N
          </div>
          <span className="text-xl font-bold tracking-tight">Numera AI</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col space-y-1 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

