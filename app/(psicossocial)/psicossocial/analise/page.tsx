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
} from "@/lib/drps/calculos";
import { formatCNPJ } from "@/lib/utils";

export default function DrpsAnalisePage() {
  const idEmpresa = useDrpsStore((s) => s.idEmpresa);
  const setor = useDrpsStore((s) => s.setor);
  const { data: empresa } = useEmpresa(idEmpresa);
  const { data: config } = useDrpsEmpresaConfig(idEmpresa);
  const { data: respondentes = [] } = useDrpsRespondentes(idEmpresa);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idEmpresa);

  const filtrados = useMemo(
    () => filtrarPorSetor(respondentes, setor),
    [respondentes, setor]
  );

  const topicos = useMemo(
    () => calcularResumoCompleto(filtrados),
    [filtrados]
  );

  const mapaProb = useMemo(() => {
    const m: Record<number, 1 | 2 | 3> = {};
    for (let i = 0; i < 9; i++) m[i] = 1;
    if (setor === "Todos") return m;
    for (const p of probabilidades) {
      if (p.setor === setor) {
        m[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
      }
    }
    return m;
  }, [probabilidades, setor]);

  const topicosComMatriz = useMemo(
    () => aplicarMatriz(topicos, mapaProb),
    [topicos, mapaProb]
  );

  const podeImprimir =
    idEmpresa && respondentes.length > 0 && setor !== "Todos";

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .drps-print-container { padding: 0 !important; box-shadow: none !important; border: none !important; }
          .drps-print-section { break-inside: avoid; }
        }
      `}</style>

      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-gray-900">
          Análise e Avaliação — Relatório DRPS
        </h1>
        <p className="text-sm text-gray-600">
          Documento formal para anexar ao PGR. Selecione um <strong>setor
          específico</strong> antes de gerar o PDF.
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
                <span className="text-amber-warning">
                  ⚠ Escolha um setor específico para imprimir o relatório.
                </span>
              ) : (
                <>
                  Setor avaliado: <strong>{setor}</strong> ·{" "}
                  {filtrados.length} respondente(s) · {topicos.length} tópico(s)
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
                </div>
              </div>
            </header>

            <section className="drps-print-section mb-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Identificação da Empresa
              </h3>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <Linha label="Empresa" valor={empresa?.nome_empresa ?? "—"} />
                <Linha
                  label="CNPJ"
                  valor={empresa?.cnpj ? formatCNPJ(empresa.cnpj) : "—"}
                />
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
                <Linha label="Setor avaliado" valor={setor} />
              </div>
            </section>

            <section className="drps-print-section mb-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Quadro de Pessoal
              </h3>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <Linha label="Funções" valor={config?.funcoes ?? "—"} />
                <Linha
                  label="Qtd. de trabalhadores"
                  valor={config?.qtd_trabalhadores?.toString() ?? "—"}
                />
                <Linha
                  label="Homens"
                  valor={config?.qtd_homens?.toString() ?? "—"}
                />
                <Linha
                  label="Mulheres"
                  valor={config?.qtd_mulheres?.toString() ?? "—"}
                />
                <Linha
                  label="Respondentes considerados"
                  valor={filtrados.length.toString()}
                />
              </div>
            </section>

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

            <section className="drps-print-section">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Classificação dos Fatores de Risco
              </h3>
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
                    {topicosComMatriz.map((t) => (
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
                            style={{
                              backgroundColor: t.classificacaoGravidade.cor,
                            }}
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
              <p className="mt-2 text-[10px] text-gray-500">
                Legenda Matriz: Baixo (verde) · Médio (amarelo) · Alto
                (vermelho) · Crítico (preto)
              </p>
            </section>

            <footer className="drps-print-section mt-8 border-t border-gray-300 pt-3 text-center text-[10px] text-gray-500">
              Documento gerado pelo Painel SST Chabra em{" "}
              {new Date().toLocaleDateString("pt-BR")}
            </footer>
          </div>
        </>
      )}
    </div>
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
