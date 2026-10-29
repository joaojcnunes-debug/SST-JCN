"use client";

// Conciliação DRPS/QPS × AEP de UMA empresa (29/10/2026): setor × fator, com o nível de
// cada fonte lado a lado e a classe de DRPS × AEP e de QPS × AEP (coluna própria).
// Abre nas divergências, as mais importantes primeiro; dá para ver tudo e trocar o
// documento de cada origem. A régua mora em lib/psico-consolidacao/conciliacao.ts.
//
// v0.3.176 (banco v310, NR-01/NR-17): parecer por cruzamento (Confirmar no PGR, AET,
// Descartar) com ação 5W2H, ligação de setores escritos de outro jeito, representatividade
// do questionário, sugestão de AET e o fechamento (foto imutável) com histórico.
// v0.3.178: alertas de revisão no topo e o PDF de cada fechamento (anexo do PGR).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ClipboardCheck, GitCompareArrows, Microscope } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost } from "@/components/ui/confirm";
import { SeloClasse, TextoNivel, COR_CLASSE, EXPLICACAO_CLASSE } from "@/components/psico-consolidacao/ConciliacaoSelos";
import ParecerModal, { type ContextoParecer } from "@/components/psico-consolidacao/ParecerModal";
import LigacaoSetores from "@/components/psico-consolidacao/LigacaoSetores";
import FechamentosConciliacao from "@/components/psico-consolidacao/FechamentosConciliacao";
import { useFontesConciliacao, usePsicoCatalogo } from "@/lib/hooks/usePsicoConsolidacao";
import { useRegistrosConciliacao } from "@/lib/hooks/useConciliacaoParecer";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  ADESAO_MINIMA,
  CLASSES,
  MESES_DISTANCIA,
  MESES_REVISAO,
  alertasRevisao,
  DIVERGENCIAS,
  MIN_RESPONDENTES,
  ROTULO_DECISAO,
  chaveParecer,
  conciliarEmpresa,
  contarPareceres,
  documentosDaEmpresa,
  indexarPareceres,
  itensDoFechamento,
  situacaoParecer,
  type CelulaConciliacao,
  type ClasseConciliacao,
  type ParecerConciliacao,
  type Questionario,
  type SetorConciliacao,
} from "@/lib/psico-consolidacao/conciliacao";
import type { OrigemFonte } from "@/lib/psico-consolidacao/fatores";
import type { DocumentoFonte } from "@/lib/psico-consolidacao/fontes";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const ORIGENS: OrigemFonte[] = ["AEP", "DRPS", "QPS"];
const sel =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

type Ordem = "prioridade" | "setor";

