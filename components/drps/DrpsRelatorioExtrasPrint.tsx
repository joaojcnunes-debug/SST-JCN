"use client";

import { useMemo } from "react";
import {
  useDrpsMonitoramento,
  useDrpsPlanoMedidas,
  useDrpsProbabilidades,
  useDrpsRespondentes,
  useDrpsRevisao,
} from "@/lib/hooks/useDrps";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
  listarSetores,
} from "@/lib/drps/calculos";
import { MEDIDAS_CONTROLE, MESES, TOPICOS } from "@/lib/drps/topicos";
import {
  ACOES_OBRIGATORIAS as ACOES_REVISAO,
  EQUIPE_REVISAO,
} from "@/lib/drps/gestao";
import type {
  DrpsProbabilidade,
  NivelMatriz,
  TopicoComMatriz,
} from "@/lib/drps/types";

/**
 * Renderiza só no print as 3 seções extras do relatório DRPS:
 *  - Medidas de Controle — Plano Anual (tabela ação × mês)
 *  - Monitoramento do Desempenho (lista por tópico)
 *  - Revisão e Melhoria Contínua (checklist + equipe)
 *
 * A Conclusão Geral é renderizada separadamente em analise/page.tsx pra
 * permitir posicionar texto padrão (`apos_conclusao`) entre ela e o plano
 * de medidas.
 *
 * Cada seção é uma página própria (page-break-before always) com cabeçalho
 * estilizado em verde e tabelas compactas. Em tela fica oculto.
 */
