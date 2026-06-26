"use client";

import {
  useDrpsMonitoramento,
  useDrpsPlanoMedidas,
  useDrpsRevisao,
} from "@/lib/hooks/useDrps";
import {
  calcularResumoGestao,
  formatarDataBR,
} from "@/lib/drps/gestao";

/**
 * Página executiva impressa: indicadores consolidados das 3 frentes da gestão
 * (Medidas / Monitoramento / Revisão) num quadro só. Pensada pra entrar logo
 * após a Conclusão Geral e antes do detalhamento de cada frente.
 */
export default function DrpsGestaoResumoPrint({
  idRelatorio,
  anoMedidas,
  numero,
}: {
  idRelatorio: string;
  anoMedidas?: number;
  numero?: number;
}) {
  const ano = anoMedidas ?? new Date().getFullYear();
  const { data: planoDB } = useDrpsPlanoMedidas(idRelatorio, ano);
  const { data: monitoramentos = [] } = useDrpsMonitoramento(idRelatorio);
  const { data: revisao } = useDrpsRevisao(idRelatorio);

  const resumo = calcularResumoGestao({
    planoDB,
    monitoramentos,
    revisaoDB: revisao,
  });

  return (
    <section className="drps-gestao-resumo-print">
      <style>{`
        .drps-gestao-resumo-print {
          font-family: 'Times New Roman', Times, serif;
          page-break-before: always;
          page-break-inside: avoid;
        }
        .drps-gestao-resumo-print h2 {
          font-size: 16pt;
          font-weight: 700;
          color: #1e4d28;
          border-bottom: 2px solid #0ea5e9;
          padding-bottom: 6px;
          margin: 0 0 14pt 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .drps-gestao-resumo-print p.intro {
          font-size: 12pt;
          line-height: 1.6;
          text-align: justify;
          color: #1f2937;
          margin: 0 0 12pt 0;
          text-indent: 1.25cm;
        }
        .drps-gestao-saude {
          border: 1px solid #0ea5e9;
          background: #f0fdf4;
          padding: 10pt 12pt;
          margin: 0 0 14pt 0;
          border-radius: 4pt;
        }
        .drps-gestao-saude-label {
          font-size: 11pt;
          font-weight: 700;
          color: #1e4d28;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .drps-gestao-saude-num {
          font-size: 24pt;
          font-weight: 800;
          color: #0ea5e9;
          margin: 2pt 0;
        }
        .drps-gestao-bar {
          height: 8pt;
          background: #e5e7eb;
          border-radius: 4pt;
          overflow: hidden;
          margin-top: 4pt;
        }
        .drps-gestao-bar-fill {
          height: 100%;
          background: #0ea5e9;
        }
        .drps-gestao-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11pt;
          margin-top: 6pt;
        }
        .drps-gestao-table th,
        .drps-gestao-table td {
          border: 1px solid #b5b5b5;
          padding: 6pt 8pt;
          vertical-align: top;
        }
        .drps-gestao-table th {
          background: #d4edda;
          color: #1e4d28;
          font-weight: 700;
          text-align: left;
          width: 28%;
        }
        .drps-gestao-table td.metricas {
          font-size: 10pt;
          line-height: 1.5;
        }
        .drps-gestao-table td.metricas ul {
          margin: 0;
          padding-left: 1.2em;
        }
        .drps-gestao-table td.metricas li {
          margin: 2pt 0;
        }
        .drps-gestao-pct {
          font-weight: 700;
          color: #0ea5e9;
        }
      `}</style>

      <h2>{numero ? `${numero}. ` : ""}Painel de Gestão — Resumo Executivo</h2>
      <p className="intro">
        Indicadores consolidados das três frentes de gestão do programa de
        riscos psicossociais: Medidas de Controle (cronograma de implementação),
        Monitoramento do Desempenho (acompanhamento por tópico) e Revisão e
        Melhoria Contínua (ciclo PDCA). Permite visão executiva da maturidade
        atual do diagnóstico.
      </p>

      <div className="drps-gestao-saude">
        <p className="drps-gestao-saude-label">Saúde Geral da Gestão</p>
        <p className="drps-gestao-saude-num">{resumo.saudeGeral}%</p>
        <div className="drps-gestao-bar">
          <div
            className="drps-gestao-bar-fill"
            style={{ width: `${resumo.saudeGeral}%` }}
          />
        </div>
      </div>

      <table className="drps-gestao-table">
        <tbody>
          <tr>
            <th>
              Medidas de Controle
              <br />
              <span className="drps-gestao-pct">
                {resumo.medidas.percentual}%
              </span>
            </th>
            <td className="metricas">
              <ul>
                <li>
                  {resumo.medidas.totalConfiguradas} de{" "}
                  {resumo.medidas.totalCatalogadas} ações configuradas no plano
                </li>
                <li>
                  {resumo.medidas.totalMarcacoes} marcação(ões) mês × ação ao
                  longo do ano {ano}
                </li>
                <li>
                  {resumo.medidas.acoesNoMesAtual} ação(ões) prevista(s) para o
                  mês atual
                </li>
              </ul>
            </td>
          </tr>
          <tr>
            <th>
              Monitoramento
              <br />
              <span className="drps-gestao-pct">
                {resumo.monitoramento.percentual}%
              </span>
            </th>
            <td className="metricas">
              <ul>
                <li>
                  {resumo.monitoramento.total} tópico(s) com acompanhamento
                  registrado
                </li>
                <li>
                  {resumo.monitoramento.concluidos} concluído(s) ·{" "}
                  {resumo.monitoramento.emAndamento} em andamento ·{" "}
                  {resumo.monitoramento.pendentes} pendente(s)
                </li>
                <li>
                  Próxima reavaliação:{" "}
                  {formatarDataBR(resumo.monitoramento.proximaAvaliacao)}
                </li>
              </ul>
            </td>
          </tr>
          <tr>
            <th>
              Revisão e Melhoria
              <br />
              <span className="drps-gestao-pct">
                {resumo.revisao.percentual}%
              </span>
            </th>
            <td className="metricas">
              <ul>
                <li>
                  {resumo.revisao.checklistMarcados} de{" "}
                  {resumo.revisao.checklistTotal} ações obrigatórias marcadas
                </li>
                <li>
                  {resumo.revisao.equipeMarcados} de{" "}
                  {resumo.revisao.equipeTotal} membros da equipe técnica
                  designados
                </li>
                <li>
                  {resumo.revisao.temAnotacoes
                    ? "Possui anotações registradas pela coordenação"
                    : "Sem anotações registradas"}
                </li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
