// DRPS — montagem dos blocos do laudo (setor › funções › tópicos).
//
// Estas funções estavam copiadas em 4 lugares (a tela de Análise, a tela de
// Laudo, a Conclusão Geral e o template do PDF), sempre com o mesmo corpo.
// Unificadas aqui antes da cascata Unidade › Setor › Função, para que o
// recorte por unidade seja escrito uma vez só.

import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
  filtrarPorUnidade,
  listarSetores,
  listarUnidades,
} from "./calculos";
import { TOPICOS } from "./topicos";
import { fontesEscolhidas, guardadasDe, textoFontes, type FontesPorSetor } from "@/lib/psicossocial/fontes";
import type {
  DrpsProbabilidade,
  DrpsProbabilidadeUnidade,
  DrpsRespondente,
  TopicoComMatriz,
} from "./types";

/**
 * v262: troca a fonte geradora padrão de cada tópico pelas fontes escolhidas
 * na Análise para o setor. Tópico sem escolha guardada fica com o texto
 * padrão INTACTO — laudo antigo sai byte a byte igual.
 */
export function aplicarFontes(
  topicos: TopicoComMatriz[],
  fontes: FontesPorSetor | null | undefined,
  setor: string
): TopicoComMatriz[] {
  if (!fontes) return topicos;
  return topicos.map((t) => {
    const guardadas = guardadasDe(fontes, setor, t.idx);
    if (!guardadas) return t;
    return { ...t, fonteGeradora: textoFontes(fontesEscolhidas(guardadas, t.fonteGeradora)) };
  });
}

export interface SetorRelatorio {
  setor: string;
  totalRespondentes: number;
  funcoes: string;
  topicos: TopicoComMatriz[];
  /** Unidade do bloco. "" nos relatórios sem a pergunta de unidade. */
  unidade?: string;
  /** topico_idx que estão usando o valor do setor por falta de override.
   *  Alimenta o aviso "N blocos ainda herdados" antes de concluir o laudo. */
  topicosHerdados?: number[];
}

/** Um bloco de unidade do laudo: a unidade e os setores que existem dentro dela. */
export interface UnidadeRelatorio {
  unidade: string;
  totalRespondentes: number;
  setores: SetorRelatorio[];
}

/**
 * Mapa topico_idx → probabilidade gravada para o setor. Tópico sem
 * probabilidade fica em 1 (Baixa) — mesmo default de `aplicarMatriz`.
 */
