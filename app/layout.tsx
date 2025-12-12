import { frFR } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    <ClerkProvider
      localization={frFR}
      appearance={{
        // Configuration globale pour tous les composants Clerk
        variables: {
          colorPrimary: "#2563eb",
          colorText: "#1e293b",
          colorTextSecondary: "#64748b",
          colorInputBackground: "#ffffff",
          colorInputText: "#1e293b",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        },
      }}
    >
      <html lang="fr">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
