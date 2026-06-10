"use client";

import { useEffect } from "react";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";

function getElectron() {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { electronAPI?: { updateWindowIcon?: (url: string) => Promise<void> } }).electronAPI;
}

export default function ElectronIconSync() {
  const { data: configs } = useConfiguracoes();

  useEffect(() => {
    const api = getElectron();
    if (!api?.updateWindowIcon || !configs?.logo_url) return;
    api.updateWindowIcon(configs.logo_url).catch(() => {});
  }, [configs?.logo_url]);

  return null;
}
