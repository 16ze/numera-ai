import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserNav } from "@/components/layout/UserNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Numera AI - Comptabilité pour entrepreneurs",
  description: "SaaS de comptabilité intelligent pour entrepreneurs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}
      >
        <div className="flex h-screen">
          {/* Sidebar fixe à gauche */}
          <Sidebar />

          {/* Contenu principal */}
          <div className="flex flex-1 flex-col ml-64">
            {/* Header avec UserNav */}
            <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b bg-white px-6">
              <UserNav />
            </header>

            {/* Contenu de la page */}
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
