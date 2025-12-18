"use client";

/**
 * Composant Sidebar - Navigation principale de l'application
 * Sidebar réduite par défaut (w-20) qui s'élargit au survol (w-64)
 * Design glassmorphism avec transitions fluides
 */

import { cn } from "@/lib/utils";
import {
  Calculator,
  FileText,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Users,
  FolderOpen,
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
    name: "Rentabilité",
    href: "/profitability",
    icon: Calculator,
  },
  {
    name: "Documents",
    href: "/documents",
    icon: FolderOpen,
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
    <aside
      data-sidebar
      className="group fixed left-0 top-0 h-screen w-20 hover:w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/50 shadow-lg flex flex-col print:hidden transition-all duration-300 ease-in-out z-50"
    >
      {/* Logo - Design épuré avec animation */}
      <div className="flex h-16 items-center border-b border-slate-200/50 px-2 group-hover:px-6 bg-white/50 transition-all duration-300">
        <Link
          href="/"
          className="flex items-center justify-center w-full group/logo"
        >
          {/* Logo toujours visible, taille adaptative */}
          <img
            src="/logo.png"
            alt="Numera AI"
            className="h-10 w-10 object-contain transition-all duration-300 group-hover:h-12 group-hover:w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col space-y-1 p-2 group-hover:p-4 flex-1 transition-all duration-300">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center group-hover:justify-start rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative",
                "group-hover:space-x-3",
                isActive
                  ? "bg-slate-900 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              title={item.name}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap overflow-hidden transition-all duration-300",
                  "max-w-0 opacity-0 group-hover:max-w-full group-hover:opacity-100 group-hover:ml-3"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Profil utilisateur Clerk */}
      <div className="border-t border-slate-200/50 p-2 group-hover:p-4 transition-all duration-300 bg-white/50">
        <div className="flex items-center justify-center group-hover:justify-start w-full transition-all duration-300">
          <div className="flex items-center justify-center group-hover:justify-start w-full gap-3">
            <UserButtonWrapper
              appearance={{
                elements: {
                  avatarBox: "h-10 w-10 transition-all duration-300",
                  userButtonTrigger:
                    "focus:shadow-none transition-all duration-300",
                  userButtonBox:
                    "flex items-center justify-center group-hover:justify-start transition-all duration-300",
                },
              }}
              afterSignOutUrl="/sign-in"
              showName={false}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
