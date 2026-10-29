"use client";

// Conciliação DRPS/QPS × AEP de UMA empresa (29/10/2026): setor × fator, com o nível de
// cada fonte lado a lado e a classe de DRPS × AEP e de QPS × AEP (coluna própria).
// Abre nas divergências; dá para ver tudo e trocar o documento de cada origem.
// A régua mora em lib/psico-consolidacao/conciliacao.ts.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, GitCompareArrows } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { SeloClasse, TextoNivel, COR_CLASSE, EXPLICACAO_CLASSE } from "@/components/psico-consolidacao/ConciliacaoSelos";
import { useFontesConciliacao, usePsicoCatalogo } from "@/lib/hooks/usePsicoConsolidacao";
import {
  CLASSES,
  DIVERGENCIAS,
  conciliarEmpresa,
  documentosDaEmpresa,
  type CelulaConciliacao,
  type ClasseConciliacao,
  type Questionario,
} from "@/lib/psico-consolidacao/conciliacao";
import type { OrigemFonte } from "@/lib/psico-consolidacao/fatores";
import type { DocumentoFonte } from "@/lib/psico-consolidacao/fontes";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const ORIGENS: OrigemFonte[] = ["AEP", "DRPS", "QPS"];
const sel =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

export default function ConciliacaoEmpresaPage() {
  const { idEmpresa: bruto } = useParams<{ idEmpresa: string }>();
  const idEmpresa = decodeURIComponent(bruto);
  const fontes = useFontesConciliacao(idEmpresa);
  const catalogo = usePsicoCatalogo();

  // Documento escolhido por origem; ausente = o padrão (o mais recente). "" = não usar.
  const [escolha, setEscolha] = useState<Partial<Record<OrigemFonte, string>>>({});
  const [classes, setClasses] = useState<Set<ClasseConciliacao>>(() => new Set(DIVERGENCIAS));
  const [setor, setSetor] = useState("");

  const empresa = fontes.data?.empresas.find((e) => e.idEmpresa === idEmpresa);
  const docsPorOrigem = useMemo(() => {
    const m: Partial<Record<OrigemFonte, DocumentoFonte[]>> = {};
    for (const d of fontes.data?.documentos ?? []) if (d.idEmpresa === idEmpresa) (m[d.origem] ??= []).push(d);
    return m;
  }, [fontes.data, idEmpresa]);
  const padrao = useMemo(() => documentosDaEmpresa(fontes.data?.documentos ?? [], idEmpresa), [fontes.data, idEmpresa]);
  const usados = useMemo(() => {
    const s = new Set<string>();
    for (const o of ORIGENS) {
      const id = escolha[o] ?? padrao[o]?.id;
      if (id) s.add(id);
    }
    return s;
  }, [escolha, padrao]);

  const resultado = useMemo(() => {
    if (!fontes.data || !catalogo.data) return null;
    return conciliarEmpresa({
      linhas: fontes.data.linhas.filter((l) => l.idEmpresa === idEmpresa),
      pendencias: fontes.data.pendencias.filter((p) => p.idEmpresa === idEmpresa),
      setoresAep: fontes.data.setoresAep,
      documentos: usados,
      fatores: catalogo.data.fatores,
      depara: catalogo.data.depara,
    });
  }, [fontes.data, catalogo.data, idEmpresa, usados]);

  const nomeFator = useMemo(
    () => new Map((catalogo.data?.fatores ?? []).map((f) => [f.id_fator, f.nome_curto || f.nome])),
    [catalogo.data],
  );

  const visiveis = useMemo(() => {
    if (!resultado) return [];
    return resultado.celulas.filter(
      (c) =>
        (!setor || c.setor === setor) &&
        resultado.questionarios.some((q) => c.classe[q] && classes.has(c.classe[q]!)),
    );
  }, [resultado, classes, setor]);

  const semPar = resultado?.setores.filter((s) => !s.avaliadoPor.includes("AEP") || !s.avaliadoPor.some((o) => o !== "AEP")) ?? [];

  const alternar = (c: ClasseConciliacao) =>
    setClasses((atual) => {
      const n = new Set(atual);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  if (fontes.isLoading || catalogo.isLoading) return <LoadingSkeleton />;
  const erro = fontes.error ?? catalogo.error;
  if (erro) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar: {(erro as Error).message}</p>;
  }
  if (!empresa || !resultado) {
    return (
      <div className="space-y-3">
        <Voltar />
        <p className="text-sm text-gray-500">Empresa sem AEP ou questionário concluído (ou fora do seu acesso).</p>
      </div>
    );
  }

  const podeConciliar = resultado.temAep && resultado.questionarios.length > 0;

  return (
    <div className="space-y-4">
      <Voltar />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <GitCompareArrows className="size-5 text-indigo-600" />
          {empresa.nome}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {[empresa.cnpj ? formatCNPJ(empresa.cnpj) : null, empresa.municipio && empresa.uf ? `${empresa.municipio}/${empresa.uf}` : empresa.municipio]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {/* ── Documentos usados ─────────────────────────────────────────── */}
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        {ORIGENS.map((o) => {
          const docs = docsPorOrigem[o] ?? [];
          return (
            <label key={o} className="block">
              <span className="text-xs font-semibold text-gray-600">{o === "QPS" ? "QPS (Questionário)" : o}</span>
              {docs.length === 0 ? (
                <p className="mt-1 text-sm text-gray-400">Nenhum concluído</p>
              ) : (
                <select
                  value={escolha[o] ?? padrao[o]?.id ?? ""}
                  onChange={(e) => setEscolha((x) => ({ ...x, [o]: e.target.value }))}
                  className={cn(sel, "mt-1 w-full")}
                >
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.titulo} · {d.data ? fmtData(d.data) : "sem data"}
                      {d.id === padrao[o]?.id ? " (mais recente)" : ""}
                    </option>
                  ))}
                  <option value="">Não usar</option>
                </select>
              )}
            </label>
          );
        })}
      </div>

      {!podeConciliar ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Para conciliar é preciso uma AEP e pelo menos um questionário (DRPS ou QPS). Falta{" "}
          {!resultado.temAep ? "a AEP" : "o questionário"}.
        </p>
      ) : (
        <>
          {/* ── Totais ─────────────────────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-2">
            {resultado.questionarios.map((q) => (
              <div key={q} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-sm font-semibold text-gray-800">{q} × AEP</p>
                <div className="flex flex-wrap gap-1.5">
                  {CLASSES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => alternar(c)}
                      title={EXPLICACAO_CLASSE[c]}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition",
                        COR_CLASSE[c],
                        !classes.has(c) && "opacity-40",
                      )}
                    >
                      {c} <span className="font-bold">{resultado.totais[q][c]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Filtros ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={setor} onChange={(e) => setSetor(e.target.value)} className={sel}>
              <option value="">Todos os setores</option>
              {resultado.setores.map((s) => (
                <option key={s.setor} value={s.setor}>{s.setor}</option>
              ))}
            </select>
            <button type="button" onClick={() => setClasses(new Set(DIVERGENCIAS))} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Só divergências
            </button>
            <button type="button" onClick={() => setClasses(new Set(CLASSES))} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Mostrar tudo
            </button>
            <span className="text-xs text-gray-400">
              {visiveis.length} de {resultado.celulas.length} cruzamentos setor × fator
            </span>
          </div>

          {/* ── Tabela ─────────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            {visiveis.length === 0 ? (
              <p className="p-10 text-center text-sm text-gray-500">Nenhum cruzamento nas classes marcadas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">Setor</th>
                    <th className="px-3 py-3">Fator</th>
                    <th className="px-3 py-3">AEP (técnico)</th>
                    {resultado.questionarios.map((q) => (
                      <Colunas key={q} q={q} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => (
                    <tr key={`${c.setor}|${c.idFator}`} className="border-b border-gray-50 align-top last:border-0">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c.setor}</td>
                      <td className="px-3 py-2.5 text-gray-700">{nomeFator.get(c.idFator) ?? c.idFator}</td>
                      <td className="px-3 py-2.5"><CelulaAep c={c} /></td>
                      {resultado.questionarios.map((q) => (
                        <CelulasQuestionario key={q} c={c} q={q} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Setores sem par ──────────────────────────────────────────────── */}
      {podeConciliar && semPar.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-800">Setores que aparecem numa fonte só</p>
          <p className="mb-2 text-xs text-gray-500">
            Não dá para conciliar estes setores. Se for o mesmo setor escrito de outro jeito, ajuste o nome no documento.
          </p>
          <ul className="space-y-1 text-sm">
            {semPar.map((s) => (
              <li key={s.setor} className="text-gray-700">
                <span className="font-medium">{s.setor}</span>{" "}
                <span className="text-xs text-gray-500">
                  — só em {s.avaliadoPor.join(", ")}
                  {Object.entries(s.originais)
                    .map(([o, nomes]) => ` · ${o}: "${nomes!.join('", "')}"`)
                    .join("")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado.linhasSemFator > 0 && (
        <p className="text-xs text-gray-500">
          {resultado.linhasSemFator} linha(s) dos questionários ficaram fora por não terem fator correspondente no catálogo (aba
          Fatores da Consolidação).
        </p>
      )}
    </div>
  );
}

function Voltar() {
  return (
    <Link href="/consolidacao-grupo/conciliacao" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline">
      <ArrowLeft className="size-3.5" /> Todas as empresas
    </Link>
  );
}

function Colunas({ q }: { q: Questionario }) {
  return (
    <>
      <th className="px-3 py-3">{q} (questionário)</th>
      <th className="px-3 py-3">{q} × AEP</th>
    </>
  );
}

function CelulaAep({ c }: { c: CelulaConciliacao }) {
  if (c.aep) {
    return (
      <div>
        {c.aep.nivelAiha ? <TextoNivel texto={c.aep.nivelAiha} degrau={c.aep.degrau} /> : <span className="font-medium text-gray-700">Sim · sem AIHA</span>}
        {c.aep.sinais.length > 0 && (
          <p className="mt-0.5 max-w-xs text-[11px] leading-snug text-gray-500" title={c.aep.sinais.join("\n")}>
            {c.aep.sinais.length} sinal{c.aep.sinais.length > 1 ? "is" : ""}: {c.aep.sinais.join("; ")}
          </p>
        )}
      </div>
    );
  }
  if (c.aepNaoIdentificado) return <span className="text-xs text-amber-700" title="Marcado N/I (não identificável) na AEP">N/I</span>;
  return <span className="text-xs text-gray-400">Não</span>;
}

function CelulasQuestionario({ c, q }: { c: CelulaConciliacao; q: Questionario }) {
  const lado = q === "DRPS" ? c.drps : c.qps;
  return (
    <>
      <td className="px-3 py-2.5">
        {lado ? (
          <div>
            <TextoNivel texto={lado.nivel} degrau={lado.degrau} />
            {lado.respondentes != null && <p className="text-[11px] text-gray-400">{lado.respondentes} resp.</p>}
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <SeloClasse classe={c.classe[q]} />
      </td>
    </>
  );
}
