/**
 * Consolidação da escala (Fase 7) — a aba "Resumo Anual" da planilha.
 *
 * Função pura, como o gerador e o motor de regras. Dois relatórios:
 *
 *  1. **Dias por unidade × supervisor** — quanto cada pessoa esteve em cada
 *     unidade no período.
 *  2. **Dias com escala por mês** — quantos dias de cada pessoa estão
 *     definidos em cada mês, tenham eles unidade ou não.
 *
 * ⚠️ **A REGRA DE CONTAGEM QUE A PLANILHA DECLARA, e que muda os números:**
 * *"Células com mais de uma unidade são contadas em cada unidade envolvida."*
 * Um dia em Petrópolis + Guapimirim conta 1 em cada uma. Logo, o total da
 * matriz de unidades **não é** "dias trabalhados" — é "dias-unidade", e pode
 * passar do número de dias do período. É por isso que os dois relatórios têm
 * totais diferentes, e não porque um deles esteja errado.
 *
 * O segundo relatório conta o DIA, uma vez só, com unidade ou sem: é ele que
 * responde "quantos dias essa pessoa tem definidos no mês".
 */

import { MESES_PT, paraDataLocal } from "./datas";
import { colunasParaAlocacao } from "./tipos";
import type { EscalaDia, EscalaSupervisor, SituacaoEscala, UnidadeDaEscala } from "./tipos";

export interface EntradaRelatorio {
  supervisores: EscalaSupervisor[];
  unidades: UnidadeDaEscala[];
  /** Os dias do período — um ano inteiro ou um mês só. */
  dias: EscalaDia[];
}

export interface LinhaMatriz {
  chave: string;
  rotulo: string;
  /** id_supervisor → contagem. */
  porSupervisor: Record<string, number>;
  total: number;
}

export interface Matriz {
  linhas: LinhaMatriz[];
  totalPorSupervisor: Record<string, number>;
  totalGeral: number;
}

const zerado = (supervisores: EscalaSupervisor[]): Record<string, number> =>
  Object.fromEntries(supervisores.map((s) => [s.id_supervisor, 0]));

function fechar(linhas: LinhaMatriz[], supervisores: EscalaSupervisor[]): Matriz {
  const totalPorSupervisor = zerado(supervisores);
  let totalGeral = 0;
  for (const l of linhas) {
    for (const s of supervisores) {
      const n = l.porSupervisor[s.id_supervisor] ?? 0;
      totalPorSupervisor[s.id_supervisor] += n;
      totalGeral += n;
    }
  }
  return { linhas, totalPorSupervisor, totalGeral };
}

/**
 * Dias por unidade × supervisor.
 *
 * Cada par (dia, unidade) conta uma vez. Dia sem unidade — home office, folga,
 * férias, feriado — não entra em unidade nenhuma, e por isso a soma daqui é
 * menor que a de dias definidos.
 */
export function porUnidadeESupervisor(entrada: EntradaRelatorio): Matriz {
  const { supervisores, unidades, dias } = entrada;

  const linhas: LinhaMatriz[] = unidades.map((u) => ({
    chave: u.id_unidade,
    rotulo: u.nome,
    porSupervisor: zerado(supervisores),
    total: 0,
  }));
  const porChave = new Map(linhas.map((l) => [l.chave, l]));

  for (const d of dias) {
    const a = colunasParaAlocacao(d);
    if (!a || a.tipo !== "unidades") continue;
    for (const id of a.unidade_ids) {
      const linha = porChave.get(id);
      // Unidade que saiu do cadastro (ou foi desativada) não vira linha nova —
      // inventar uma linha "unidade removida" no relatório entregaria ao
      // cliente um nome que não existe. O dia continua no outro relatório.
      if (!linha) continue;
      if (!(d.id_supervisor in linha.porSupervisor)) continue;
      linha.porSupervisor[d.id_supervisor]++;
      linha.total++;
    }
  }

  return fechar(linhas, supervisores);
}

/**
 * Dias com escala definida, por mês.
 *
 * Conta o DIA, uma vez, tendo ele unidade ou situação — **menos o feriado**.
 *
 * ⚠️ **O FERIADO FICA DE FORA, e isso foi lido da planilha, não deduzido.** Ela
 * preenche o dia de feriado com a palavra "Feriado" nas cinco colunas, mas o
 * Resumo Anual conta **21 dias em janeiro**, não 22 — e 18 em fevereiro, não
 * 20. A conta do ano fecha em **248 = 261 dias de semana − 13 feriados em dia
 * de semana**. Ou seja: para a planilha, "dia com escala definida" é dia de
 * trabalho, e feriado não é.
 *
 * Contar o feriado aqui inflaria todo mês em que ele cai, e o número deixaria
 * de bater com o que a JCN Consultoria já usa — que é o pior tipo de erro num relatório:
 * o que parece certo e some no meio da tabela.
 */
export function porMes(entrada: EntradaRelatorio & { ano: number }): Matriz {
  const { supervisores, dias, ano } = entrada;

  const linhas: LinhaMatriz[] = MESES_PT.map((nome, i) => ({
    chave: String(i + 1),
    rotulo: nome,
    porSupervisor: zerado(supervisores),
    total: 0,
  }));

  for (const d of dias) {
    const data = paraDataLocal(d.data);
    if (data.getFullYear() !== ano) continue;
    const a = colunasParaAlocacao(d);
    if (!a) continue;
    if (a.tipo === "situacao" && a.situacao === "Feriado") continue;
    const linha = linhas[data.getMonth()];
    if (!(d.id_supervisor in linha.porSupervisor)) continue;
    linha.porSupervisor[d.id_supervisor]++;
    linha.total++;
  }

  return fechar(linhas, supervisores);
}

/** Quantos dias de cada situação — o que a matriz de unidades não mostra. */
export function porSituacao(entrada: EntradaRelatorio): { situacao: SituacaoEscala; dias: number }[] {
  const conta = new Map<SituacaoEscala, number>();
  for (const d of entrada.dias) {
    const a = colunasParaAlocacao(d);
    if (!a || a.tipo !== "situacao") continue;
    conta.set(a.situacao, (conta.get(a.situacao) ?? 0) + 1);
  }
  return [...conta.entries()]
    .map(([situacao, dias]) => ({ situacao, dias }))
    .sort((a, b) => b.dias - a.dias);
}

/** O nome que aparece nas colunas dos dois relatórios. */
export function rotuloSupervisor(s: EscalaSupervisor): string {
  return s.nome_resumido || s.nome;
}

/**
 * Quem entra nas colunas do relatório: **os ativos, mais os inativos que
 * trabalharam no período**.
 *
 * 🐛 Achado no QA da Fase 8. As telas de operação — grade, padrão — mostram só
 * os ativos, e está certo: ninguém quer escalar quem saiu. Mas o RELATÓRIO é
 * histórico, e usar a mesma lista fazia os dias de quem saiu no meio do ano
 * **sumirem em silêncio**: o total do ano encolhia sem nada na tela explicando
 * por quê. É o pior tipo de erro num relatório — o que parece certo.
 *
 * Inativo sem nenhum dia no período continua de fora: ele não polui a tabela
 * com uma coluna de zeros.
 */
export function supervisoresDoRelatorio(
  todos: EscalaSupervisor[],
  dias: EscalaDia[]
): EscalaSupervisor[] {
  const comDias = new Set(dias.map((d) => d.id_supervisor));
  return todos
    .filter((s) => s.ativo || comDias.has(s.id_supervisor))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}
