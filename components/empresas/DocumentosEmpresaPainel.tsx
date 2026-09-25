"use client";

// Situação dos documentos da empresa (DRPS, Questionário, AEP e AET) — para os
// administradores saberem, de dentro da inspeção, o que já existe para a
// empresa e em que pé está. Só leitura: conta por status, sem abrir nada.

import { useQuery } from "@tanstack/react-query";
import { FileStack } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Fase = "andamento" | "concluido" | "enviado";

interface Doc {
  chave: string;
  rotulo: string;
  nome: string;
  tabela: string;
  /** AEP e AET não têm "enviado ao cliente" no quadro de status. */
  temEnvio: boolean;
}

const DOCS: Doc[] = [
  { chave: "drps", rotulo: "DRPS", nome: "Diagnóstico de Riscos Psicossociais", tabela: "drps_relatorios", temEnvio: true },
  { chave: "qps", rotulo: "QPS", nome: "Questionário Psicossocial", tabela: "qps_aplicacoes", temEnvio: true },
  { chave: "aep", rotulo: "AEP", nome: "Análise Ergonômica Preliminar", tabela: "aep_relatorios", temEnvio: false },
  { chave: "aet", rotulo: "AET", nome: "Análise Ergonômica do Trabalho", tabela: "aet_relatorios", temEnvio: false },
];

const FASE: Record<Fase, { rotulo: string; cls: string }> = {
  andamento: { rotulo: "Em andamento", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  concluido: { rotulo: "Concluído", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  enviado: { rotulo: "Enviado ao cliente", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
};

function faseDe(status: string | null): Fase | null {
  switch (status) {
    case "RASCUNHO":
    case "EM_ANDAMENTO":
      return "andamento";
    case "CONCLUIDO":
      return "concluido";
    case "ENVIADO_CLIENTE":
      return "enviado";
    default:
      return null; // DELETADO e afins não contam
  }
}

type Contagem = Record<Fase, number>;

// drps_*, qps_*, aep_* e aet_* não estão (todas) no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

function useDocumentosEmpresa(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["documentos-empresa", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, Contagem>> => {
      const resultados = await Promise.all(
        DOCS.map((d) => db().from(d.tabela).select("status").eq("id_empresa", idEmpresa))
      );
      const out: Record<string, Contagem> = {};
      DOCS.forEach((d, i) => {
        const { data, error } = resultados[i];
        if (error) throw error;
        const c: Contagem = { andamento: 0, concluido: 0, enviado: 0 };
        for (const r of (data ?? []) as { status: string | null }[]) {
          const f = faseDe(r.status);
          if (f) c[f]++;
        }
        out[d.chave] = c;
      });
      return out;
    },
  });
}

export default function DocumentosEmpresaPainel({
  idEmpresa,
  className,
}: {
  idEmpresa: string | null | undefined;
  className?: string;
}) {
  const { data, isLoading, error } = useDocumentosEmpresa(idEmpresa);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <FileStack className="size-4 text-sky-600" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-600">Documentos da empresa</h2>
      </div>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
      ) : error ? (
        <p className="text-sm text-red-600">Não foi possível carregar os documentos da empresa.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DOCS.map((d) => {
            const c = data?.[d.chave] ?? { andamento: 0, concluido: 0, enviado: 0 };
            const fases: Fase[] = d.temEnvio ? ["andamento", "concluido", "enviado"] : ["andamento", "concluido"];
            const total = fases.reduce((n, f) => n + c[f], 0);
            return (
              <div key={d.chave} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-gray-900">{d.rotulo}</span>
                  <span className="truncate text-[11px] text-gray-500" title={d.nome}>{d.nome}</span>
                </div>
                {total === 0 ? (
                  <p className="mt-2 text-xs text-gray-400">Nenhum para esta empresa</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {fases
                      .filter((f) => c[f] > 0)
                      .map((f) => (
                        <span
                          key={f}
                          className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", FASE[f].cls)}
                        >
                          {FASE[f].rotulo}: {c[f]}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
