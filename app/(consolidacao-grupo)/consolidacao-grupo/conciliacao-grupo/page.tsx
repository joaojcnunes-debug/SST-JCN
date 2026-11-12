"use client";

// Segurança do Trabalho › Consolidação › Conciliação por grupo (12/11/2026, v0.3.285, banco v354).
//
// A mesma lógica da Conciliação DRPS/QPS × AEP, com o grupo de empresas no lugar da empresa: entram a AEP
// mais recente de cada empresa do grupo e o DRPS/QPS mais recente de cada empresa, comparados setor × fator
// com a mesma régua (lib/psico-consolidacao/conciliacao.ts e conciliacao-grupo.ts). Assim a AEP de um CNPJ
// encontra o questionário de outro CNPJ do mesmo grupo.
//
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui. Grupo com empresa fora do acesso de quem
// pede não aparece (o banco também não deixa ver nem gravar a conciliação dele).

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, Network, Search } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { COR_CLASSE, EXPLICACAO_CLASSE } from "@/components/psico-consolidacao/ConciliacaoSelos";
import { buscar } from "@/lib/busca/texto";
import { useFontesConciliacao, usePsicoCatalogo } from "@/lib/hooks/usePsicoConsolidacao";
import { useRegistrosConciliacaoGrupo } from "@/lib/hooks/useConciliacaoParecer";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import { conciliarEmpresa, indexarPareceres, type AlertaRevisao, type LigacaoSetor, type ParecerConciliacao, type TipoAlertaRevisao } from "@/lib/psico-consolidacao/conciliacao";
import { ORIGENS_GRUPO, alertasRevisaoGrupo, documentosDoGrupo, resumirGrupo, rotuloEmpresa, type ResumoGrupo } from "@/lib/psico-consolidacao/conciliacao-grupo";
import type { FechamentoGrupo } from "@/lib/psico-consolidacao/carregar-conciliacao";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import { cn, fmtData } from "@/lib/utils";

type Filtro = "todas" | "divergencia" | "parecer" | "falta" | "revisao";

interface Linha {
  idGrupo: string;
  nome: string;
  empresas: number;
  resumo: ResumoGrupo;
  fechadaEm: string | null;
  alertas: AlertaRevisao[];
}

const ROTULO_ALERTA: Record<TipoAlertaRevisao, string> = {
  "documento-antigo": "Documento antigo",
  "documentos-distantes": "Datas distantes",
  "fechamento-desatualizado": "Fechar de novo",
};

