import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CabecalhoSistema from "@/components/CabecalhoSistema";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LUCIUS - Sistema de Controle Financeiro",
  description: "Sistema completo de controle financeiro para casa e loja",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {/* Cabeçalho do Sistema LUCIUS com Logos */}
          <CabecalhoSistema />

          {/* Conteúdo das páginas */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
