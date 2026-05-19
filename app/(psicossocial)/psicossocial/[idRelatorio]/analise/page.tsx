"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import {
  Printer,
  Save,
  Plus,
  X,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import DrpsSumarioPrint from "@/components/drps/DrpsSumarioPrint";
import DrpsRelatorioExtrasPrint from "@/components/drps/DrpsRelatorioExtrasPrint";
import DrpsGestaoResumoPrint from "@/components/drps/DrpsGestaoResumoPrint";
import { useDrpsStore } from "@/lib/drps/store";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useDrpsProbabilidades,
  useDrpsRelatorio,
  useDrpsRespondentes,
  useDrpsSalvarRelatorio,
  useDrpsTextoPadrao,
} from "@/lib/hooks/useDrps";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
  listarSetores,
} from "@/lib/drps/calculos";
import {
  AGRAVOS_OPCOES,
  MEDIDAS_EXISTENTES_OPCOES,
  TOPICOS,
} from "@/lib/drps/topicos";
import {
  montarValoresVariaveis,
  substituirVariaveis,
  substituirVariaveisTexto,
} from "@/lib/drps/variaveis";
import {
  formatCNPJ,
  formatCPF,
  formatCEI,
  formatCAEPF,
  formatCNO,
} from "@/lib/utils";
import type { Empresa } from "@/lib/supabase/types";
import type {
  DrpsProbabilidade,
  DrpsRelatorio,
  TopicoComMatriz,
} from "@/lib/drps/types";

interface SetorRelatorio {
  setor: string;
  totalRespondentes: number;
  funcoes: string;
  topicos: TopicoComMatriz[];
}

