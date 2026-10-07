"use client";

import { Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROTULO_PAPEL } from "@/lib/empresas/grupos";
import type { InfoGrupoDaEmpresa } from "@/lib/hooks/useGruposEmpresas";

/** "Grupo X · Matriz" — o selo do grupo da empresa (v278). */
export default function SeloGrupo({
  info,
  compacto,
  className,
}: {
  info: InfoGrupoDaEmpresa | undefined;
  compacto?: boolean;
  className?: string;
}) {
  if (!info) return null;
  const matriz = info.papel === "MATRIZ";
  return (
    <span
      title={`Grupo ${info.nome} — ${ROTULO_PAPEL[info.papel]}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border font-medium",
        compacto ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]",
        "border-indigo-200 bg-indigo-50 text-indigo-800",
        className,
      )}
    >
      <Network className={compacto ? "size-2.5 shrink-0" : "size-3 shrink-0"} />
      <span className="truncate">{info.nome}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 font-semibold",
          matriz ? "bg-indigo-600 text-white" : "bg-white text-indigo-700",
        )}
      >
        {ROTULO_PAPEL[info.papel]}
      </span>
    </span>
  );
}
