"use client";

import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import { useUnidadeAtiva } from "@/lib/store";

/**
 * Chip global "Unidade: X · ✕ ver todas". Aparece quando há uma unidade ativa
 * (escolhida na Visão Geral). O ✕ limpa o escopo — o sistema volta ao global.
 * Guard de `mounted` evita mismatch de hidratação (store vem do sessionStorage).
 */
export default function UnidadeAtivaChip({ variant = "topbar" }: { variant?: "topbar" | "hub" }) {
  const id = useUnidadeAtiva((s) => s.id);
  const nome = useUnidadeAtiva((s) => s.nome);
  const limpar = useUnidadeAtiva((s) => s.limpar);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !id) return null;

  const hub = variant === "hub";
  return (
    <span
      className={
        hub
          ? "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
          : "inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/25"
      }
    >
      <MapPin className="size-3.5" />
      <span className="max-w-[160px] truncate">Unidade: {nome}</span>
      <button
        type="button"
        onClick={limpar}
        title="Sair da unidade — ver todas"
        className={hub ? "ml-0.5 rounded-full p-0.5 hover:bg-white/20" : "ml-0.5 rounded-full p-0.5 hover:bg-white/25"}
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}