export default function DrpsRelatorioExtrasPrint({
  idRelatorio,
  anoMedidas,
}: {
  idRelatorio: string;
  /** Ano usado pra carregar o plano de medidas (default: ano corrente). */
  anoMedidas?: number;
}) {
  const ano = anoMedidas ?? new Date().getFullYear();

  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idRelatorio);
  const { data: planoMedidas } = useDrpsPlanoMedidas(idRelatorio, ano);
  const { data: monitoramentos = [] } = useDrpsMonitoramento(idRelatorio);
  const { data: revisao } = useDrpsRevisao(idRelatorio);

  const setores = useMemo(() => listarSetores(respondentes), [respondentes]);

  // Tópicos consolidados pra usar no monitoramento (matriz pior caso por tópico)
  const topicosPorSetor = useMemo(() => {
    return setores.map((s) => {
      const filtrados = filtrarPorSetor(respondentes, s);
      const resumo = calcularResumoCompleto(filtrados);
      const mapaProb: Record<number, 1 | 2 | 3> = {};
      for (let i = 0; i < TOPICOS.length; i++) mapaProb[i] = 1;
      for (const p of probabilidades as DrpsProbabilidade[]) {
        if (p.setor === s) mapaProb[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
      }
      return { setor: s, topicos: aplicarMatriz(resumo, mapaProb) };
    });
  }, [setores, respondentes, probabilidades]);

  const planoEntries = planoMedidas?.plano
    ? Object.entries(planoMedidas.plano)
    : [];

  // Filtra ações com pelo menos uma marca OU responsável preenchido
  const planoComConteudo = planoEntries.filter(
    ([, p]) => p.meses.some((m) => m) || (p.responsavel ?? "").trim().length > 0
  );

  const checklist = (revisao?.checklist as Record<string, boolean>) ?? {};
  const equipe = (revisao?.equipe as Record<string, boolean>) ?? {};
  const anotacoes = revisao?.anotacoes ?? "";

  return (
    <div className="drps-extras-print">
      <style>{`
        .drps-extras-print {
          font-family: 'Times New Roman', Times, serif;
        }
        .drps-extras-section {
          page-break-before: always;
          page-break-inside: auto;
        }
        .drps-extras-h2 {
          font-size: 16pt;
          font-weight: 700;
          color: #1e4d28;
          border-bottom: 2px solid #006B54;
          padding-bottom: 6px;
          margin: 0 0 14pt 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .drps-extras-h3 {
          font-size: 13pt;
          font-weight: 700;
          color: #1e4d28;
          margin: 16pt 0 6pt 0;
        }
        .drps-extras-p {
          font-size: 12pt;
          line-height: 1.6;
          text-align: justify;
          color: #1f2937;
          margin: 0 0 12pt 0;
          text-indent: 1.25cm;
          white-space: pre-wrap;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .drps-extras-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
          margin: 8pt 0 14pt 0;
        }
        .drps-extras-table th,
        .drps-extras-table td {
          border: 1px solid #b5b5b5;
          padding: 4pt 6pt;
          vertical-align: top;
        }
        .drps-extras-table th {
          background: #d4edda;
          color: #1e4d28;
          font-weight: 700;
          text-align: left;
        }
        .drps-extras-table td.mes {
          text-align: center;
          font-weight: 700;
          color: #006B54;
        }
        .drps-extras-list {
          margin: 6pt 0 12pt 1.5em;
          padding: 0;
          font-size: 11pt;
          line-height: 1.6;
        }
        .drps-extras-list li {
          margin: 3pt 0;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .drps-extras-badge {
          display: inline-block;
          padding: 2pt 6pt;
          border-radius: 3pt;
          font-size: 9pt;
          font-weight: 700;
          color: #fff;
        }
      `}</style>

      {/* === Medidas de Controle — Plano Anual === */}
      {planoComConteudo.length > 0 && (
        <section className="drps-extras-section">
          <h2 className="drps-extras-h2">
            Medidas de Controle — Plano Anual {ano}
          </h2>
          <p className="drps-extras-p">
            Cronograma das ações de controle dos riscos psicossociais
            identificados, com indicação dos meses de execução e responsáveis.
          </p>
          <table className="drps-extras-table">
            <thead>
              <tr>
                <th style={{ width: "44%" }}>Ação</th>
                <th style={{ width: "20%" }}>Responsável</th>
                {MESES.map((m) => (
                  <th key={m} style={{ textAlign: "center", padding: "4pt 2pt" }}>
                    {m.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planoComConteudo.map(([acao, p]) => (
                <tr key={acao}>
                  <td>{acao}</td>
                  <td>{p.responsavel || "—"}</td>
                  {p.meses.map((marcado, idx) => (
                    <td key={idx} className="mes">
                      {marcado ? "✓" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mostrar também as ações canônicas que ainda não foram marcadas — opcional */}
          <p className="drps-extras-p" style={{ fontSize: "10pt", fontStyle: "italic", textIndent: 0 }}>
            Total de ações catalogadas: {MEDIDAS_CONTROLE.length}. Foram
            cronogramadas {planoComConteudo.length} ação(ões) para este período.
          </p>
        </section>
      )}

      {/* === Monitoramento do Desempenho === */}
      {(monitoramentos.length > 0 || topicosPorSetor.length > 0) && (
        <section className="drps-extras-section">
          <h2 className="drps-extras-h2">Monitoramento do Desempenho</h2>
          <p className="drps-extras-p">
            Acompanhamento das intervenções por tópico psicossocial, por setor,
            com status de execução e data da próxima reavaliação.
          </p>
          {topicosPorSetor.map((grupo) => (
            <div key={grupo.setor}>
              <h3 className="drps-extras-h3">Setor: {grupo.setor}</h3>
              <table className="drps-extras-table">
                <thead>
                  <tr>
                    <th style={{ width: "32%" }}>Tópico</th>
                    <th style={{ width: "10%" }}>Matriz</th>
                    <th>Responsável</th>
                    <th>Status</th>
                    <th>Data interv.</th>
                    <th>Próxima reaval.</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.topicos.map((t: TopicoComMatriz, idx) => {
                    const mon = monitoramentos.find(
                      (m) => m.setor === grupo.setor && m.topico_idx === idx
                    );
                    return (
                      <tr key={idx}>
                        <td>{t.nome.replace(/^Tópico \d+ - /, "")}</td>
                        <td>
                          <span
                            className="drps-extras-badge"
                            style={{ backgroundColor: corMatriz(t.matriz) }}
                          >
                            {t.matriz}
                          </span>
                        </td>
                        <td>{mon?.responsavel || "—"}</td>
                        <td>{mon?.status || "Pendente"}</td>
                        <td>{formatarDataBR(mon?.data_intervencao ?? null)}</td>
                        <td>
                          {formatarDataBR(mon?.proxima_avaliacao ?? null)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {/* === Revisão e Melhoria Contínua === */}
      {revisao && (
        <section className="drps-extras-section">
          <h2 className="drps-extras-h2">Revisão e Melhoria Contínua</h2>
          <p className="drps-extras-p">
            Compromissos de gestão pra manter o ciclo PDCA do programa de riscos
            psicossociais ativo, com equipe técnica designada e plano de
            anotações registradas pela coordenação.
          </p>

          <h3 className="drps-extras-h3">Ações de revisão obrigatórias</h3>
          <ul className="drps-extras-list">
            {ACOES_REVISAO.map((a) => (
              <li key={a.id}>
                {checklist[a.id] ? "☑" : "☐"} {a.texto}
              </li>
            ))}
          </ul>

          <h3 className="drps-extras-h3">Equipe técnica designada</h3>
          <ul className="drps-extras-list">
            {EQUIPE_REVISAO.map((e) => (
              <li key={e.id}>
                {equipe[e.id] ? "☑" : "☐"} {e.texto}
              </li>
            ))}
          </ul>

          {anotacoes && (
            <>
              <h3 className="drps-extras-h3">Anotações da coordenação</h3>
              <p className="drps-extras-p" style={{ textIndent: 0 }}>
                {anotacoes}
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function corMatriz(m: NivelMatriz): string {
  switch (m) {
    case "Crítico":
      return "#111827";
    case "Alto":
      return "#dc2626";
    case "Médio":
      return "#d97706";
    case "Baixo":
      return "#16a34a";
    default:
      return "#6b7280";
  }
}

function formatarDataBR(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.includes("T") ? "" : "T00:00")).toLocaleDateString(
      "pt-BR"
    );
  } catch {
    return "—";
  }
}