export function montarMapaProb(
  probabilidades: DrpsProbabilidade[],
  setor: string
): Record<number, 1 | 2 | 3> {
  const m: Record<number, 1 | 2 | 3> = {};
  for (let i = 0; i < TOPICOS.length; i++) m[i] = 1;
  for (const p of probabilidades) {
    if (p.setor === setor) m[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
  }
  return m;
}

/**
 * Herança com override (v138): parte do valor do SETOR e sobrepõe apenas os
 * tópicos que a psicóloga diferenciou naquela unidade. Devolve também quais
 * tópicos ficaram herdados, para a tela poder sinalizar.
 *
 * Não existir override é o caso normal, não uma falha: significa "esta unidade
 * se comporta como o setor". Por isso a ausência nunca zera nada.
 */
export function montarMapaProbUnidade(
  probabilidades: DrpsProbabilidade[],
  overrides: DrpsProbabilidadeUnidade[],
  unidade: string,
  setor: string
): { mapa: Record<number, 1 | 2 | 3>; herdados: number[] } {
  const mapa = montarMapaProb(probabilidades, setor);
  const proprios = new Set<number>();
  const alvo = unidade.trim();
  for (const o of overrides) {
    if (o.setor === setor && o.unidade.trim() === alvo) {
      mapa[o.topico_idx] = o.probabilidade as 1 | 2 | 3;
      proprios.add(o.topico_idx);
    }
  }
  const herdados: number[] = [];
  for (let i = 0; i < TOPICOS.length; i++) {
    if (!proprios.has(i)) herdados.push(i);
  }
  return { mapa, herdados };
}

/**
 * Texto do bloco com herança (v138): usa o override da unidade quando existe e
 * não está vazio, senão o texto do setor — que é o que sempre valeu e continua
 * valendo. Relatório sem unidade cai direto no texto de setor.
 *
 * Vive aqui, e não no template, porque a tela de Laudo e o PDF precisam
 * responder exatamente a mesma coisa.
 */
export function textoDoBloco(
  porUnidade: Record<string, Record<string, string>> | null | undefined,
  porSetor: Record<string, string> | null | undefined,
  unidade: string | undefined,
  setor: string
): string {
  if (unidade) {
    const proprio = porUnidade?.[unidade]?.[setor];
    if (proprio && proprio.trim()) return proprio;
  }
  return porSetor?.[setor] ?? "";
}

/** Funções (cargos) distintas de um recorte de respondentes, em uma linha. */
export function listarFuncoes(respondentes: DrpsRespondente[]): string {
  const set = new Set<string>();
  for (const r of respondentes) {
    const c = (r.cargo ?? "").trim();
    if (c) set.add(c);
  }
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
    .join(", ");
}

/**
 * Um bloco por setor, com total de respondentes, funções e os 13 tópicos já
 * cruzados na matriz. `setores` omitido = todos os setores do relatório;
 * informe a lista quando a tela estiver filtrada em um setor só.
 */
export function montarBlocosPorSetor(
  respondentes: DrpsRespondente[],
  probabilidades: DrpsProbabilidade[],
  setores?: string[],
  fontes?: FontesPorSetor | null
): SetorRelatorio[] {
  const lista = setores ?? listarSetores(respondentes);
  return lista.map((s) => {
    const filtrados = filtrarPorSetor(respondentes, s);
    return {
      setor: s,
      totalRespondentes: filtrados.length,
      funcoes: listarFuncoes(filtrados),
      topicos: aplicarFontes(
        aplicarMatriz(calcularResumoCompleto(filtrados), montarMapaProb(probabilidades, s)),
        fontes,
        s
      ),
    };
  });
}

/**
 * Cascata Unidade › Setor › Função (v138). Uma unidade só entra se tiver
 * respondente — foi a decisão do RT: "se não tiver respondente em uma unidade
 * pode ser ignorado no relatório". O mesmo vale para o setor dentro dela.
 *
 * `unidades` omitido = todas as do relatório; informe a lista quando a tela
 * estiver filtrada em uma unidade só.
 *
 * Relatório sem nenhuma unidade preenchida devolve [] — quem chama cai no
 * `montarBlocosPorSetor` de sempre e o laudo sai idêntico ao de hoje.
 */
export function montarBlocosPorUnidade(
  respondentes: DrpsRespondente[],
  probabilidades: DrpsProbabilidade[],
  overrides: DrpsProbabilidadeUnidade[],
  unidades?: string[],
  fontes?: FontesPorSetor | null
): UnidadeRelatorio[] {
  const lista = unidades ?? listarUnidades(respondentes);
  return lista
    .map((u) => {
      const daUnidade = filtrarPorUnidade(respondentes, u);
      const setores = listarSetores(daUnidade).map((s) => {
        const filtrados = filtrarPorSetor(daUnidade, s);
        const { mapa, herdados } = montarMapaProbUnidade(
          probabilidades,
          overrides,
          u,
          s
        );
        return {
          unidade: u,
          setor: s,
          totalRespondentes: filtrados.length,
          funcoes: listarFuncoes(filtrados),
          // Fontes são por SETOR (valem em todas as unidades dele).
          topicos: aplicarFontes(aplicarMatriz(calcularResumoCompleto(filtrados), mapa), fontes, s),
          topicosHerdados: herdados,
        };
      });
      return { unidade: u, totalRespondentes: daUnidade.length, setores };
    })
    .filter((b) => b.setores.length > 0);
}

/** Quantos blocos (unidade, setor) ainda usam o valor do setor em TODOS os
 *  tópicos — ou seja, não foram diferenciados. Usado no aviso da tela. */
export function contarBlocosHerdados(blocos: UnidadeRelatorio[]): number {
  let n = 0;
  for (const b of blocos) {
    for (const s of b.setores) {
      if ((s.topicosHerdados?.length ?? 0) === TOPICOS.length) n++;
    }
  }
  return n;
}