export default function ConciliacaoEmpresaPage() {
  const { idEmpresa: bruto } = useParams<{ idEmpresa: string }>();
  const idEmpresa = decodeURIComponent(bruto);
  const fontes = useFontesConciliacao(idEmpresa);
  const catalogo = usePsicoCatalogo();
  const registros = useRegistrosConciliacao(idEmpresa);
  const podeEditar = useCanEdit();

  // Documento escolhido por origem; ausente = o padrão (o mais recente). "" = não usar.
  const [escolha, setEscolha] = useState<Partial<Record<OrigemFonte, string>>>({});
  const [classes, setClasses] = useState<Set<ClasseConciliacao>>(() => new Set(DIVERGENCIAS));
  const [soPendentes, setSoPendentes] = useState(false);
  const [setor, setSetor] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("prioridade");
  const [parecerAberto, setParecerAberto] = useState<ContextoParecer | null>(null);

  const empresa = fontes.data?.empresas.find((e) => e.idEmpresa === idEmpresa);
  const docsPorOrigem = useMemo(() => {
    const m: Partial<Record<OrigemFonte, DocumentoFonte[]>> = {};
    for (const d of fontes.data?.documentos ?? []) if (d.idEmpresa === idEmpresa) (m[d.origem] ??= []).push(d);
    return m;
  }, [fontes.data, idEmpresa]);
  const padrao = useMemo(() => documentosDaEmpresa(fontes.data?.documentos ?? [], idEmpresa), [fontes.data, idEmpresa]);
  const escolhidos = useMemo(() => {
    const out: Partial<Record<OrigemFonte, DocumentoFonte>> = {};
    for (const o of ORIGENS) {
      const id = escolha[o] ?? padrao[o]?.id;
      const d = id ? docsPorOrigem[o]?.find((x) => x.id === id) : undefined;
      if (d) out[o] = d;
    }
    return out;
  }, [escolha, padrao, docsPorOrigem]);
  const usados = useMemo(() => new Set(Object.values(escolhidos).map((d) => d!.id)), [escolhidos]);

  const ligacoes = useMemo(() => registros.data?.ligacoes ?? [], [registros.data]);
  const resultado = useMemo(() => {
    if (!fontes.data || !catalogo.data) return null;
    return conciliarEmpresa({
      linhas: fontes.data.linhas.filter((l) => l.idEmpresa === idEmpresa),
      pendencias: fontes.data.pendencias.filter((p) => p.idEmpresa === idEmpresa),
      setoresAep: fontes.data.setoresAep,
      documentos: usados,
      fatores: catalogo.data.fatores,
      depara: catalogo.data.depara,
      deparaSetores: ligacoes,
    });
  }, [fontes.data, catalogo.data, idEmpresa, usados, ligacoes]);

  const alertas = useMemo(
    () =>
      alertasRevisao({
        documentos: escolhidos,
        maisRecentes: padrao,
        ultimoFechamento: registros.data?.fechamentos[0] ?? null,
        hoje: hojeSP(),
      }),
    [escolhidos, padrao, registros.data],
  );

  const pareceres = useMemo(() => indexarPareceres(registros.data?.pareceres ?? []), [registros.data]);
  const contagem = useMemo(
    () => (resultado ? contarPareceres(resultado, pareceres) : { pendentes: 0, semAcao: 0, desatualizados: 0, comParecer: 0 }),
    [resultado, pareceres],
  );
  const setorPorChave = useMemo(() => new Map((resultado?.setores ?? []).map((s) => [s.chave, s])), [resultado]);

  const nomeFator = useMemo(
    () => new Map((catalogo.data?.fatores ?? []).map((f) => [f.id_fator, f.nome_curto || f.nome])),
    [catalogo.data],
  );

  const visiveis = useMemo(() => {
    if (!resultado) return [];
    const qs = resultado.questionarios;
    const lista = resultado.celulas.filter((c) => {
      if (setor && c.chaveSetor !== setor) return false;
      if (soPendentes) {
        return qs.some((q) => {
          const s = situacaoParecer(c.classe[q], pareceres.get(chaveParecer(c.chaveSetor, c.idFator, q)));
          return s === "pendente" || s === "desatualizado" || s === "sem-acao";
        });
      }
      return qs.some((q) => c.classe[q] && classes.has(c.classe[q]!));
    });
    if (ordem === "prioridade") {
      const p = (c: CelulaConciliacao) => Math.max(...qs.map((q) => c.prioridade[q]));
      lista.sort((a, b) => p(b) - p(a));
    }
    return lista;
  }, [resultado, classes, setor, soPendentes, ordem, pareceres]);

  const alternar = (c: ClasseConciliacao) => {
    setSoPendentes(false);
    setClasses((atual) => {
      const n = new Set(atual);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  const abrirParecer = (c: CelulaConciliacao, q: Questionario) => {
    const s = setorPorChave.get(c.chaveSetor);
    setParecerAberto({
      idEmpresa,
      celula: c,
      questionario: q,
      fator: nomeFator.get(c.idFator) ?? c.idFator,
      expostos: s?.expostos ?? null,
      necessitaAet: s?.necessitaAet ?? false,
      documentos: Object.fromEntries(Object.entries(escolhidos).map(([o, d]) => [o, d!.id])),
      atual: pareceres.get(chaveParecer(c.chaveSetor, c.idFator, q)),
    });
  };

  const montarFechamento = () => ({
    documentos: Object.fromEntries(
      Object.entries(escolhidos).map(([o, d]) => [o, { id: d!.id, titulo: d!.titulo, data: d!.data }]),
    ),
    resumo: { totais: resultado?.totais ?? {}, pareceres: contagem, questionarios: resultado?.questionarios ?? [] },
    itens: resultado ? itensDoFechamento(resultado, pareceres, (id) => nomeFator.get(id) ?? id) : [],
  });

  if (fontes.isLoading || catalogo.isLoading || registros.isLoading) return <LoadingSkeleton />;
  const erro = fontes.error ?? catalogo.error ?? registros.error;
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

      {alertas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <CalendarClock className="size-4" /> Revisão
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {alertas.map((a) => (
              <li key={a.texto}>{a.texto}</li>
            ))}
          </ul>
        </div>
      )}

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
          {/* ── Totais e pareceres ─────────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-3">
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
                        (soPendentes || !classes.has(c)) && "opacity-40",
                      )}
                    >
                      {c} <span className="font-bold">{resultado.totais[q][c]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                <ClipboardCheck className="size-4 text-indigo-600" /> Pareceres
              </p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>
                  <b className={contagem.pendentes > 0 ? "text-amber-700" : "text-emerald-700"}>{contagem.pendentes}</b> divergência(s) sem parecer
                </li>
                <li>
                  <b className={contagem.semAcao > 0 ? "text-amber-700" : "text-gray-700"}>{contagem.semAcao}</b> risco(s) apontado(s) sem ação no plano
                </li>
                {contagem.desatualizados > 0 && (
                  <li>
                    <b className="text-amber-700">{contagem.desatualizados}</b> parecer(es) de outra situação — rever
                  </li>
                )}
                <li>
                  <b className="text-gray-700">{contagem.comParecer}</b> com parecer
                </li>
              </ul>
            </div>
          </div>

          {/* ── Filtros ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={setor} onChange={(e) => setSetor(e.target.value)} className={sel}>
              <option value="">Todos os setores</option>
              {resultado.setores.map((s) => (
                <option key={s.chave} value={s.chave}>{s.setor}</option>
              ))}
            </select>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className={sel} title="Ordem da tabela">
              <option value="prioridade">Mais importantes primeiro</option>
              <option value="setor">Por setor</option>
            </select>
            <button type="button" onClick={() => { setSoPendentes(false); setClasses(new Set(DIVERGENCIAS)); }} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Só divergências
            </button>
            <button
              type="button"
              onClick={() => setSoPendentes((v) => !v)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs",
                soPendentes ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              O que falta resolver
            </button>
            <button type="button" onClick={() => { setSoPendentes(false); setClasses(new Set(CLASSES)); }} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              Mostrar tudo
            </button>
            <span className="text-xs text-gray-400">
              {visiveis.length} de {resultado.celulas.length} cruzamentos setor × fator
            </span>
          </div>

          {/* ── Tabela ─────────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            {visiveis.length === 0 ? (
              <p className="p-10 text-center text-sm text-gray-500">
                {soPendentes ? "Nada a resolver: toda divergência tem parecer e ação." : "Nenhum cruzamento nas classes marcadas."}
              </p>
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
                  {visiveis.map((c) => {
                    const s = setorPorChave.get(c.chaveSetor);
                    return (
                      <tr key={`${c.chaveSetor}|${c.idFator}`} className="border-b border-gray-50 align-top last:border-0">
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-gray-900">{c.setor}</span>
                          {s?.expostos != null && <p className="text-[11px] text-gray-400">{s.expostos} expostos</p>}
                          {s?.necessitaAet && <p className="text-[11px] font-medium text-indigo-700">AEP indica AET</p>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{nomeFator.get(c.idFator) ?? c.idFator}</td>
                        <td className="px-3 py-2.5"><CelulaAep c={c} /></td>
                        {resultado.questionarios.map((q) => (
                          <CelulasQuestionario
                            key={q}
                            c={c}
                            q={q}
                            setor={s}
                            parecer={pareceres.get(chaveParecer(c.chaveSetor, c.idFator, q))}
                            podeEditar={podeEditar}
                            onParecer={() => abrirParecer(c, q)}
                          />
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Setores sem par e ligação ────────────────────────────────────── */}
      {podeConciliar && (
        <LigacaoSetores idEmpresa={idEmpresa} setores={resultado.setores} ligacoes={ligacoes} podeEditar={podeEditar} />
      )}

      {resultado.linhasSemFator > 0 && (
        <p className="text-xs text-gray-500">
          {resultado.linhasSemFator} linha(s) dos questionários ficaram fora por não terem fator correspondente no catálogo (aba
          Fatores da Consolidação).
        </p>
      )}

      {podeConciliar && (
        <FechamentosConciliacao
          idEmpresa={idEmpresa}
          historico={registros.data?.fechamentos ?? []}
          contagem={contagem}
          podeEditar={podeEditar}
          podeFechar={resultado.setoresEmComum > 0}
          montar={montarFechamento}
        />
      )}

      <ComoComparamos />

      <ConfirmHost />
      {parecerAberto && <ParecerModal ctx={parecerAberto} podeEditar={podeEditar} onClose={() => setParecerAberto(null)} />}
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
      <th className="px-3 py-3">Parecer {q}</th>
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
            {c.aep.sinais.length} {c.aep.sinais.length > 1 ? "sinais" : "sinal"}: {c.aep.sinais.join("; ")}
          </p>
        )}
      </div>
    );
  }
  if (c.aepNaoIdentificado) return <span className="text-xs text-amber-700" title="Marcado N/I (não identificável) na AEP">N/I</span>;
  return <span className="text-xs text-gray-400">Não</span>;
}

