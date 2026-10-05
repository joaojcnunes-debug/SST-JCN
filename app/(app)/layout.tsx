"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { cn } from "@/lib/utils";

// Tela de preenchimento da inspeção (/inspecoes/INS-…) usa a largura toda
// (2026-10-05): as abas e tabelas têm muita coluna. As demais telas seguem
// limitadas a 1400px.
const TELA_LARGA = /^\/inspecoes\/(?!nova$|ficha$)[^/]+$/;

export default function AppLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("painel");
  const larga = TELA_LARGA.test(usePathname() ?? "");

  return (
    <div className="app-aurora min-h-screen print:bg-white">
      <Sidebar />
      <div className="md:pl-[220px] print:pl-0">
        <Topbar />
        <main
          className={cn("mx-auto px-4 py-6 md:px-6 print:p-0", larga ? "max-w-none" : "max-w-[1400px]")}
          style={{ viewTransitionName: "content" }}
        >{children}</main>
      </div>
    </div>
  );
}
