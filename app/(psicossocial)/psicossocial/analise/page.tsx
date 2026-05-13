"use client";

import { useMemo } from "react";
import { Printer } from "lucide-react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import { useDrpsStore } from "@/lib/drps/store";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import {
  useDrpsEmpresaConfig,
  useDrpsProbabilidades,
  useDrpsRespondentes,
} from "@/lib/hooks/useDrps";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
  listarSetores,
} from "@/lib/drps/calculos";
import { TOPICOS } from "@/lib/drps/topicos";
import { formatCNPJ } from "@/lib/utils";
import type {
  DrpsEmpresaConfig,
  DrpsProbabilidade,
  TopicoComMatriz,
} from "@/lib/drps/types";

interface SetorRelatorio {
  setor: string;
  totalRespondentes: number;
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

export default function DrpsAnalisePage() {
  const idEmpresa = useDrpsStore((s) => s.idEmpresa);
  const setor = useDrpsStore((s) => s.setor);
  const { data: empresa } = useEmpresa(idEmpresa);
  const { data: config } = useDrpsEmpresaConfig(idEmpresa);
  const { data: respondentes = [] } = useDrpsRespondentes(idEmpresa);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idEmpresa);

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
      return {
        setor: s,
        totalRespondentes: filtrados.length,
        topicos: topicosComMatriz,
      };
    });
  }, [setoresParaRelatorio, respondentes, probabilidades]);

  const totalRespondentesGeral = respondentes.length;
  const podeImprimir =
    !!idEmpresa &&
    respondentes.length > 0 &&
    setoresParaRelatorio.length > 0;

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .drps-print-container { padding: 0 !important; box-shadow: none !important; border: none !important; }
          .drps-setor-bloco { break-before: page; }
          .drps-setor-bloco:first-of-type { break-before: auto; }
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
          text-transform: none;
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
      `}</style>

      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-gray-900">
          Análise e Avaliação — Relatório DRPS
        </h1>
        <p className="text-sm text-gray-600">
          Documento formal para anexar ao PGR. Setor específico = 1 setor;
          &ldquo;Todos os setores&rdquo; = consolidado (1 página por setor).
        </p>
      </div>

      <div className="print:hidden">
        <DrpsFiltro />
      </div>

      {!idEmpresa ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          Selecione uma empresa.
        </div>
      ) : respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          Nenhum respondente importado para esta empresa.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="text-xs text-gray-600">
              {setor === "Todos" ? (
                <>
                  Relatório consolidado:{" "}
                  <strong>{setoresParaRelatorio.length} setor(es)</strong> ·{" "}
                  {totalRespondentesGeral} respondente(s)
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

          {/* RELATÓRIO */}
          <div className="drps-print-container rounded border border-gray-300 bg-white p-6 shadow-sm">
            {relatoriosPorSetor.map((r, idx) => (
              <BlocoSetor
                key={r.setor}
                relatorio={r}
                empresa={empresa?.nome_empresa ?? "—"}
                cnpj={empresa?.cnpj ? formatCNPJ(empresa.cnpj) : "—"}
                config={config ?? null}
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
  empresa,
  cnpj,
  config,
  indice,
  total,
  ehConsolidado,
}: {
  relatorio: SetorRelatorio;
  empresa: string;
  cnpj: string;
  config: DrpsEmpresaConfig | null;
  indice: number;
  total: number;
  ehConsolidado: boolean;
}) {
  return (
    <section className="drps-setor-bloco mb-4">
      {/* Banner do topo: verde Chabra com título do diagnóstico */}
      <table className="drps-tabela mb-0">
        <tbody>
          <tr>
            <td className="drps-title" colSpan={4}>
              DRPS — DIAGNÓSTICO DE RISCOS PSICOSSOCIAIS
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
            <td>{config?.responsavel_tecnico ?? ""}</td>
            <td className="drps-label" style={{ width: "10%" }}>
              CRP
            </td>
            <td style={{ width: "20%" }}>{config?.crp ?? ""}</td>
          </tr>
          <tr>
            <td className="drps-header-section" colSpan={4}>
              IDENTIFICAÇÃO
            </td>
          </tr>
          <tr>
            <td className="drps-label">CNPJ</td>
            <td>{cnpj}</td>
            <td className="drps-label">Data da Elaboração</td>
            <td>
              {config?.data_elaboracao
                ? new Date(
                    config.data_elaboracao + "T00:00:00"
                  ).toLocaleDateString("pt-BR")
                : ""}
            </td>
          </tr>
          <tr>
            <td className="drps-label">Empresa</td>
            <td colSpan={3}>{empresa}</td>
          </tr>
          <tr>
            <td className="drps-label">Setor</td>
            <td colSpan={3}>{relatorio.setor}</td>
          </tr>
          <tr>
            <td className="drps-label">Funções</td>
            <td colSpan={3}>{config?.funcoes ?? ""}</td>
          </tr>
          <tr>
            <td className="drps-label">
              Quantidade de Trabalhadores na Função
            </td>
            <td>{config?.qtd_trabalhadores ?? ""}</td>
            <td className="drps-label">Homens</td>
            <td>
              {config?.qtd_homens ?? ""}
              {config?.qtd_mulheres !== null &&
                config?.qtd_mulheres !== undefined && (
                  <>
                    {" · "}
                    <span className="text-[10px] uppercase tracking-wider text-gray-600">
                      Mulheres
                    </span>{" "}
                    {config.qtd_mulheres}
                  </>
                )}
            </td>
          </tr>
          <tr>
            <td className="drps-label align-top">
              Possíveis Agravos à Saúde Mental
              <div className="mt-1 text-[9px] font-normal italic text-gray-600">
                Ex: tudo aquilo que pode acontecer com colaboradores se os
                riscos psicossociais não forem identificados e controlados,
                incluindo transtornos psicológicos e emocionais como burnout
                etc.
              </div>
            </td>
            <td colSpan={3} className="whitespace-pre-wrap align-top">
              {config?.agravos_saude_mental ?? ""}
            </td>
          </tr>
          <tr>
            <td className="drps-label align-top">
              Medidas de Controle Existentes
              <div className="mt-1 text-[9px] font-normal italic text-gray-600">
                Ex: ações que a empresa já realiza para controle dos riscos
                psicossociais, se houver.
              </div>
            </td>
            <td colSpan={3} className="whitespace-pre-wrap align-top">
              {config?.medidas_existentes ?? ""}
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

      {/* Tabela de Fatores de Risco */}
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
              <span className="text-[9px] font-normal italic">(Severidade)</span>
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

      <div className="mt-2 flex items-center justify-between text-[9px] text-gray-500">
        <span>
          {relatorio.totalRespondentes} respondente(s) considerado(s) ·{" "}
          {relatorio.topicos.length} tópico(s) avaliado(s)
        </span>
        <span>
          Legenda: <span className="text-green-700">■</span> Baixo ·{" "}
          <span className="text-amber-600">■</span> Médio ·{" "}
          <span className="text-red-600">■</span> Alto ·{" "}
          <span className="text-gray-900">■</span> Crítico
        </span>
      </div>
    </section>
  );
}