export default function ConciliacaoGrupoListaPage() {
  const { grupos, membrosPorGrupo, isLoading: carregandoGrupos, error: erroGrupos } = useGruposEmpresas();
  const fontes = useFontesConciliacao();
  const catalogo = usePsicoCatalogo();
  const registros = useRegistrosConciliacaoGrupo();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const { linhas, foraDoAcesso, semDocumento } = useMemo(() => {
    const vazio = { linhas: [] as Linha[], foraDoAcesso: 0, semDocumento: 0 };
    if (!fontes.data || !catalogo.data || !registros.data) return vazio;
    const { documentos, linhas: todas, pendencias, setoresAep } = fontes.data;
    const ligacoes = new Map<string, LigacaoSetor[]>();
    for (const l of registros.data.ligacoes as Array<LigacaoSetor & { id_grupo?: string }>) {
      if (l.id_grupo) ligacoes.set(l.id_grupo, [...(ligacoes.get(l.id_grupo) ?? []), l]);
    }
    const pareceres = new Map<string, ParecerConciliacao[]>();
    for (const p of registros.data.pareceres) pareceres.set(p.id_empresa, [...(pareceres.get(p.id_empresa) ?? []), p]);
    const ultimo = new Map<string, FechamentoGrupo>();
    for (const f of registros.data.fechamentos) if (!ultimo.has(f.id_grupo)) ultimo.set(f.id_grupo, f);
    const hoje = hojeSP();
    let fora = 0;
    let semDoc = 0;
    const out: Linha[] = [];
    for (const g of grupos) {
      const membros = membrosPorGrupo.get(g.id_grupo) ?? [];
      if (membros.length === 0) continue;
      if (membros.some((m) => !m.visivel)) {
        fora++;
        continue;
      }
      const ids = membros.map((m) => m.id_empresa);
      const docs = documentosDoGrupo(documentos, ids);
      if (docs.length === 0) {
        semDoc++;
        continue;
      }
      const usados = new Set(docs.map((d) => d.id));
      const idsSet = new Set(ids);
      const r = conciliarEmpresa({
        linhas: todas.filter((l) => idsSet.has(l.idEmpresa)),
        pendencias: pendencias.filter((p) => idsSet.has(p.idEmpresa)),
        setoresAep: setoresAep.filter((s) => usados.has(s.idDocumento)),
        documentos: usados,
        fatores: catalogo.data.fatores,
        depara: catalogo.data.depara,
        deparaSetores: ligacoes.get(g.id_grupo) ?? [],
      });
      const rotulos = new Map(membros.map((m) => [m.id_empresa, rotuloEmpresa({ nome: m.nome_empresa, cnpj: m.cnpj })]));
      const fechamento = ultimo.get(g.id_grupo) ?? null;
      out.push({
        idGrupo: g.id_grupo,
        nome: g.nome,
        empresas: membros.length,
        resumo: resumirGrupo(g.id_grupo, docs, r, indexarPareceres(pareceres.get(g.id_grupo) ?? [])),
        fechadaEm: fechamento && !fechamento.reabertura ? fechamento.fechado_em : null,
        alertas: alertasRevisaoGrupo({ documentos: docs, ultimoFechamento: fechamento, hoje, rotulo: (e) => rotulos.get(e) ?? e }),
      });
    }
    return { linhas: out, foraDoAcesso: fora, semDocumento: semDoc };
  }, [fontes.data, catalogo.data, registros.data, grupos, membrosPorGrupo]);

  const faltaResolver = (r: ResumoGrupo) => r.pareceres.pendentes + r.pareceres.desatualizados + r.pareceres.semAcao > 0;
  const semComparacao = (r: ResumoGrupo) => r.falta.length > 0 || r.semSetorEmComum;

  const contagem = useMemo(
    () => ({
      todas: linhas.length,
      divergencia: linhas.filter((l) => l.resumo.divergencias > 0).length,
      parecer: linhas.filter((l) => faltaResolver(l.resumo)).length,
      falta: linhas.filter((l) => semComparacao(l.resumo)).length,
      revisao: linhas.filter((l) => l.alertas.length > 0).length,
    }),
    [linhas],
  );

  const visiveis = useMemo(() => {
    const base = linhas.filter((l) =>
      filtro === "divergencia"
        ? l.resumo.divergencias > 0
        : filtro === "parecer"
          ? faltaResolver(l.resumo)
          : filtro === "falta"
            ? semComparacao(l.resumo)
            : filtro === "revisao"
              ? l.alertas.length > 0
              : true,
    );
    const achadas = busca.trim() ? buscar(base, busca, (l) => [l.nome]).itens : base;
    return [...achadas].sort(
      (a, b) =>
        Number(semComparacao(a.resumo)) - Number(semComparacao(b.resumo)) ||
        b.resumo.divergencias - a.resumo.divergencias ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [linhas, filtro, busca]);

  const carregando = carregandoGrupos || fontes.isLoading || catalogo.isLoading || registros.isLoading;
  const erro = erroGrupos ?? fontes.error ?? catalogo.error ?? registros.error;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Network className="size-5 text-indigo-600" />
          Conciliação por grupo
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
          A mesma comparação da Conciliação DRPS/QPS × AEP, com o grupo de empresas inteiro: entram a AEP e o DRPS/QPS mais
          recentes de cada empresa do grupo. Assim a AEP de um CNPJ encontra o questionário de outro. Clique no grupo para ver as
          divergências, dar parecer e fechar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar grupo"
            className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20"
          />
        </div>
        {(
          [
            ["todas", "Todos"],
            ["divergencia", "Com divergência"],
            ["parecer", "Falta parecer ou ação"],
            ["falta", "Sem comparação"],
            ["revisao", "Precisa revisar"],
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
          Não foi possível carregar: {(erro as Error).message}
        </p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          {linhas.length === 0 ? "Nenhum grupo com AEP ou questionário concluído. Os grupos ficam em Empresas › Grupos." : "Nenhum grupo neste filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Grupo</th>
                {ORIGENS_GRUPO.map((o) => (
                  <th key={o} className="px-3 py-3">{o}</th>
                ))}
                <th className="px-3 py-3 text-right" title={EXPLICACAO_CLASSE.Convergente}>Convergentes</th>
                <th className="px-3 py-3">Divergências</th>
                <th className="px-3 py-3">Pareceres</th>
                <th className="px-3 py-3">Fechada em</th>
                <th className="px-3 py-3">Revisão</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map(({ idGrupo, nome, empresas, resumo: r, fechadaEm, alertas }) => (
                <tr key={idGrupo} className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/consolidacao-grupo/conciliacao-grupo/${encodeURIComponent(idGrupo)}`} className="font-medium text-gray-900 hover:text-indigo-700 hover:underline">
                      {nome}
                    </Link>
                    <p className="text-[11px] text-gray-400">
                      {empresas} empresa(s) · {r.empresasComDocumento} com documento
                    </p>
                  </td>
                  {ORIGENS_GRUPO.map((o) => {
                    const ds = r.porOrigem[o] ?? [];
                    return (
                      <td key={o} className="whitespace-nowrap px-3 py-2.5 text-xs">
                        {ds.length === 0 ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className="text-gray-700" title={ds.map((d) => (d.data ? fmtData(d.data) : "sem data")).join(", ")}>
                            {ds.length > 1 ? `${ds.length} · ` : ""}
                            {ds[0].data ? fmtData(ds[0].data) : "sem data"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {r.fonteUnica ? (
                    <>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-300">—</td>
                      <td className="px-3 py-2.5">
                        <span title={EXPLICACAO_CLASSE["Fonte única"]} className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", COR_CLASSE["Fonte única"])}>
                          Só {r.fontes.join(" e ")}: {r.porClasse["Fonte única"]} apontado(s)
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs"><SituacaoPareceres r={r} /></td>
                    </>
                  ) : semComparacao(r) ? (
                    <td colSpan={3} className="px-3 py-2.5">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        {r.falta.length > 0 ? `Falta ${r.falta.join(" e ")} no grupo — não dá para conciliar` : "Nenhum setor em comum — confira os nomes dos setores"}
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
                      <td className="px-3 py-2.5 text-xs"><SituacaoPareceres r={r} /></td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-600">
                    {fechadaEm ? fmtData(fechadaEm) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {alertas.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <span
                        title={alertas.map((a) => a.texto).join("\n")}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
                      >
                        <CalendarClock className="size-3" />
                        {alertas.length === 1 ? ROTULO_ALERTA[alertas[0].tipo] : `${alertas.length} avisos`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link href={`/consolidacao-grupo/conciliacao-grupo/${encodeURIComponent(idGrupo)}`} className="inline-flex items-center text-xs font-medium text-indigo-700 hover:underline">
                      Abrir <ChevronRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && !erro && (foraDoAcesso > 0 || semDocumento > 0) && (
        <p className="text-xs text-gray-500">
          {semDocumento > 0 && `${semDocumento} grupo(s) sem nenhuma AEP ou questionário concluído não aparecem. `}
          {foraDoAcesso > 0 && `${foraDoAcesso} grupo(s) com empresa fora do seu acesso não aparecem.`}
        </p>
      )}
    </div>
  );
}

function SituacaoPareceres({ r }: { r: ResumoGrupo }) {
  const p = r.pareceres;
  if (r.divergencias + r.porClasse["Fonte única"] === 0 && p.comParecer === 0) return <span className="text-gray-400">—</span>;
  if (p.pendentes + p.desatualizados + p.semAcao === 0) return <span className="font-medium text-emerald-700">Em dia</span>;
  return (
    <div className="space-y-0.5 text-amber-700">
      {p.pendentes > 0 && <p>{p.pendentes} sem parecer</p>}
      {p.desatualizados > 0 && <p>{p.desatualizados} a rever</p>}
      {p.semAcao > 0 && <p>{p.semAcao} sem ação</p>}
    </div>
  );
}
