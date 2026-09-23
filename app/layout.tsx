import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/lib/providers";
import UpdateBanner from "@/components/UpdateBanner";
import ElectronIconSync from "@/components/ElectronIconSync";
import PageTransitions from "@/components/PageTransitions";
import TopProgressBar from "@/components/TopProgressBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SST JCN Consultoria",
  description: "Sistema de gestão de inspeções de Segurança e Saúde do Trabalho",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/* Aplica a sidebar recolhida ANTES da 1ª pintura (sem flash). Lê a
            mesma chave/forma do zustand persist (useSidebarMini → "sidebar-mini").
            Como isto muda atributos do <html> antes da hidratação, o <html>
            leva suppressHydrationWarning. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('sidebar-mini');if(s&&JSON.parse(s).state.mini){document.documentElement.setAttribute('data-sidebar','mini');}}catch(e){}})();`,
          }}
        />
        <Providers>
          <PageTransitions />
          <TopProgressBar />
          {children}
          <UpdateBanner />
          <ElectronIconSync />
        </Providers>
      </body>
    </html>
  );
}
