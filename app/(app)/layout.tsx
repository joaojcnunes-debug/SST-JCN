"use client";

import { type ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

export default function AppLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("painel");

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-[220px] print:pl-0">
        <Topbar />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
