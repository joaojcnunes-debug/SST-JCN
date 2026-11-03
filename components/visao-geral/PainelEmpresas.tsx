"use client";

// Painel de empresas (Etapa 5 do docs/plano-skin-viva-jcn.md) — no lugar do mapa, por enquanto.
// Um ponto por empresa, agrupado por cidade, na cor da situação do pior documento dela; com
// documento vencido o ponto pulsa (parado com "reduzir movimento"). Clicar abre a empresa.
// A conta mora em lib/visao-geral/empresasSituacao.ts.

import { useMemo } from "react";
import Link from "next/link";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useLaudosValidade } from "@/lib/hooks/useLaudosValidade";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import { situacaoDasEmpresas, type SituacaoEmpresa } from "@/lib/visao-geral/empresasSituacao";
import { cn } from "@/lib/utils";

const ESTILO: Record<SituacaoEmpresa, { ponto: string; rotulo: string }> = {
  vencido: { ponto: "bg-red-500", rotulo: "Com documento vencido" },
  atencao: { ponto: "bg-amber-500", rotulo: "Vence em até 60 dias" },
  em_dia: { ponto: "bg-emerald-500", rotulo: "Em dia" },
  sem_doc: { ponto: "bg-gray-300 dark:bg-gray-600", rotulo: "Sem documento com validade" },
};

export default function PainelEmpresas() {
  const { data: empresas = [], isLoading: carregandoEmpresas } = useEmpresas();
  const { data: docs = [], isLoading: carregandoDocs } = useLaudosValidade();
  const grupos = useMemo(() => situacaoDasEmpresas(empresas, docs, hojeSP()), [empresas, docs]);
  const total = empresas.length;

  return (
    <section className="reveal-up rounded-2xl border border-gray-200 bg-white p-5 shadow-sm print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Empresas por situação</p>
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
          {(Object.keys(ESTILO) as SituacaoEmpresa[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className={cn("size-2 rounded-full", ESTILO[s].ponto)} /> {ESTILO[s].rotulo}
            </span>
          ))}
        </div>
      </div>
      {carregandoEmpresas || carregandoDocs ? (
        <div className="skeleton-shimmer mt-4 h-24" />
      ) : total === 0 ? (
        <p className="mt-4 text-sm text-gray-400">Nenhuma empresa cadastrada.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {grupos.map((g) => (
            <div key={g.cidade}>
              <p className="mb-2 text-xs font-medium text-gray-600">
                {g.cidade} <span className="text-gray-400">· {g.empresas.length}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {g.empresas.map((e) => (
                  <Link
                    key={e.id}
                    href={`/empresas/${e.id}`}
                    title={`${e.nome} — ${ESTILO[e.situacao].rotulo}${e.vencidos ? ` (${e.vencidos} vencido(s))` : e.aVencer ? ` (${e.aVencer} a vencer)` : ""}`}
                    className="group relative flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-marca-primary/50"
                  >
                    {e.situacao === "vencido" && (
                      <span className="ponto-ao-vivo absolute inline-flex size-4 rounded-full bg-red-400" aria-hidden="true" />
                    )}
                    <span className={cn("relative size-4 rounded-full transition-transform group-hover:scale-125", ESTILO[e.situacao].ponto)} />
                    <span className="sr-only">{e.nome}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11px] text-gray-400">
        {total} empresa(s). Passe o mouse num ponto para ver a empresa; clique para abrir. O mapa por cidade vem quando houver mais empresas.
      </p>
    </section>
  );
}