function CelulasQuestionario({
  c,
  q,
  setor,
  parecer,
  podeEditar,
  onParecer,
}: {
  c: CelulaConciliacao;
  q: Questionario;
  setor: SetorConciliacao | undefined;
  parecer: ParecerConciliacao | undefined;
  podeEditar: boolean;
  onParecer: () => void;
}) {
  const lado = q === "DRPS" ? c.drps : c.qps;
  const classe = c.classe[q];
  const situacao = situacaoParecer(classe, parecer);
  const expostos = setor?.expostos ?? null;
  return (
    <>
      <td className="px-3 py-2.5">
        {lado ? (
          <div>
            <TextoNivel texto={lado.nivel} degrau={lado.degrau} />
            {lado.respondentes != null && (
              <p className={cn("text-[11px]", c.baixaRepresentatividade[q] ? "font-medium text-amber-700" : "text-gray-400")}>
                {lado.respondentes}
                {expostos ? ` de ${expostos}` : ""} resp.
                {expostos ? ` (${Math.round((lado.respondentes / expostos) * 100)}%)` : ""}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <SeloClasse classe={classe} />
        {c.sugereAet[q] && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-700" title="NR-17, 17.3.2: avaliação mais aprofundada">
            <Microscope className="size-3" /> Sugere AET
          </p>
        )}
        {c.baixaRepresentatividade[q] && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700" title="Poucos respondentes para o tamanho do setor: resultado só indicativo">
            <AlertTriangle className="size-3" /> Baixa representatividade
          </p>
        )}
      </td>
      <td className="px-3 py-2.5">
        {situacao === "nao-precisa" && !parecer ? (
          classe && classe !== "Sem par" && podeEditar ? (
            <button type="button" onClick={onParecer} className="text-[11px] text-gray-400 hover:text-indigo-700 hover:underline">
              Dar parecer
            </button>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )
        ) : situacao === "pendente" ? (
          <button
            type="button"
            onClick={onParecer}
            disabled={!podeEditar}
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-default disabled:opacity-70"
          >
            {podeEditar ? "Dar parecer" : "Sem parecer"}
          </button>
        ) : (
          <button type="button" onClick={onParecer} className="text-left">
            <span className="flex items-center gap-1 text-[11px] font-medium text-gray-800">
              {situacao === "ok" && <CheckCircle2 className="size-3 text-emerald-600" />}
              {parecer ? ROTULO_DECISAO[parecer.decisao].split(" (")[0] : ""}
            </span>
            {situacao === "sem-acao" && <span className="block text-[11px] text-amber-700">sem ação no plano</span>}
            {situacao === "desatualizado" && <span className="block text-[11px] text-amber-700">rever (os documentos mudaram)</span>}
            {parecer?.id_acao && <span className="block text-[11px] text-gray-400">Ação {parecer.id_acao}</span>}
          </button>
        )}
      </td>
    </>
  );
}

function ComoComparamos() {
  return (
    <details className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
      <summary className="cursor-pointer font-semibold text-gray-800">Como comparamos (método)</summary>
      <div className="mt-3 space-y-2 text-xs leading-relaxed">
        <p>
          Os dois lados vão para uma escala de 4 degraus. Questionário (DRPS/QPS): Baixo 1 · Médio 2 · Alto 3 · Crítico 4.
          AEP (nível AIHA gravado no setor): Trivial/Baixo 1 · Moderado 2 · Alto 3 · Muito Alto 4.
        </p>
        <p>
          O questionário <b>aponta</b> o fator a partir de Médio; a AEP, com o fator &quot;Sim&quot; e AIHA a partir de Moderado (&quot;Sim&quot;
          sem AIHA aponta, sem nível). Os dois apontam com até 1 degrau de diferença: <b>Convergente</b>; 2 ou mais:{" "}
          <b>Nível divergente</b>. Só um aponta: <b>Só questionário</b> ou <b>Só AEP</b>. Nenhum: <b>Sem indicação</b>. O setor
          não existe numa das fontes: <b>Sem par</b>.
        </p>
        <p>
          <b>Representatividade:</b> o questionário do setor é só indicativo com menos de {MIN_RESPONDENTES} respondentes ou com
          adesão abaixo de {Math.round(ADESAO_MINIMA * 100)}% dos expostos informados na AEP (NR-01: a consulta aos trabalhadores
          sobre a percepção dos riscos).
        </p>
        <p>
          <b>Sugere AET</b> (NR-17, 17.3.2 — avaliação mais aprofundada) quando os níveis divergem ou quando os trabalhadores
          apontam Alto/Crítico e a AEP não viu o fator.
        </p>
        <p>
          <b>Ordem de importância:</b> o tipo de divergência pesa mais, depois o maior nível das duas fontes e o número de
          expostos; com representatividade baixa, cai.
        </p>
        <p>
          <b>Parecer</b> (qualquer pessoa que edita a empresa): Confirmar no inventário do PGR, Aprofundar com AET ou Descartar
          com justificativa. Confirmar e AET podem criar a ação 5W2H no Plano de Ação. <b>Fechar a conciliação</b> guarda uma foto
          que não muda mais (NR-01: histórico da avaliação). Cada fechamento tem o seu PDF, para anexar ao PGR.
        </p>
        <p>
          <b>Revisão:</b> a página avisa quando um documento usado tem {MESES_REVISAO / 12} anos ou mais (NR-01, 1.5.4.4.6:
          a avaliação de riscos é revista a cada 2 anos), quando a AEP e o questionário têm {MESES_DISTANCIA} meses ou mais de
          diferença e quando há documento mais recente que os do último fechamento.
        </p>
      </div>
    </details>
  );
}
