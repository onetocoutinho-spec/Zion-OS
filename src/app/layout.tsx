import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { AvisoDeVersao } from "@/components/layout/AvisoDeVersao";
import { AuthGate } from "@/components/auth/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zion OS — Zion Company",
  description:
    "Sistema interno da Zion Company para gestão de clientes, produtos, anúncios e agentes de IA em marketplaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* FORA do AuthGate de propósito: uma aba velha precisa avisar mesmo
            na tela de login e mesmo quando o perfil falhou — são justamente os
            estados em que o pacote antigo pode estar causando o problema. */}
        <AvisoDeVersao />
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
