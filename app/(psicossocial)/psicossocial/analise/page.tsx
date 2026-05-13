"use client";

import { useMemo } from "react";
import { Printer, FileText } from "lucide-react";
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

  // Lista de setores a incluir no relatório:
  // - "Todos" no filtro → todos os setores únicos
  // - Setor específico → só ele
  const setoresParaRelatorio = useMemo<string[]>(() => {
    if (setor === "Todos") return listarSetores(respondentes);
    return [setor];
  }, [setor, respondentes]);

  // Calcula cada setor com sua própria matriz
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
          @page { size: A4; margin: 1.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .drps-print-container { padding: 0 !important; box-shadow: none !important; border: none !important; }
          .drps-print-section { break-inside: avoid; }
          .drps-setor-bloco { break-before: page; }
          .drps-setor-bloco:first-of-type { break-before: auto; }
        }
      `}</style>

      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-gray-900">
          Análise e Avaliação — Relatório DRPS
        </h1>
        <p className="text-sm text-gray-600">
          Documento formal para anexar ao PGR. Escolha o setor no filtro:{" "}
          <strong>setor específico</strong> = relatório de 1 setor.{" "}
          <strong>Todos os setores</strong> = relatório consolidado (cada
          setor numa página).
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
                  {totalRespondentesGeral} respondente(s) no total
                </>
              ) : (
                <>
                  Setor avaliado: <strong>{setor}</strong> ·{" "}
                  {relatoriosPorSetor[0]?.totalRespondentes ?? 0}{" "}
                  respondente(s) · {relatoriosPorSetor[0]?.topicos.length ?? 0}{" "}
                  tópico(s)
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
          <div className="drps-print-container rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <CabecalhoRelatorio
              empresa={empresa?.nome_empresa ?? "—"}
              cnpj={empresa?.cnpj ? formatCNPJ(empresa.cnpj) : "—"}
              config={config ?? null}
              ehConsolidado={setor === "Todos"}
              totalSetores={setoresParaRelatorio.length}
              totalRespondentes={totalRespondentesGeral}
            />

            {relatoriosPorSetor.map((r, idx) => (
              <BlocoSetor
                key={r.setor}
                relatorio={r}
                ehConsolidado={setor === "Todos"}
                indice={idx + 1}
                total={relatoriosPorSetor.length}
              />
            ))}

            <footer className="mt-8 border-t border-gray-300 pt-3 text-center text-[10px] text-gray-500">
              Documento gerado pelo Painel SST Chabra em{" "}
              {new Date().toLocaleDateString("pt-BR")}
            </footer>
          </div>
        </>
      )}
    </div>
  );
}

function CabecalhoRelatorio({
  empresa,
  cnpj,
  config,
  ehConsolidado,
  totalSetores,
  totalRespondentes,
}: {
  empresa: string;
  cnpj: string;
  config: DrpsEmpresaConfig | null;
  ehConsolidado: boolean;
  totalSetores: number;
  totalRespondentes: number;
}) {
  return (
    <>
      <header className="drps-print-section mb-6 border-b-2 border-verde-primary pb-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <FileText className="size-8 text-verde-primary" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              DRPS — Diagnóstico de Riscos Psicossociais
            </h2>
            <p className="text-xs text-gray-500">
              NR-01 · Portaria MTE nº 1.419/2024
            </p>
            {ehConsolidado && (
              <p className="mt-1 text-xs font-semibold text-verde-primary">
                Relatório Consolidado · {totalSetores} setor(es) ·{" "}
                {totalRespondentes} respondente(s)
              </p>
            )}
          </div>
        </div>
      </header>

      <section className="drps-print-section mb-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
          Identificação da Empresa
        </h3>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <Linha label="Empresa" valor={empresa} />
          <Linha label="CNPJ" valor={cnpj} />
          <Linha
            label="Responsável Técnico"
            valor={config?.responsavel_tecnico ?? "—"}
          />
          <Linha label="CRP" valor={config?.crp ?? "—"} />
          <Linha
            label="Data de elaboração"
            valor={
              config?.data_elaboracao
                ? new Date(
                    config.data_elaboracao + "T00:00:00"
                  ).toLocaleDateString("pt-BR")
                : "—"
            }
          />
          <Linha
            label="Total de trabalhadores"
            valor={config?.qtd_trabalhadores?.toString() ?? "—"}
          />
        </div>
      </section>

      {config?.funcoes && (
        <section className="drps-print-section mb-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            Funções Avaliadas
          </h3>
          <p className="whitespace-pre-wrap text-sm text-gray-800">
            {config.funcoes}
          </p>
        </section>
      )}

      {config?.agravos_saude_mental && (
        <section className="drps-print-section mb-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            Possíveis Agravos à Saúde Mental
          </h3>
          <p className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
            {config.agravos_saude_mental}
          </p>
        </section>
      )}

      {config?.medidas_existentes && (
        <section className="drps-print-section mb-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            Medidas de Controle já Existentes
          </h3>
          <p className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
            {config.medidas_existentes}
          </p>
        </section>
      )}
    </>
  );
}

function BlocoSetor({
  relatorio,
  ehConsolidado,
  indice,
  total,
}: {
  relatorio: SetorRelatorio;
  ehConsolidado: boolean;
  indice: number;
  total: number;
}) {
  return (
    <section className="drps-setor-bloco drps-print-section mb-5 mt-6 first:mt-0">
      <div className="mb-3 rounded border-l-4 border-verde-primary bg-verde-light/30 px-3 py-2">
        <h3 className="text-sm font-bold text-gray-900">
          {ehConsolidado && (
            <span className="mr-2 text-xs text-gray-500">
              [{indice}/{total}]
            </span>
          )}
          Setor: {relatorio.setor}
        </h3>
        <p className="text-xs text-gray-600">
          {relatorio.totalRespondentes} respondente(s) ·{" "}
          {relatorio.topicos.length} tópico(s) avaliado(s)
        </p>
      </div>

      {relatorio.topicos.length === 0 ? (
        <p className="text-sm text-gray-500">
          Sem dados suficientes para este setor.
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-gray-300">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 text-[10px] uppercase text-gray-700">
              <tr>
                <th className="border-r border-gray-300 px-2 py-1.5 text-left font-bold">
                  Fator de Risco
                </th>
                <th className="border-r border-gray-300 px-2 py-1.5 text-left font-bold">
                  Fonte Geradora
                </th>
                <th className="border-r border-gray-300 px-2 py-1.5 text-center font-bold w-20">
                  Gravidade
                </th>
                <th className="border-r border-gray-300 px-2 py-1.5 text-center font-bold w-24">
                  Probabilidade
                </th>
                <th className="px-2 py-1.5 text-center font-bold w-24">
                  Matriz de Risco
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {relatorio.topicos.map((t) => (
                <tr key={t.idx}>
                  <td className="border-r border-gray-300 px-2 py-1.5 font-medium text-gray-900">
                    {t.idx + 1}. {t.nome}
                  </td>
                  <td className="border-r border-gray-300 px-2 py-1.5 text-gray-700">
                    {t.fonteGeradora}
                  </td>
                  <td className="border-r border-gray-300 px-2 py-1.5 text-center">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: t.classificacaoGravidade.cor }}
                    >
                      {t.classificacaoGravidade.texto}
                    </span>
                  </td>
                  <td className="border-r border-gray-300 px-2 py-1.5 text-center text-gray-700">
                    {t.classificacaoProbabilidade}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className="inline-flex rounded-full px-3 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: t.corMatriz }}
                    >
                      {t.matriz}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold text-gray-700">{label}:</span>
      <span className="text-gray-900">{valor}</span>
    </div>
  );
}
