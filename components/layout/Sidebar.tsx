"use client";

/**
 * Composant Sidebar - Navigation principale de l'application
 * Fixe à gauche avec logo, liens de navigation et profil utilisateur Clerk
 */

import { cn } from "@/lib/utils";
import {
  FileText,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButtonWrapper } from "./UserButtonWrapper";

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
 * Composant Sidebar
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside data-sidebar className="fixed left-0 top-0 h-screen w-64 border-r bg-white flex flex-col print:hidden">
      {/* Logo - Design amélioré */}
      <div className="flex h-16 items-center border-b px-6 bg-gradient-to-r from-blue-50 to-white">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-lg shadow-md group-hover:shadow-lg transition-all duration-200 group-hover:scale-105">
            N
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
              Numera AI
            </span>
            <span className="text-xs text-slate-500 font-medium">
              CFO Virtuel
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col space-y-1 p-4 flex-1">
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

      {/* Profil utilisateur Clerk - Design amélioré */}
      <div className="border-t bg-gradient-to-r from-slate-50 to-white">
        <div className="p-4">
          <div className="flex items-center space-x-3 rounded-xl p-3 bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200">
            <UserButtonWrapper
              appearance={{
                elements: {
                  avatarBox: "h-11 w-11 ring-2 ring-blue-100 ring-offset-2",
                  userButtonTrigger: "focus:shadow-none hover:opacity-90 transition-opacity",
                },
              }}
              afterSignOutUrl="/sign-in"
              showName
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