function montarMapaProb(
  probabilidades: DrpsProbabilidade[],
  setor: string
): Record<number, 1 | 2 | 3> {
  const m: Record<number, 1 | 2 | 3> = {};
  for (let i = 0; i < TOPICOS.length; i++) m[i] = 1;
  for (const p of probabilidades) {
    if (p.setor === setor) {
      m[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
    }
  }
  return m;
}

/**
 * Separa um texto multi-linha em itens predefinidos e itens extras (manuais).
 */
function parseMultiSelect(
  texto: string | null,
  opcoes: string[]
): { selecionados: string[]; extras: string[] } {
  if (!texto) return { selecionados: [], extras: [] };
  const itens = texto
    .split("\n")
    .map((s) => s.replace(/^[•\-\s]+/, "").trim())
    .filter((s) => s.length > 0);
  const selecionados: string[] = [];
  const extras: string[] = [];
  for (const item of itens) {
    if (opcoes.includes(item)) selecionados.push(item);
    else extras.push(item);
  }
  return { selecionados, extras };
}

function serializeMultiSelect(
  selecionados: string[],
  extras: string[]
): string | null {
  const all = [...selecionados, ...extras.filter((e) => e.trim().length > 0)];
  if (all.length === 0) return null;
  return all.map((s) => `• ${s}`).join("\n");
}

export default function AnalisePage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const setor = useDrpsStore((s) => s.setor);
  const canEdit = useCanEdit();
  const { data: relatorio } = useDrpsRelatorio(idRelatorio);
  const { data: empresa } = useEmpresa(relatorio?.id_empresa);
  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idRelatorio);
  const { data: capitulos = [] } = useDrpsTextoPadrao();

  const valoresVars = useMemo(
    () => montarValoresVariaveis(empresa, relatorio ?? null),
    [empresa, relatorio]
  );
  const salvar = useDrpsSalvarRelatorio();

  interface SetorEditor {
    agravosSel: string[];
    agravosExtras: string[];
    medidasSel: string[];
    medidasExtras: string[];
    novoAgravo: string;
    novaMedida: string;
  }
  const editorVazio: SetorEditor = {
    agravosSel: [],
    agravosExtras: [],
    medidasSel: [],
    medidasExtras: [],
    novoAgravo: "",
    novaMedida: "",
  };

  const [editores, setEditores] = useState<Record<string, SetorEditor>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!relatorio) return;
    const agravosMap = relatorio.agravos_por_setor ?? {};
    const medidasMap = relatorio.medidas_por_setor ?? {};
    const setoresUnicos = new Set<string>([
      ...Object.keys(agravosMap),
      ...Object.keys(medidasMap),
      ...listarSetores(respondentes),
    ]);
    const novos: Record<string, SetorEditor> = {};
    for (const s of setoresUnicos) {
      const a = parseMultiSelect(agravosMap[s] ?? null, AGRAVOS_OPCOES);
      const m = parseMultiSelect(medidasMap[s] ?? null, MEDIDAS_EXISTENTES_OPCOES);
      novos[s] = {
        agravosSel: a.selecionados,
        agravosExtras: a.extras,
        medidasSel: m.selecionados,
        medidasExtras: m.extras,
        novoAgravo: "",
        novaMedida: "",
      };
    }
    setEditores(novos);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatorio, respondentes]);

  function getEditor(s: string): SetorEditor {
    return editores[s] ?? editorVazio;
  }
  function patchEditor(s: string, patch: Partial<SetorEditor>) {
    setEditores((prev) => ({ ...prev, [s]: { ...getEditor(s), ...patch } }));
    setDirty(true);
  }
  function toggleAgravo(s: string, item: string) {
    const ed = getEditor(s);
    const nova = ed.agravosSel.includes(item)
      ? ed.agravosSel.filter((a) => a !== item)
      : [...ed.agravosSel, item];
    patchEditor(s, { agravosSel: nova });
  }
  function toggleMedida(s: string, item: string) {
    const ed = getEditor(s);
    const nova = ed.medidasSel.includes(item)
      ? ed.medidasSel.filter((a) => a !== item)
      : [...ed.medidasSel, item];
    patchEditor(s, { medidasSel: nova });
  }
  function adicionarAgravo(s: string) {
    const ed = getEditor(s);
    const v = ed.novoAgravo.trim();
    if (!v) return;
    patchEditor(s, { agravosExtras: [...ed.agravosExtras, v], novoAgravo: "" });
  }
  function adicionarMedida(s: string) {
    const ed = getEditor(s);
    const v = ed.novaMedida.trim();
    if (!v) return;
    patchEditor(s, { medidasExtras: [...ed.medidasExtras, v], novaMedida: "" });
  }
  function removerAgravoExtra(s: string, i: number) {
    const ed = getEditor(s);
    patchEditor(s, { agravosExtras: ed.agravosExtras.filter((_, idx) => idx !== i) });
  }
  function removerMedidaExtra(s: string, i: number) {
    const ed = getEditor(s);
    patchEditor(s, { medidasExtras: ed.medidasExtras.filter((_, idx) => idx !== i) });
  }

  function salvarCampos(extrasArg?: { status?: "CONCLUIDO" }) {
    if (!relatorio) return;
    const agravosMap: Record<string, string> = {};
    const medidasMap: Record<string, string> = {};
    for (const [s, ed] of Object.entries(editores)) {
      const a = serializeMultiSelect(ed.agravosSel, ed.agravosExtras);
      const m = serializeMultiSelect(ed.medidasSel, ed.medidasExtras);
      if (a) agravosMap[s] = a;
      if (m) medidasMap[s] = m;
    }
    // V54: ao concluir, carimba `data_conclusao` automaticamente. Se já
    // estiver concluído (re-clique), preserva o timestamp anterior.
    const concluindoAgora =
      extrasArg?.status === "CONCLUIDO" && relatorio.status !== "CONCLUIDO";
    salvar.mutate(
      {
        id_relatorio: idRelatorio,
        id_empresa: relatorio.id_empresa,
        agravos_por_setor: agravosMap,
        medidas_por_setor: medidasMap,
        ...(extrasArg?.status ? { status: extrasArg.status } : {}),
        ...(concluindoAgora
          ? { data_conclusao: new Date().toISOString() }
          : {}),
      },
      { onSuccess: () => setDirty(false) }
    );
  }

  const setoresParaRelatorio = useMemo<string[]>(() => {
    if (setor === "Todos") return listarSetores(respondentes);
    return [setor];
  }, [setor, respondentes]);

  const relatoriosPorSetor = useMemo<SetorRelatorio[]>(() => {
    return setoresParaRelatorio.map((s) => {
      const filtrados = filtrarPorSetor(respondentes, s);
      const topicos = calcularResumoCompleto(filtrados);
      const mapaProb = montarMapaProb(probabilidades, s);
      const topicosComMatriz = aplicarMatriz(topicos, mapaProb);
      const cargosSet = new Set<string>();
      for (const r of filtrados) {
        if (r.cargo && r.cargo.trim()) cargosSet.add(r.cargo.trim());
      }
      const funcoes = Array.from(cargosSet)
        .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
        .join(", ");
      return {
        setor: s,
        totalRespondentes: filtrados.length,
        funcoes,
        topicos: topicosComMatriz,
      };
    });
  }, [setoresParaRelatorio, respondentes, probabilidades]);

  const podeImprimir =
    !!relatorio &&
    respondentes.length > 0 &&
    setoresParaRelatorio.length > 0;

  return (
    <div className="space-y-4">
      <style>{`
        .drps-print-container {
          font-family: var(--font-sans), Inter, system-ui, sans-serif;
          color: #111827;
          font-size: 11px;
          line-height: 1.55;
        }
        @media print {
          @page { size: A4; margin: 1.4cm 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .drps-print-container { padding: 0 !important; box-shadow: none !important; border: none !important; }
          .drps-capitulos { break-after: page; }
          .drps-capitulo--capa { break-before: page; break-after: page; }
          .drps-capitulo--capa:first-child { break-before: auto; }
          .drps-setor-bloco { break-before: page; }
          .drps-setor-bloco:first-child { break-before: auto; }
          .drps-tabela tr, .drps-tabela td, .drps-tabela th { break-inside: avoid; }
        }
        .drps-tabela {
          border-collapse: collapse;
          width: 100%;
          font-size: 11px;
        }
        .drps-tabela td, .drps-tabela th {
          border: 1px solid #cbd5e1;
          padding: 7px 10px;
          vertical-align: top;
        }
        .drps-label {
          background: #f0f9f4;
          font-weight: 600;
          color: #1e4d28;
          font-size: 10.5px;
          letter-spacing: 0.02em;
          width: 30%;
        }
        .drps-header-section {
          background: #d4edda;
          color: #1e4d28;
          font-weight: 700;
          text-align: center;
          font-size: 11.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 8px 10px;
        }
        .drps-title {
          background: linear-gradient(180deg, #006B54 0%, #00563f 100%);
          color: white;
          font-weight: 700;
          font-size: 13px;
          text-align: center;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 12px;
        }
        .drps-capitulo {
          margin-bottom: 22px;
        }
        .drps-setor-bloco {
          margin-bottom: 24px;
        }
        .drps-setor-bloco .drps-tabela + .drps-tabela {
          margin-top: 0;
        }
        .drps-capitulo--capa {
          position: relative;
          min-height: calc(297mm - 2.8cm);
          margin: -1.5rem -1.5rem 0 -1.5rem;
          overflow: hidden;
          color: inherit;
        }
        .drps-capitulo-bg-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          z-index: 0;
        }
        .drps-capitulo--capa .drps-capitulo-titulo {
          display: none;
        }
        .drps-capitulo--capa .drps-capitulo-conteudo,
        .drps-capitulo--capa .drps-caixa-texto {
          position: relative;
          z-index: 1;
        }
        @media print {
          .drps-capitulo--capa {
            margin: 0;
            padding: 0;
            /* @page tem margin 1.4cm vertical x 1.2cm horizontal,
               entao a area util e 297mm - 2.8cm de altura.
               -1mm de seguranca pra evitar overflow por arredondamento. */
            height: calc(297mm - 2.8cm - 1mm);
            min-height: calc(297mm - 2.8cm - 1mm);
            max-height: calc(297mm - 2.8cm - 1mm);
          }
          .drps-capitulo--capa .drps-capitulo-conteudo {
            padding: 1.2cm;
          }
        }
        .drps-capitulo-titulo {
          font-size: 14px;
          font-weight: 700;
          color: #1e4d28;
          border-bottom: 2px solid #006B54;
          padding-bottom: 4px;
          margin-bottom: 8px;
        }
        .drps-capitulo-conteudo {
          font-size: 11px;
          color: #1f2937;
          line-height: 1.55;
        }
        .drps-capitulo-conteudo p { margin: 0 0 8px 0; }
        .drps-capitulo-conteudo h1 { font-size: 16px; font-weight: 700; color: #1e4d28; margin: 12px 0 6px; }
        .drps-capitulo-conteudo h2 { font-size: 14px; font-weight: 700; color: #1e4d28; margin: 10px 0 6px; }
        .drps-capitulo-conteudo h3 { font-size: 12px; font-weight: 700; color: #1e4d28; margin: 8px 0 4px; }
        .drps-capitulo-conteudo ul,
        .drps-capitulo-conteudo ol { margin: 0 0 8px 20px; padding: 0; }
        .drps-capitulo-conteudo li { margin: 2px 0; }
        .drps-capitulo-conteudo a { color: #006B54; text-decoration: underline; }
        .drps-capitulo-conteudo img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 8px 0;
        }
        .drps-capitulo-conteudo table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
          font-size: 10px;
        }
        .drps-capitulo-conteudo th,
        .drps-capitulo-conteudo td {
          border: 1px solid #999;
          padding: 5px 7px;
          vertical-align: top;
        }
        .drps-capitulo-conteudo th {
          background: #d4edda;
          color: #1e4d28;
          font-weight: 700;
          text-align: left;
        }
      `}</style>

      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-gray-900">
          Análise e Avaliação — Relatório DRPS
        </h1>
        <p className="text-sm text-gray-600">
          {relatorio
            ? `Rev. ${relatorio.revisao} · ${relatorio.responsavel_tecnico ?? "Sem responsável"}`
            : "Carregando..."}
        </p>
      </div>

      <div className="print:hidden">
        <DrpsFiltro idRelatorio={idRelatorio} />
      </div>

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          Nenhum respondente importado neste relatório.
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span>
                {setor === "Todos" ? (
                  <>
                    Relatório consolidado:{" "}
                    <strong>{setoresParaRelatorio.length} setor(es)</strong>
                  </>
                ) : (
                  <>
                    Setor: <strong>{setor}</strong> ·{" "}
                    {relatoriosPorSetor[0]?.totalRespondentes ?? 0} respondente(s)
                  </>
                )}
              </span>
              {dirty ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Alterações não salvas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2 py-0.5 text-[10px] font-medium text-verde-primary">
                  <CheckCircle2 className="size-3" />
                  Salvo
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => salvarCampos()}
                disabled={!canEdit || !dirty || salvar.isPending || !relatorio}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="size-3.5" />
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => salvarCampos({ status: "CONCLUIDO" })}
                disabled={!canEdit || salvar.isPending || !relatorio}
                className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary bg-white px-3 py-1.5 text-xs font-semibold text-verde-primary hover:bg-verde-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" />
                {relatorio?.status === "CONCLUIDO"
                  ? "Concluído"
                  : "Concluir Análise"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!podeImprimir}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
              >
                <Printer className="size-3.5" /> Gerar PDF
              </button>
            </div>
          </div>

          <div className="drps-print-container rounded border border-gray-300 bg-white p-6 shadow-sm">
            {/* Logo Chabra (só aparece quando NÃO há capítulos com capa próprios) */}
            {capitulos.length === 0 && (
              <RelatorioPrintHeader
                titulo="Diagnóstico de Riscos Psicossociais (DRPS)"
                subtitulo={empresa?.nome_empresa ?? null}
                terciario={
                  setor !== "Todos" ? `Setor: ${setor}` : "Consolidado por setor"
                }
              />
            )}
            {/* Texto padrão — posição "inicio" (capa, dedicatória) */}
            {renderCapitulosPosicao(
              capitulos,
              "inicio",
              valoresVars,
              "drps-capitulos-inicio"
            )}

            {/* Sumário (TOC) — só no print */}
            <DrpsSumarioPrint
              setores={relatoriosPorSetor.map((r) => r.setor)}
              valores={valoresVars}
              temConclusaoGeral={!!relatorio?.conclusao_geral}
              temMedidas={true}
              temMonitoramento={true}
              temRevisao={true}
            />

            {/* Texto padrão — posição "apos_sumario" (intro, metodologia) */}
            {renderCapitulosPosicao(
              capitulos,
              "apos_sumario",
              valoresVars,
              "drps-capitulos-apos-sumario"
            )}

            {relatoriosPorSetor.map((r, idx) => (
              <BlocoSetor
                key={r.setor}
                relatorio={r}
                drpsRel={relatorio ?? null}
                empresa={empresa ?? null}
                indice={idx + 1}
                total={relatoriosPorSetor.length}
                ehConsolidado={setor === "Todos"}
                canEdit={canEdit}
                conclusao={
                  relatorio?.conclusoes_por_setor?.[r.setor] ?? ""
                }
                onSalvarConclusao={(texto) => {
                  if (!relatorio || !canEdit) return;
                  const atual = relatorio.conclusoes_por_setor ?? {};
                  salvar.mutate({
                    id_relatorio: idRelatorio,
                    id_empresa: relatorio.id_empresa,
                    conclusoes_por_setor: {
                      ...atual,
                      [r.setor]: texto,
                    },
                  });
                }}
                editor={(() => {
                  const ed = getEditor(r.setor);
                  return {
                    agravosSel: ed.agravosSel,
                    agravosExtras: ed.agravosExtras,
                    medidasSel: ed.medidasSel,
                    medidasExtras: ed.medidasExtras,
                    novoAgravo: ed.novoAgravo,
                    novaMedida: ed.novaMedida,
                    toggleAgravo: (item) => toggleAgravo(r.setor, item),
                    toggleMedida: (item) => toggleMedida(r.setor, item),
                    adicionarAgravo: () => adicionarAgravo(r.setor),
                    adicionarMedida: () => adicionarMedida(r.setor),
                    removerAgravoExtra: (i) => removerAgravoExtra(r.setor, i),
                    removerMedidaExtra: (i) => removerMedidaExtra(r.setor, i),
                    setNovoAgravo: (v) =>
                      patchEditor(r.setor, { novoAgravo: v }),
                    setNovaMedida: (v) =>
                      patchEditor(r.setor, { novaMedida: v }),
                  };
                })()}
              />
            ))}

            {/* Texto padrão — posição "apos_setores" */}
            {renderCapitulosPosicao(
              capitulos,
              "apos_setores",
              valoresVars,
              "drps-capitulos-apos-setores"
            )}

            {/* Conclusão Geral — só no print quando preenchida */}
            {relatorio?.conclusao_geral && (
              <section className="drps-conclusao-geral-print hidden print:block">
                <style>{`
                  .drps-conclusao-geral-print {
                    page-break-before: always;
                    font-family: 'Times New Roman', Times, serif;
                  }
                  .drps-conclusao-geral-print h2 {
                    font-size: 16pt;
                    font-weight: 700;
                    color: #1e4d28;
                    border-bottom: 2px solid #006B54;
                    padding-bottom: 6px;
                    margin: 0 0 14pt 0;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                  }
                  .drps-conclusao-geral-print p {
                    font-size: 12pt;
                    line-height: 1.6;
                    text-align: justify;
                    color: #1f2937;
                    margin: 0 0 12pt 0;
                    text-indent: 1.25cm;
                    white-space: pre-wrap;
                  }
                `}</style>
                <h2>Conclusão Geral</h2>
                <p>{relatorio.conclusao_geral}</p>
              </section>
            )}

            {/* Texto padrão — posição "apos_conclusao" */}
            {renderCapitulosPosicao(
              capitulos,
              "apos_conclusao",
              valoresVars,
              "drps-capitulos-apos-conclusao"
            )}

            {/* Resumo executivo da gestão (página única antes do detalhamento) */}
            <DrpsGestaoResumoPrint idRelatorio={idRelatorio} />

            {/* Extras: Medidas / Monitoramento / Revisão */}
            <DrpsRelatorioExtrasPrint idRelatorio={idRelatorio} />

            {/* Texto padrão — posição "apos_medidas" */}
            {renderCapitulosPosicao(
              capitulos,
              "apos_medidas",
              valoresVars,
              "drps-capitulos-apos-medidas"
            )}

            {/* Texto padrão — posição "fim" (considerações finais) */}
            {renderCapitulosPosicao(
              capitulos,
              "fim",
              valoresVars,
              "drps-capitulos-fim"
            )}

            <p className="mt-6 text-center text-[9px] text-gray-500">
              Documento gerado pelo Painel SST Chabra em{" "}
              {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Renderiza apenas os capítulos de texto padrão da posição informada.
 * Substitui variáveis nos títulos e conteúdos. Mantém o mesmo CSS/estilo
 * do bloco principal `.drps-capitulos`.
 */
function renderCapitulosPosicao(
  capitulos: import("@/lib/drps/types").DrpsTextoPadraoCapitulo[],
  posicao: import("@/lib/drps/types").DrpsPosicaoPdf,
  valoresVars: Record<string, string>,
  className: string
) {
  const filtrados = capitulos.filter(
    (c) => (c.posicao_pdf ?? "inicio") === posicao
  );
  if (filtrados.length === 0) return null;
  return (
    <section className={`${className} drps-capitulos mb-6 hidden print:block`}>
      {filtrados.map((c) => {
        const ehCapa = !!c.bg_imagem_url;
        return (
          <article
            key={c.id_capitulo}
            className={
              ehCapa ? "drps-capitulo drps-capitulo--capa" : "drps-capitulo"
            }
          >
            {ehCapa && c.bg_imagem_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.bg_imagem_url}
                alt=""
                className="drps-capitulo-bg-img"
              />
            )}
            {!ehCapa && (
              <h2 className="drps-capitulo-titulo">
                {substituirVariaveisTexto(c.titulo, valoresVars)}
              </h2>
            )}
            {ehCapa && c.caixas_texto && c.caixas_texto.length > 0 ? (
              c.caixas_texto.map((cx) => (
                <div
                  key={cx.id}
                  className="drps-caixa-texto"
                  style={{
                    position: "absolute",
                    left: `${cx.x}%`,
                    top: `${cx.y}%`,
                    width: `${cx.w ?? 40}%`,
                    fontSize: cx.fontSize ?? 16,
                    fontWeight: cx.bold ? 700 : 400,
                    color: cx.color ?? "#ffffff",
                    textAlign: cx.align ?? "left",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.3,
                  }}
                >
                  {substituirVariaveisTexto(cx.conteudo, valoresVars)}
                </div>
              ))
            ) : c.conteudo ? (
              <div
                className="drps-capitulo-conteudo"
                dangerouslySetInnerHTML={{
                  __html: substituirVariaveis(c.conteudo, valoresVars),
                }}
              />
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

interface BlocoEditorProps {
  agravosSel: string[];
  agravosExtras: string[];
  medidasSel: string[];
  medidasExtras: string[];
  novoAgravo: string;
  novaMedida: string;
  toggleAgravo: (item: string) => void;
  toggleMedida: (item: string) => void;
  adicionarAgravo: () => void;
  adicionarMedida: () => void;
  removerAgravoExtra: (i: number) => void;
  removerMedidaExtra: (i: number) => void;
  setNovoAgravo: (v: string) => void;
  setNovaMedida: (v: string) => void;
}

function BlocoSetor({
  relatorio,
  drpsRel,
  empresa,
  indice,
  total,
  ehConsolidado,
  canEdit,
  conclusao,
  onSalvarConclusao,
  editor,
}: {
  relatorio: SetorRelatorio;
  drpsRel: DrpsRelatorio | null;
  empresa: Empresa | null;
  indice: number;
  total: number;
  ehConsolidado: boolean;
  canEdit: boolean;
  conclusao: string;
  onSalvarConclusao: (texto: string) => void;
  editor: BlocoEditorProps;
}) {
  const [textoLocal, setTextoLocal] = useState(conclusao);
  const [gerandoIA, setGerandoIA] = useState(false);

  useEffect(() => {
    setTextoLocal(conclusao);
  }, [conclusao]);

  async function gerarConclusaoIA() {
    if (relatorio.topicos.length === 0) {
      toast.error("Sem tópicos avaliados — não é possível gerar conclusão.");
      return;
    }
    setGerandoIA(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke(
        "gerar-conclusao-drps-ia",
        {
          body: {
            empresa: empresa
              ? { nome: empresa.nome_empresa, cnpj: empresa.cnpj ?? null }
              : null,
            setor: {
              nome: relatorio.setor,
              funcoes: relatorio.funcoes || null,
              totalRespondentes: relatorio.totalRespondentes,
            },
            ehConsolidado,
            responsavelTecnico: drpsRel?.responsavel_tecnico ?? null,
            crp: drpsRel?.crp ?? null,
            topicos: relatorio.topicos.map((t) => ({
              nome: t.nome.replace(/^Tópico \d+ - /, ""),
              fonteGeradora: t.fonteGeradora,
              gravidade: t.classificacaoGravidade.texto,
              probabilidade: t.classificacaoProbabilidade,
              matriz: t.matriz,
            })),
            agravos: drpsRel?.agravos_por_setor?.[relatorio.setor] ?? null,
            medidasExistentes:
              drpsRel?.medidas_por_setor?.[relatorio.setor] ?? null,
            textoAtual: textoLocal || null,
          },
        }
      );
      if (error) throw error;
      const novoTexto = (data as { data?: { conclusao?: string } } | null)?.data
        ?.conclusao;
      if (!novoTexto) throw new Error("Resposta vazia da IA");
      setTextoLocal(novoTexto);
      onSalvarConclusao(novoTexto);
      toast.success("Conclusão gerada pela IA — revise antes de assinar.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao gerar conclusão com IA"
      );
    } finally {
      setGerandoIA(false);
    }
  }

  const identificadores: { label: string; valor: string }[] = [];
  if (empresa?.cnpj) {
    identificadores.push({ label: "CNPJ", valor: formatCNPJ(empresa.cnpj) });
  }
  if (empresa?.cpf) {
    identificadores.push({ label: "CPF", valor: formatCPF(empresa.cpf) });
  }
  if (empresa?.cei) {
    identificadores.push({ label: "CEI", valor: formatCEI(empresa.cei) });
  }
  if (empresa?.caepf) {
    identificadores.push({
      label: "CAEPF",
      valor: formatCAEPF(empresa.caepf),
    });
  }
  if (empresa?.cno) {
    identificadores.push({ label: "CNO", valor: formatCNO(empresa.cno) });
  }
  if (identificadores.length === 0) {
    identificadores.push({ label: "CNPJ", valor: "—" });
  }
  return (
    <section className="drps-setor-bloco mb-4">
      <table className="drps-tabela mb-0">
        <tbody>
          <tr>
            <td className="drps-title" colSpan={4}>
              <div className="flex items-center justify-center gap-3">
                <span>DRPS — Diagnóstico de Riscos Psicossociais</span>
                {drpsRel && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                    Rev. {drpsRel.revisao}
                  </span>
                )}
                {ehConsolidado && (
                  <span className="text-[10px] font-normal opacity-80">
                    {indice}/{total}
                  </span>
                )}
              </div>
            </td>
          </tr>
          <tr>
            <td className="drps-label" style={{ width: "30%" }}>
              Responsável Técnico pela Avaliação (Psicólogo)
            </td>
            <td>{drpsRel?.responsavel_tecnico ?? ""}</td>
            <td className="drps-label" style={{ width: "10%" }}>
              CRP
            </td>
            <td style={{ width: "20%" }}>{drpsRel?.crp ?? ""}</td>
          </tr>
          <tr>
            <td className="drps-header-section" colSpan={4}>
              IDENTIFICAÇÃO
            </td>
          </tr>
          <tr>
            <td className="drps-label">{identificadores[0].label}</td>
            <td>{identificadores[0].valor}</td>
            <td className="drps-label">Data da Elaboração</td>
            <td>
              {drpsRel?.data_elaboracao
                ? new Date(
                    drpsRel.data_elaboracao + "T00:00:00"
                  ).toLocaleDateString("pt-BR")
                : ""}
            </td>
          </tr>
          {identificadores.slice(1).map((ident) => (
            <tr key={ident.label}>
              <td className="drps-label">{ident.label}</td>
              <td colSpan={3}>{ident.valor}</td>
            </tr>
          ))}
          <tr>
            <td className="drps-label">Empresa</td>
            <td colSpan={3}>{empresa?.nome_empresa ?? "—"}</td>
          </tr>
          <tr>
            <td className="drps-label">Setor</td>
            <td colSpan={3}>{relatorio.setor}</td>
          </tr>
          <tr>
            <td className="drps-label">Funções</td>
            <td colSpan={3}>{relatorio.funcoes || "—"}</td>
          </tr>
          <tr>
            <td className="drps-label">
              Quantidade de Trabalhadores na Função
            </td>
            <td colSpan={3}>{relatorio.totalRespondentes}</td>
          </tr>
          <tr>
            <td className="drps-label align-top">
              Possíveis Agravos à Saúde Mental
              <div className="mt-1 text-[9px] font-normal italic text-gray-600">
                Ex: tudo aquilo que pode acontecer com colaboradores se os
                riscos psicossociais não forem identificados e controlados.
              </div>
            </td>
            <td colSpan={3} className="align-top">
              <div className="print:hidden">
                <MultiSelectInline
                  opcoes={AGRAVOS_OPCOES}
                  selecionados={editor.agravosSel}
                  extras={editor.agravosExtras}
                  novoValor={editor.novoAgravo}
                  onToggle={editor.toggleAgravo}
                  onAdd={editor.adicionarAgravo}
                  onRemoveExtra={editor.removerAgravoExtra}
                  onNovoValor={editor.setNovoAgravo}
                  placeholder="Adicionar outro agravo..."
                  disabled={!canEdit}
                />
              </div>
              <div className="hidden whitespace-pre-wrap print:block">
                {drpsRel?.agravos_por_setor?.[relatorio.setor] ?? ""}
              </div>
            </td>
          </tr>
          <tr>
            <td className="drps-label align-top">
              Medidas de Controle Existentes
              <div className="mt-1 text-[9px] font-normal italic text-gray-600">
                Ex: ações que a empresa já realiza para controle dos riscos
                psicossociais.
              </div>
            </td>
            <td colSpan={3} className="align-top">
              <div className="print:hidden">
                <MultiSelectInline
                  opcoes={MEDIDAS_EXISTENTES_OPCOES}
                  selecionados={editor.medidasSel}
                  extras={editor.medidasExtras}
                  novoValor={editor.novaMedida}
                  onToggle={editor.toggleMedida}
                  onAdd={editor.adicionarMedida}
                  onRemoveExtra={editor.removerMedidaExtra}
                  onNovoValor={editor.setNovaMedida}
                  placeholder="Adicionar outra medida..."
                  disabled={!canEdit}
                />
              </div>
              <div className="hidden whitespace-pre-wrap print:block">
                {drpsRel?.medidas_por_setor?.[relatorio.setor] ?? ""}
              </div>
            </td>
          </tr>
          <tr>
            <td className="drps-header-section" colSpan={4}>
              Classificação de Risco Psicossocial
            </td>
          </tr>
          <tr>
            <td
              colSpan={4}
              className="text-center text-[11px] font-semibold uppercase tracking-wider"
              style={{ background: "#f0f9f4", color: "#1e4d28" }}
            >
              Quantitativo e Qualitativo
            </td>
          </tr>
        </tbody>
      </table>

      <table className="drps-tabela mt-0">
        <thead>
          <tr>
            <th
              className="drps-label"
              style={{ width: "30%", textAlign: "left" }}
            >
              Fatores de Risco
            </th>
            <th
              className="drps-label"
              style={{ width: "35%", textAlign: "left" }}
            >
              Fontes Geradoras do Risco
            </th>
            <th className="drps-label" style={{ width: "11%" }}>
              Gravidade
              <br />
              <span className="text-[9px] font-normal italic">
                (Severidade)
              </span>
            </th>
            <th className="drps-label" style={{ width: "12%" }}>
              Probabilidade
              <br />
              <span className="text-[9px] font-normal italic">
                de Ocorrência
              </span>
            </th>
            <th className="drps-label" style={{ width: "12%" }}>
              Matriz de Risco
            </th>
          </tr>
        </thead>
        <tbody>
          {relatorio.topicos.map((t) => (
            <tr key={t.idx}>
              <td className="text-[11px] text-gray-900">
                {t.nome.replace(/^Tópico \d+ - /, "")}
              </td>
              <td className="text-[10px] text-gray-700">{t.fonteGeradora}</td>
              <td className="text-center">
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: t.classificacaoGravidade.cor }}
                >
                  {t.classificacaoGravidade.texto}
                </span>
              </td>
              <td className="text-center text-[10px] text-gray-700">
                {t.classificacaoProbabilidade}
              </td>
              <td className="text-center">
                <span
                  className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: t.corMatriz }}
                >
                  {t.matriz}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 text-[9px] text-gray-500">
        {relatorio.totalRespondentes} respondente(s) · {relatorio.topicos.length}{" "}
        tópico(s)
      </div>

      <table className="drps-tabela mt-2">
        <tbody>
          <tr>
            <td className="drps-header-section">
              <div className="flex items-center justify-between gap-2">
                <span>Conclusão</span>
                <button
                  type="button"
                  onClick={gerarConclusaoIA}
                  disabled={
                    !canEdit || gerandoIA || relatorio.topicos.length === 0
                  }
                  title="Gerar conclusão técnica com IA a partir dos tópicos avaliados, agravos e medidas existentes"
                  className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2 py-1 text-[10px] font-semibold normal-case tracking-normal text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
                >
                  {gerandoIA ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  {gerandoIA ? "Gerando..." : "Gerar com IA"}
                </button>
              </div>
            </td>
          </tr>
          <tr>
            <td className="align-top">
              <textarea
                value={textoLocal}
                onChange={(e) => setTextoLocal(e.target.value)}
                onBlur={() => {
                  if (canEdit && textoLocal !== conclusao)
                    onSalvarConclusao(textoLocal);
                }}
                disabled={!canEdit}
                rows={4}
                placeholder={
                  canEdit
                    ? "Conclusão do psicólogo para o setor — clique para editar ou use 'Gerar com IA'."
                    : "Você não tem permissão para editar a conclusão."
                }
                className="w-full border-0 bg-transparent p-0 text-[11px] leading-relaxed text-gray-900 focus:outline-none focus:ring-0 resize-none disabled:cursor-not-allowed print:hidden"
              />
              <div
                className="hidden whitespace-pre-wrap text-[11px] leading-relaxed text-gray-900 print:block"
                style={{ minHeight: 70 }}
              >
                {textoLocal || (
                  <span className="italic text-gray-400">
                    (Conclusão não preenchida)
                  </span>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function MultiSelectInline({
  opcoes,
  selecionados,
  extras,
  novoValor,
  onToggle,
  onAdd,
  onRemoveExtra,
  onNovoValor,
  placeholder,
  disabled = false,
}: {
  opcoes: string[];
  selecionados: string[];
  extras: string[];
  novoValor: string;
  onToggle: (item: string) => void;
  onAdd: () => void;
  onRemoveExtra: (i: number) => void;
  onNovoValor: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const total = selecionados.length + extras.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
      >
        <span className={total === 0 ? "text-gray-400" : "text-gray-700"}>
          {total === 0
            ? "Selecionar..."
            : `${total} selecionado${total === 1 ? "" : "s"}`}
        </span>
        <ChevronDown
          className={`size-3.5 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <ul className="max-h-56 overflow-auto py-1">
            {opcoes.map((opt) => {
              const marcado = selecionados.includes(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => onToggle(opt)}
                    className={`flex w-full items-center gap-2 px-3 py-1 text-left text-[11px] hover:bg-verde-light ${
                      marcado ? "bg-verde-light/60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      readOnly
                      className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                    />
                    <span className="text-gray-800">{opt}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(selecionados.length > 0 || extras.length > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selecionados.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2 py-0.5 text-[10px] text-verde-primary"
            >
              {s}
              <button
                type="button"
                onClick={() => onToggle(s)}
                className="text-verde-primary/60 hover:text-red-600"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {extras.map((e, i) => (
            <span
              key={`extra-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800"
            >
              {e}
              <button
                type="button"
                onClick={() => onRemoveExtra(i)}
                className="text-amber-700/60 hover:text-red-600"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex gap-1.5">
        <input
          type="text"
          value={novoValor}
          onChange={(e) => onNovoValor(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || !novoValor.trim()}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3" />
        </button>
      </div>
    </div>
  );
}
