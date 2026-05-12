"use client";

import { type ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/lib/hooks/useAuth";

export default function AppLayout({ children }: { children: ReactNode }) {
  useAuth();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-[220px]">
        <Topbar />
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
