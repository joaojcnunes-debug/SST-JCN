"use client";

import { useEffect, useMemo, useState, use } from "react";
import { Printer, Save, Plus, X, CheckCircle2 } from "lucide-react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import { useDrpsStore } from "@/lib/drps/store";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
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

  const [agravosSel, setAgravosSel] = useState<string[]>([]);
  const [agravosExtras, setAgravosExtras] = useState<string[]>([]);
  const [medidasSel, setMedidasSel] = useState<string[]>([]);
  const [medidasExtras, setMedidasExtras] = useState<string[]>([]);
  const [novoAgravo, setNovoAgravo] = useState("");
  const [novaMedida, setNovaMedida] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!relatorio) return;
    const a = parseMultiSelect(
      relatorio.agravos_saude_mental,
      AGRAVOS_OPCOES
    );
    const m = parseMultiSelect(
      relatorio.medidas_existentes,
      MEDIDAS_EXISTENTES_OPCOES
    );
    setAgravosSel(a.selecionados);
    setAgravosExtras(a.extras);
    setMedidasSel(m.selecionados);
    setMedidasExtras(m.extras);
    setDirty(false);
  }, [relatorio]);

  function toggleAgravo(item: string) {
    setAgravosSel((s) =>
      s.includes(item) ? s.filter((a) => a !== item) : [...s, item]
    );
    setDirty(true);
  }
  function toggleMedida(item: string) {
    setMedidasSel((s) =>
      s.includes(item) ? s.filter((a) => a !== item) : [...s, item]
    );
    setDirty(true);
  }
  function adicionarAgravo() {
    const v = novoAgravo.trim();
    if (!v) return;
    setAgravosExtras((s) => [...s, v]);
    setNovoAgravo("");
    setDirty(true);
  }
  function adicionarMedida() {
    const v = novaMedida.trim();
    if (!v) return;
    setMedidasExtras((s) => [...s, v]);
    setNovaMedida("");
    setDirty(true);
  }
  function removerAgravoExtra(i: number) {
    setAgravosExtras((s) => s.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function removerMedidaExtra(i: number) {
    setMedidasExtras((s) => s.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  function salvarCampos(extras?: { status?: "CONCLUIDO" }) {
    if (!relatorio) return;
    salvar.mutate(
      {
        id_relatorio: idRelatorio,
        id_empresa: relatorio.id_empresa,
        agravos_saude_mental: serializeMultiSelect(agravosSel, agravosExtras),
        medidas_existentes: serializeMultiSelect(medidasSel, medidasExtras),
        ...(extras?.status ? { status: extras.status } : {}),
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
        @media print {
          @page { size: A4; margin: 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
        }
        .drps-tabela td, .drps-tabela th {
          border: 1px solid #999;
          padding: 6px 8px;
          vertical-align: middle;
        }
        .drps-label {
          background: #d4edda;
          font-weight: 600;
          color: #1e4d28;
          font-size: 11px;
        }
        .drps-header-section {
          background: #d4edda;
          color: #1e4d28;
          font-weight: 700;
          text-align: center;
          font-size: 12px;
        }
        .drps-title {
          background: #006B54;
          color: white;
          font-weight: 700;
          font-size: 14px;
          text-align: center;
          letter-spacing: 0.5px;
        }
        .drps-capitulo {
          margin-bottom: 18px;
        }
        .drps-capitulo--capa {
          position: relative;
          min-height: calc(297mm - 2.4cm);
          padding: 1.5cm;
          margin: -1.5rem -1.5rem 0 -1.5rem;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          color: inherit;
          overflow: hidden;
        }
        .drps-capitulo--capa .drps-capitulo-titulo {
          display: none;
        }
        .drps-capitulo--capa .drps-capitulo-conteudo {
          position: relative;
          z-index: 1;
        }
        @media print {
          .drps-capitulo--capa {
            margin: 0;
            padding: 0;
            min-height: 100vh;
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

      <div className="print:hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Diagnóstico Descritivo
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => salvarCampos()}
              disabled={!dirty || salvar.isPending || !relatorio}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => salvarCampos({ status: "CONCLUIDO" })}
              disabled={salvar.isPending || !relatorio}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
            >
              <CheckCircle2 className="size-3.5" />
              {relatorio?.status === "CONCLUIDO"
                ? "Concluído"
                : "Concluir Análise e Avaliação"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Possíveis Agravos à Saúde Mental
            </h3>
            <p className="mb-2 text-[10px] italic text-gray-500">
              Marque os agravos aplicáveis e adicione outros manualmente.
            </p>
            <div className="space-y-1">
              {AGRAVOS_OPCOES.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-0.5 text-xs hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={agravosSel.includes(opt)}
                    onChange={() => toggleAgravo(opt)}
                    className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                  />
                  <span className="text-gray-800">{opt}</span>
                </label>
              ))}
            </div>
            {agravosExtras.length > 0 && (
              <div className="mt-2 space-y-1">
                {agravosExtras.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded bg-amber-50 px-2 py-1 text-xs"
                  >
                    <span className="flex-1 text-gray-800">{e}</span>
                    <button
                      type="button"
                      onClick={() => removerAgravoExtra(i)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                value={novoAgravo}
                onChange={(e) => setNovoAgravo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarAgravo()}
                placeholder="Adicionar outro agravo..."
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              />
              <button
                type="button"
                onClick={adicionarAgravo}
                disabled={!novoAgravo.trim()}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Medidas de Controle Existentes
            </h3>
            <p className="mb-2 text-[10px] italic text-gray-500">
              Marque as medidas que a empresa já adota e adicione outras
              manualmente.
            </p>
            <div className="space-y-1">
              {MEDIDAS_EXISTENTES_OPCOES.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-0.5 text-xs hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={medidasSel.includes(opt)}
                    onChange={() => toggleMedida(opt)}
                    className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                  />
                  <span className="text-gray-800">{opt}</span>
                </label>
              ))}
            </div>
            {medidasExtras.length > 0 && (
              <div className="mt-2 space-y-1">
                {medidasExtras.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded bg-amber-50 px-2 py-1 text-xs"
                  >
                    <span className="flex-1 text-gray-800">{e}</span>
                    <button
                      type="button"
                      onClick={() => removerMedidaExtra(i)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                value={novaMedida}
                onChange={(e) => setNovaMedida(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarMedida()}
                placeholder="Adicionar outra medida..."
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              />
              <button
                type="button"
                onClick={adicionarMedida}
                disabled={!novaMedida.trim()}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          Nenhum respondente importado neste relatório.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="text-xs text-gray-600">
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
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!podeImprimir}
              className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
            >
              <Printer className="size-4" /> Gerar PDF
            </button>
          </div>

          <div className="drps-print-container rounded border border-gray-300 bg-white p-6 shadow-sm">
            {capitulos.length > 0 && (
              <section className="drps-capitulos mb-6">
                {capitulos.map((c) => {
                  const ehCapa = !!c.bg_imagem_url;
                  return (
                    <article
                      key={c.id_capitulo}
                      className={
                        ehCapa
                          ? "drps-capitulo drps-capitulo--capa"
                          : "drps-capitulo"
                      }
                      style={
                        ehCapa
                          ? { backgroundImage: `url(${c.bg_imagem_url})` }
                          : undefined
                      }
                    >
                      {!ehCapa && (
                        <h2 className="drps-capitulo-titulo">
                          {substituirVariaveisTexto(c.titulo, valoresVars)}
                        </h2>
                      )}
                      {c.conteudo && (
                        <div
                          className="drps-capitulo-conteudo"
                          dangerouslySetInnerHTML={{
                            __html: substituirVariaveis(
                              c.conteudo,
                              valoresVars
                            ),
                          }}
                        />
                      )}
                    </article>
                  );
                })}
              </section>
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
              />
            ))}

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

function BlocoSetor({
  relatorio,
  drpsRel,
  empresa,
  indice,
  total,
  ehConsolidado,
}: {
  relatorio: SetorRelatorio;
  drpsRel: DrpsRelatorio | null;
  empresa: Empresa | null;
  indice: number;
  total: number;
  ehConsolidado: boolean;
}) {
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
              DRPS — DIAGNÓSTICO DE RISCOS PSICOSSOCIAIS
              {drpsRel && (
                <span className="ml-3 text-[10px] font-normal opacity-90">
                  · Rev. {drpsRel.revisao}
                </span>
              )}
              {ehConsolidado && (
                <span className="ml-3 text-[10px] font-normal opacity-90">
                  · Página {indice} de {total}
                </span>
              )}
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
            <td colSpan={3} className="whitespace-pre-wrap align-top">
              {drpsRel?.agravos_saude_mental ?? ""}
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
            <td colSpan={3} className="whitespace-pre-wrap align-top">
              {drpsRel?.medidas_existentes ?? ""}
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
    </section>
  );
}
