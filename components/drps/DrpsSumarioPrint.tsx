"use client";

import { useDrpsTextoPadrao } from "@/lib/hooks/useDrps";
import type { DrpsPosicaoPdf } from "@/lib/drps/types";
import { substituirVariaveisTexto } from "@/lib/drps/variaveis";

interface ItemSumario {
  numero: string;
  titulo: string;
  /** Sub-itens (ex: setores dentro de "Análise e Avaliação"). */
  filhos?: ItemSumario[];
}

interface Props {
  /** Lista de setores que vão aparecer na análise. */
  setores: string[];
  /** Mapa de variáveis pra substituir nos títulos dos capítulos de texto padrão. */
  valores: Record<string, string>;
  /** Booleans pra mostrar/ocultar seções no sumário. */
  temConclusaoGeral?: boolean;
  temMedidas?: boolean;
  temMonitoramento?: boolean;
  temRevisao?: boolean;
}

/**
 * Sumário (Table of Contents) do relatório DRPS — renderiza só no print.
 *
 * Estrutura:
 *   - Capítulos de texto padrão (posição "inicio") — capa/dedicatória
 *   - Capítulos de texto padrão (posição "apos_sumario") — intro/metodologia
 *   - Análise e Avaliação (com cada setor como sub-item)
 *   - Capítulos de texto padrão (posição "apos_setores")
 *   - Conclusão Geral
 *   - Capítulos de texto padrão (posição "apos_conclusao")
 *   - Medidas de Controle — Plano Anual
 *   - Monitoramento do Desempenho
 *   - Revisão e Melhoria Contínua
 *   - Capítulos de texto padrão (posição "apos_medidas")
 *   - Capítulos de texto padrão (posição "fim") — considerações finais
 *
 * Numeração no estilo ABNT (1, 1.1, 1.2, 2, ...). Sem número de página
 * (HTML print não suporta page-counters bem entre seções).
 */
export default function DrpsSumarioPrint({
  setores,
  valores,
  temConclusaoGeral = false,
  temMedidas = false,
  temMonitoramento = false,
  temRevisao = false,
}: Props) {
  const { data: capitulos = [] } = useDrpsTextoPadrao();

  const porPosicao = (pos: DrpsPosicaoPdf) =>
    capitulos.filter((c) => (c.posicao_pdf ?? "inicio") === pos);

  const itens: ItemSumario[] = [];
  let n = 0;

  // Texto padrão — início (capa/dedicatória)
  for (const c of porPosicao("inicio")) {
    n += 1;
    itens.push({
      numero: `${n}.`,
      titulo: substituirVariaveisTexto(c.titulo, valores),
    });
  }

  // Texto padrão — após sumário (intro/metodologia)
  for (const c of porPosicao("apos_sumario")) {
    n += 1;
    itens.push({
      numero: `${n}.`,
      titulo: substituirVariaveisTexto(c.titulo, valores),
    });
  }

  // Análise e Avaliação por setor
  if (setores.length > 0) {
    n += 1;
    const analise: ItemSumario = {
      numero: `${n}.`,
      titulo: "Análise e Avaliação por Setor",
      filhos: setores.map((s, idx) => ({
        numero: `${n}.${idx + 1}`,
        titulo: s,
      })),
    };
    itens.push(analise);
  }

  // Após setores
  for (const c of porPosicao("apos_setores")) {
    n += 1;
    itens.push({
      numero: `${n}.`,
      titulo: substituirVariaveisTexto(c.titulo, valores),
    });
  }

  // Conclusão Geral
  if (temConclusaoGeral) {
    n += 1;
    itens.push({ numero: `${n}.`, titulo: "Conclusão Geral" });
  }

  // Após conclusão
  for (const c of porPosicao("apos_conclusao")) {
    n += 1;
    itens.push({
      numero: `${n}.`,
      titulo: substituirVariaveisTexto(c.titulo, valores),
    });
  }

  // Medidas de Controle — Plano Anual
  if (temMedidas) {
    n += 1;
    itens.push({ numero: `${n}.`, titulo: "Medidas de Controle — Plano Anual" });
  }

  // Monitoramento do Desempenho
  if (temMonitoramento) {
    n += 1;
    itens.push({ numero: `${n}.`, titulo: "Monitoramento do Desempenho" });
  }

  // Revisão e Melhoria Contínua
  if (temRevisao) {
    n += 1;
    itens.push({ numero: `${n}.`, titulo: "Revisão e Melhoria Contínua" });
  }

  // Após medidas/monitoramento/revisão
  for (const c of porPosicao("apos_medidas")) {
    n += 1;
    itens.push({
      numero: `${n}.`,
      titulo: substituirVariaveisTexto(c.titulo, valores),
    });
  }

  // Fim (considerações finais)
  for (const c of porPosicao("fim")) {
    n += 1;
    itens.push({
      numero: `${n}.`,
      titulo: substituirVariaveisTexto(c.titulo, valores),
    });
  }

  if (itens.length === 0) return null;

  return (
    <section className="drps-sumario">
      <style>{`
        .drps-sumario {
          page-break-before: always;
          page-break-after: always;
        }
        .drps-sumario-titulo {
          font-size: 16pt;
          font-weight: 700;
          color: #1e4d28;
          border-bottom: 2px solid #006B54;
          padding-bottom: 6px;
          margin-bottom: 16pt;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .drps-sumario-lista {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .drps-sumario-item {
          font-size: 12pt;
          line-height: 1.7;
          color: #1f2937;
        }
        .drps-sumario-item-numero {
          font-weight: 700;
          margin-right: 8pt;
          color: #006B54;
          min-width: 32pt;
          display: inline-block;
        }
        .drps-sumario-subitens {
          list-style: none;
          padding: 0;
          margin: 2pt 0 6pt 24pt;
        }
        .drps-sumario-subitem {
          font-size: 11pt;
          line-height: 1.6;
          color: #4b5563;
        }
        .drps-sumario-subitem-numero {
          font-weight: 600;
          margin-right: 6pt;
          color: #006B54;
          min-width: 32pt;
          display: inline-block;
        }
      `}</style>
      <h2 className="drps-sumario-titulo">Sumário</h2>
      <ul className="drps-sumario-lista">
        {itens.map((item, idx) => (
          <li key={idx} className="drps-sumario-item">
            <span className="drps-sumario-item-numero">{item.numero}</span>
            {item.titulo}
            {item.filhos && item.filhos.length > 0 && (
              <ul className="drps-sumario-subitens">
                {item.filhos.map((f, fi) => (
                  <li key={fi} className="drps-sumario-subitem">
                    <span className="drps-sumario-subitem-numero">
                      {f.numero}
                    </span>
                    {f.titulo}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
