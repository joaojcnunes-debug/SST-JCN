"use client";

// 0.3.336 (pedido do usuário, 27/11/2026): Grupos de empresas e Por empresa abriam vazias, só com o seletor. Agora cada
// grupo (ou consolidação salva) é um cartão — situação do registro, documentos, avisos e ações — com busca e filtro.
// As contas estão em lib/consolidacao/cartoes.ts.

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Building2, CalendarClock, FileText, History, Search } from "lucide-react";
import { buscar } from "@/lib/busca/texto";
import {
  ROTULO_SITUACAO_REGISTRO,
  type AvisoCartao,
  type DocsDaEmpresa,
  type ResumoDocs,
  type ResumoRegistro,
  type SituacaoRegistro,
} from "@/lib/consolidacao/cartoes";
import { useFontesConciliacao } from "@/lib/hooks/usePsicoConsolidacao";
import { documentosDaEmpresa } from "@/lib/psico-consolidacao/conciliacao";
import { cn, fmtData } from "@/lib/utils";

/** Os documentos padrão (o mais recente de cada origem) de cada empresa, como a Conciliação usa. */
export function useDocsPorEmpresa() {
  const fontes = useFontesConciliacao();
  const docs = useMemo(() => {
    const m = new Map<string, DocsDaEmpresa>();
    if (!fontes.data) return m;
    const ids = new Set(fontes.data.documentos.map((d) => d.idEmpresa));
    for (const id of ids) m.set(id, documentosDaEmpresa(fontes.data.documentos, id));
    return m;
  }, [fontes.data]);
  return { docs, isLoading: fontes.isLoading };
}

export interface CartaoItem {
  id: string;
  nome: string;
  descricao?: string | null;
  empresas: number;
  registro: ResumoRegistro;
  docs: ResumoDocs;
  avisos: AvisoCartao[];
  /** Linha extra (ex.: a situação da conciliação do grupo). */
  extra?: ReactNode;
  /** Ações além de "Abrir" (links, editar…). */
  acoes?: ReactNode;
}

const COR: Record<SituacaoRegistro, string> = {
  "sem-registro": "bg-gray-100 text-gray-700 ring-gray-200",
  aguardando: "bg-amber-50 text-amber-800 ring-amber-200",
  validando: "bg-sky-50 text-sky-800 ring-sky-200",
  validada: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

type Filtro = "todas" | SituacaoRegistro | "aviso";

export default function CartoesConsolidacao({
  itens,
  rotuloItem,
  ultimoId,
  onAbrir,
  vazio,
}: {
  itens: CartaoItem[];
  /** "grupo" ou "consolidação": textos de busca e contagem. */
  rotuloItem: { um: string; varios: string };
  /** O último aberto neste navegador: vira o atalho "Continuar". */
  ultimoId?: string | null;
  onAbrir: (id: string) => void;
  vazio: ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const ultimo = ultimoId ? itens.find((i) => i.id === ultimoId) : undefined;

  const contar = (f: Filtro) => itens.filter((i) => (f === "todas" ? true : f === "aviso" ? i.avisos.length > 0 : i.registro.situacao === f)).length;
  const base = itens.filter((i) => (filtro === "todas" ? true : filtro === "aviso" ? i.avisos.length > 0 : i.registro.situacao === filtro));
  const visiveis = busca.trim() ? buscar(base, busca, (i) => [i.nome, i.descricao ?? ""]).itens : base;
  const filtros: { k: Filtro; rotulo: string }[] = [
    { k: "todas", rotulo: "Todas" },
    { k: "sem-registro", rotulo: "Sem registro" },
    { k: "aguardando", rotulo: "Aguardando validação" },
    { k: "validando", rotulo: "Validando" },
    { k: "validada", rotulo: "Validadas" },
    { k: "aviso", rotulo: "Com aviso" },
  ];

  if (itens.length === 0) return <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">{vazio}</div>;

  return (
    <div className="space-y-3">
      {ultimo && (
        <button type="button" onClick={() => onAbrir(ultimo.id)}
          className="flex w-full items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-2.5 text-left text-sm hover:bg-indigo-50">
          <History className="size-4 text-indigo-600" />
          <span className="text-gray-600">Continuar onde parou:</span>
          <span className="font-semibold text-gray-900">{ultimo.nome}</span>
          <ArrowRight className="ml-auto size-4 text-indigo-600" />
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${rotuloItem.um}…`} aria-label={`Buscar ${rotuloItem.um}`}
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar">
          {filtros.map((f) => (
            <button key={f.k} type="button" onClick={() => setFiltro(f.k)} aria-pressed={filtro === f.k}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", filtro === f.k ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}>
              {f.rotulo} <span className="tabular-nums text-gray-400">{contar(f.k)}</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-500">{visiveis.length} de {itens.length} {itens.length === 1 ? rotuloItem.um : rotuloItem.varios}</span>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nada com esses filtros.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {visiveis.map((i) => (
            <li key={i.id} className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-md ring-1 ring-black/5 transition hover:shadow-lg">
              <button type="button" onClick={() => onAbrir(i.id)} className="flex-1 space-y-2 p-4 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{i.nome}</p>
                    {i.descricao && <p className="truncate text-xs text-gray-500">{i.descricao}</p>}
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", COR[i.registro.situacao])}>
                    {ROTULO_SITUACAO_REGISTRO[i.registro.situacao]}
                    {i.registro.situacao === "validando" && ` · ${i.registro.validadas} de ${i.empresas}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1"><Building2 className="size-3.5 text-gray-400" />{i.empresas} {i.empresas === 1 ? "empresa" : "empresas"}</span>
                  <span className="inline-flex items-center gap-1" title="Empresas com AEP · com DRPS ou QPS">
                    <FileText className="size-3.5 text-gray-400" />AEP {i.docs.comAep}/{i.empresas} · DRPS/QPS {i.docs.comQuestionario}/{i.empresas}
                  </span>
                  {i.registro.ultimoEm && (
                    <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5 text-gray-400" />Registrada em {fmtData(i.registro.ultimoEm)}</span>
                  )}
                </div>
                {i.extra && <div className="text-xs text-gray-600">{i.extra}</div>}
                {i.avisos.length > 0 && (
                  <ul className="space-y-0.5">
                    {i.avisos.map((a) => (
                      <li key={a.tipo} title={a.empresas.join(", ")}
                        className={cn("flex items-center gap-1.5 text-xs", a.tipo === "fora-do-acesso" || a.tipo === "sem-documento" ? "text-red-700" : "text-amber-700")}>
                        <AlertTriangle className="size-3.5 shrink-0" />{a.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2 text-xs">
                <button type="button" onClick={() => onAbrir(i.id)} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 font-medium text-white hover:bg-indigo-700">
                  Abrir <ArrowRight className="size-3.5" />
                </button>
                {i.acoes}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
