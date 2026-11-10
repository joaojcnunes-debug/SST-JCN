"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { voltaSegura } from "@/lib/inspecoes/volta";

/**
 * A lista de onde esta inspeção foi aberta (?volta=, com os filtros). Fica guardada por inspeção nesta
 * aba: ir do relatório ao editor e voltar não perde o caminho, mesmo que o link interno não leve o parâmetro.
 */
export function useVoltaInspecao(id: string): string | null {
  const daUrl = voltaSegura(useSearchParams().get("volta"));
  const [guardada, setGuardada] = useState<string | null>(null);
  useEffect(() => {
    const chave = `inspecao-volta:${id}`;
    try {
      if (daUrl) sessionStorage.setItem(chave, daUrl);
      else setGuardada(voltaSegura(sessionStorage.getItem(chave)));
    } catch { /* sem storage: vale só o endereço */ }
  }, [id, daUrl]);
  return daUrl ?? guardada;
}
