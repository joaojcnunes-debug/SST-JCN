import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/lib/providers";
import UpdateBanner from "@/components/UpdateBanner";
import ElectronIconSync from "@/components/ElectronIconSync";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SST · JCN Consultoria",
  description: "Sistema de gestão de inspeções de Segurança e Saúde do Trabalho",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <UpdateBanner />
          <ElectronIconSync />
        </Providers>
      </body>
    </html>
  );
}
