"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

export default function HubLayout({ children }: { children: ReactNode }) {
  useAuth();
  return <>{children}</>;
}
