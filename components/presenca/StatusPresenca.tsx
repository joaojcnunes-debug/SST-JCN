"use client";

import { cn } from "@/lib/utils";
import { COR_STATUS, ROTULO_STATUS, type StatusPresenca } from "@/lib/presenca/regras";

/** Ponto colorido + rótulo. O ponto do "ativo" pulsa de leve; os outros, não. */
export function TarjaStatus({ status, className }: { status: StatusPresenca; className?: string }) {
  const cor = COR_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        cor.tarja,
        className,
      )}
    >
      <span className="relative flex size-2">
        {status === "ativo" && (
          <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", cor.ponto)} />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", cor.ponto)} />
      </span>
      {ROTULO_STATUS[status]}
    </span>
  );
}

export function PontoStatus({ status }: { status: StatusPresenca }) {
  return <span className={cn("inline-block size-2 rounded-full", COR_STATUS[status].ponto)} />;
}
