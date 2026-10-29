"use client";

// Segurança do Trabalho › Consolidação › Conciliação DRPS/QPS × AEP (29/10/2026).
//
// Toda empresa que tem AEP concluída ou DRPS/QPS concluído (ou enviado ao cliente), com os
// documentos usados (o mais recente de cada origem), quantos cruzamentos setor × fator
// convergem e quantos divergem. Clicar abre a empresa. A régua mora em
// lib/psico-consolidacao/conciliacao.ts.
//
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, GitCompareArrows, Search } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { COR_CLASSE, EXPLICACAO_CLASSE } from "@/components/psico-consolidacao/ConciliacaoSelos";
import { buscar } from "@/lib/busca/texto";
import { useFontesConciliacao, usePsicoCatalogo } from "@/lib/hooks/usePsicoConsolidacao";
import { conciliarEmpresa, documentosDaEmpresa, resumirEmpresa, type ResumoEmpresa } from "@/lib/psico-consolidacao/conciliacao";
import type { EmpresaFonte } from "@/lib/psico-consolidacao/carregar-grupo";
import type { OrigemFonte } from "@/lib/psico-consolidacao/fatores";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

type Filtro = "todas" | "divergencia" | "falta";

const ORIGENS: { origem: OrigemFonte; rotulo: string }[] = [
  { origem: "AEP", rotulo: "AEP" },
  { origem: "DRPS", rotulo: "DRPS" },
  { origem: "QPS", rotulo: "QPS" },
];

export default function ConciliacaoPage() {
  const fontes = useFontesConciliacao();
  const catalogo = usePsicoCatalogo();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const linhas = useMemo(() => {
    if (!fontes.data || !catalogo.data) return [];
    const { empresas, documentos, linhas: todas, pendencias, setoresAep } = fontes.data;
    const porEmpresa = new Map<string, typeof todas>();
    for (const l of todas) {
      const lista = porEmpresa.get(l.idEmpresa);
      if (lista) lista.push(l);
      else porEmpresa.set(l.idEmpresa, [l]);
    }
    return empresas.map((e): { empresa: EmpresaFonte; resumo: ResumoEmpresa } => {
      const docs = documentosDaEmpresa(documentos, e.idEmpresa);
      const ids = new Set(Object.values(docs).map((d) => d!.id));
      const r = conciliarEmpresa({
        linhas: porEmpresa.get(e.idEmpresa) ?? [],
        pendencias: pendencias.filter((p) => p.idEmpresa === e.idEmpresa),
        setoresAep: setoresAep.filter((s) => ids.has(s.idDocumento)),
        documentos: ids,
        fatores: catalogo.data.fatores,
        depara: catalogo.data.depara,
      });
      return { empresa: e, resumo: resumirEmpresa(e.idEmpresa, docs, r) };
    });
  }, [fontes.data, catalogo.data]);

  const contagem = useMemo(
    () => ({
      todas: linhas.length,
      divergencia: linhas.filter((l) => l.resumo.divergencias > 0).length,
      falta: linhas.filter((l) => l.resumo.falta.length > 0 || l.resumo.semSetorEmComum).length,
    }),
    [linhas],
  );

  const visiveis = useMemo(() => {
    const base = linhas.filter((l) =>
      filtro === "divergencia" ? l.resumo.divergencias > 0 : filtro === "falta" ? l.resumo.falta.length > 0 || l.resumo.semSetorEmComum : true,
    );
    const achadas = busca.trim()
      ? buscar(base, busca, (l) => [l.empresa.nome, l.empresa.cnpj ?? "", l.empresa.municipio ?? ""]).itens
      : base;
    // Mais divergências primeiro; quem não dá para conciliar vai para o fim.
    return [...achadas].sort(
      (a, b) =>
        Number(a.resumo.falta.length > 0 || a.resumo.semSetorEmComum) - Number(b.resumo.falta.length > 0 || b.resumo.semSetorEmComum) ||
        b.resumo.divergencias - a.resumo.divergencias ||
        a.empresa.nome.localeCompare(b.empresa.nome, "pt-BR"),
    );
  }, [linhas, filtro, busca]);

  const carregando = fontes.isLoading || catalogo.isLoading;
  const erro = fontes.error ?? catalogo.error;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <GitCompareArrows className="size-5 text-indigo-600" />
          Conciliação DRPS/QPS × AEP
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
          O que os questionários (percepção de quem trabalha) apontam contra o que a AEP (observação do técnico) viu, setor
          por setor e fator por fator. Usa a AEP concluída e o DRPS/QPS concluído ou enviado ao cliente mais recentes de cada
          empresa. Clique na empresa para ver as divergências.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ ou município"
            className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
          />
        </div>
        {(
          [
            ["todas", "Todas"],
            ["divergencia", "Com divergência"],
            ["falta", "Não dá para conciliar"],
          ] as const
        ).map(([k, rotulo]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFiltro(k)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              filtro === k ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            )}
          >
            {rotulo} <span className="opacity-70">({contagem[k]})</span>
          </button>
        ))}
      </div>

      {carregando ? (
        <LoadingSkeleton />
      ) : erro ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar os documentos: {(erro as Error).message}
        </p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          {linhas.length === 0 ? "Nenhuma empresa com AEP ou questionário concluído." : "Nenhuma empresa neste filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Empresa</th>
                {ORIGENS.map((o) => (
                  <th key={o.origem} className="px-3 py-3">{o.rotulo}</th>
                ))}
                <th className="px-3 py-3 text-right" title={EXPLICACAO_CLASSE.Convergente}>Convergentes</th>
                <th className="px-3 py-3">Divergências</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map(({ empresa: e, resumo: r }) => (
                <tr key={e.idEmpresa} className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/consolidacao-grupo/conciliacao/${e.idEmpresa}`} className="font-medium text-gray-900 hover:text-indigo-700 hover:underline">
                      {e.nome}
                    </Link>
                    <p className="text-[11px] text-gray-400">
                      {[e.cnpj ? formatCNPJ(e.cnpj) : null, e.municipio && e.uf ? `${e.municipio}/${e.uf}` : e.municipio].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  {ORIGENS.map((o) => {
                    const d = r.documentos[o.origem];
                    return (
                      <td key={o.origem} className="whitespace-nowrap px-3 py-2.5 text-xs">
                        {d ? <span className="text-gray-700">{d.data ? fmtData(d.data) : "sem data"}</span> : <span className="text-gray-300">—</span>}
                      </td>
                    );
                  })}
                  {r.falta.length > 0 || r.semSetorEmComum ? (
                    <td colSpan={2} className="px-3 py-2.5">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        {r.falta.length > 0
                          ? `Falta ${r.falta.join(" e ")} — não dá para conciliar`
                          : "Nenhum setor em comum — confira os nomes dos setores"}
                      </span>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{r.convergentes}</td>
                      <td className="px-3 py-2.5">
                        {r.divergencias === 0 ? (
                          <span className="text-xs text-gray-400">nenhuma</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(["Nível divergente", "Só questionário", "Só AEP"] as const).map((c) =>
                              r.porClasse[c] > 0 ? (
                                <span key={c} title={EXPLICACAO_CLASSE[c]} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", COR_CLASSE[c])}>
                                  {c} {r.porClasse[c]}
                                </span>
                              ) : null,
                            )}
                          </div>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2.5 text-right">
                    <Link href={`/consolidacao-grupo/conciliacao/${e.idEmpresa}`} className="inline-flex items-center text-xs font-medium text-indigo-700 hover:underline">
                      Abrir <ChevronRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
