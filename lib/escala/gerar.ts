/**
 * Geração da grade mensal a partir do padrão semanal (Fase 5).
 *
 * Função PURA de propósito: recebe tudo pronto e devolve o que gravar, sem
 * tocar em banco. É o que torna a regra testável — e a regra aqui é a mais
 * perigosa do módulo, porque uma decisão errada apaga trabalho de gente.
 *
 * ─── AS TRÊS REGRAS ────────────────────────────────────────────────────────
 *
 * 1. **`manual` NUNCA é tocado.** Dia mexido à mão sobrevive a qualquer
 *    regeração. É por isso que a proteção vive AQUI, no cálculo, e não só na
 *    hora de gravar: o que não entra na lista não corre risco de ser gravado.
 *
 * 2. **Fim de semana não existe na escala.** Sábado e domingo não geram linha
 *    — nem vazia. A planilha faz o mesmo: a linha existe, as células ficam em
 *    branco.
 *
 * 3. **Feriado vira a situação "Feriado"**, sobrepondo o padrão do dia —
 *    inclusive o home office. Foi assim que a planilha registrou o 1º de
 *    janeiro e o Carnaval.
 *
 * ⚠️ **PONTO FACULTATIVO BLOQUEIA IGUAL A FERIADO.** Não é dedução minha: na
 * planilha o Carnaval (marcado "ponto facultativo") aparece como "Feriado" para
 * os 5 supervisores, e o total de fevereiro — 18 dias — só fecha descontando os
 * dois dias de Carnaval de 20 dias úteis. Se um dia a JCN Consultoria quiser trabalhar em
 * facultativo, isto vira configuração; hoje seria inventar uma regra que a
 * operação não usa.
 *
 * ⚠️ **Feriado MUNICIPAL alcança só quem está alocado naquele município.** Quem
 * está em outra unidade — ou em home office, folga, férias — trabalha normal.
 * É a letra do contrato do módulo, e a razão de o município da unidade ser
 * campo obrigatório na prática: sem ele o feriado municipal não encontra
 * ninguém.
 */

import { diaUtilDe, diasDoMes } from "./datas";
import { alocacaoParaColunas, colunasParaAlocacao } from "./tipos";
import type {
  Alocacao,
  EscalaDia,
  EscalaFeriado,
  EscalaPadraoSemanal,
  EscalaSupervisor,
  UnidadeDaEscala,
} from "./tipos";

export interface EntradaGeracao {
  ano: number;
  /** 1..12 */
  mes: number;
  /** Só os ativos — supervisor inativo não entra em mês novo. */
  supervisores: EscalaSupervisor[];
  /** TODAS as vigências, não só as de hoje: o padrão pode mudar no meio do mês. */
  padroes: EscalaPadraoSemanal[];
  feriados: EscalaFeriado[];
  unidades: UnidadeDaEscala[];
  /** O que já existe no mês, para não recriar nem pisar no manual. */
  existentes: EscalaDia[];
}

export interface LinhaGerada {
  id_supervisor: string;
  data: string;
  alocacao: Alocacao;
  /** Preenchido quando a linha já existe e vai ser atualizada. */
  id_dia?: string;
}

export interface ResultadoGeracao {
  /** Não existem no banco — entram como `origem = "padrao"`. */
  aCriar: LinhaGerada[];
  /** Já existem como `padrao` e o conteúdo mudou. */
  aAtualizar: LinhaGerada[];
  /** Já existem como `padrao` e continuam iguais — nada a fazer. */
  jaCorretos: number;
  /** Dias `manual` encontrados no mês. Intocados, e é isso que se conta. */
  preservados: number;
  /** Pares (supervisor, dia) sem padrão vigente — ninguém escalado ali. */
  semPadrao: number;
  /** Dias de semana do mês (sem sábado e domingo), com ou sem feriado. */
  diasDeSemana: number;
  /** Quantos desses dias têm feriado ou ponto facultativo de alcance geral. */
  diasComFeriadoGeral: number;
}

/**
 * O padrão que vale para um supervisor, num dia da semana, numa data.
 *
 * Escolhe a vigência mais recente entre as que já começaram e ainda não
 * terminaram. Duas vigências abertas ao mesmo tempo não deveriam existir (o
 * hook de gravação fecha a anterior), mas se existirem, a mais nova ganha — em
 * vez de a ordem da consulta decidir em silêncio.
 */
export function padraoVigenteEm(
  padroes: EscalaPadraoSemanal[],
  id_supervisor: string,
  data: string
): EscalaPadraoSemanal | null {
  const dia = diaUtilDe(data);
  if (dia === null) return null;

  let melhor: EscalaPadraoSemanal | null = null;
  for (const p of padroes) {
    if (p.id_supervisor !== id_supervisor) continue;
    if (p.dia_semana !== dia) continue;
    if (p.vigencia_inicio > data) continue;
    if (p.vigencia_fim !== null && p.vigencia_fim < data) continue;
    if (melhor === null || p.vigencia_inicio > melhor.vigencia_inicio) melhor = p;
  }
  return melhor;
}

/** Feriado nacional ou estadual na data — alcança todo mundo. */
function feriadoGeralEm(feriados: EscalaFeriado[], data: string): EscalaFeriado | undefined {
  return feriados.find((f) => f.data === data && f.abrangencia !== "municipal");
}

/**
 * Feriado municipal na data que alcança ESTA alocação.
 *
 * Só encontra alguém se a alocação for em unidade e o município da unidade
 * casar com o do feriado. Comparação sem caixa e sem espaço nas pontas: o
 * município é digitado à mão nos dois lugares.
 */
function feriadoMunicipalEm(
  feriados: EscalaFeriado[],
  data: string,
  alocacao: Alocacao,
  municipioDaUnidade: Map<string, string>
): EscalaFeriado | undefined {
  if (alocacao.tipo !== "unidades") return undefined;

  const municipios = new Set(
    alocacao.unidade_ids
      .map((id) => municipioDaUnidade.get(id))
      .filter((m): m is string => !!m)
  );
  if (municipios.size === 0) return undefined;

  return feriados.find(
    (f) =>
      f.data === data &&
      f.abrangencia === "municipal" &&
      !!f.municipio &&
      municipios.has(normalizar(f.municipio))
  );
}

function normalizar(s: string): string {
  return s.trim().toLowerCase();
}

/** Duas alocações são a mesma coisa? Usado para não regravar o que não mudou. */
export function mesmaAlocacao(a: Alocacao, b: Alocacao): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === "situacao" && b.tipo === "situacao") return a.situacao === b.situacao;
  if (a.tipo === "unidades" && b.tipo === "unidades") {
    if (a.unidade_ids.length !== b.unidade_ids.length) return false;
    const outro = new Set(b.unidade_ids);
    return a.unidade_ids.every((id) => outro.has(id));
  }
  return false;
}

/**
 * Calcula o que precisa ser gravado para o mês ficar de acordo com o padrão.
 *
 * Não grava nada. Chamar duas vezes seguidas com a mesma entrada devolve, na
 * segunda, `aCriar` e `aAtualizar` vazios — a geração é idempotente.
 */
export function gerarMes(entrada: EntradaGeracao): ResultadoGeracao {
  const { ano, mes, supervisores, padroes, feriados, unidades, existentes } = entrada;

  const municipioDaUnidade = new Map(
    unidades
      .filter((u) => u.municipio)
      .map((u) => [u.id_unidade, normalizar(u.municipio as string)])
  );

  const porChave = new Map(existentes.map((d) => [`${d.id_supervisor}|${d.data}`, d]));

  const resultado: ResultadoGeracao = {
    aCriar: [],
    aAtualizar: [],
    jaCorretos: 0,
    preservados: 0,
    semPadrao: 0,
    diasDeSemana: 0,
    diasComFeriadoGeral: 0,
  };

  for (const data of diasDoMes(ano, mes)) {
    if (diaUtilDe(data) === null) continue; // sábado e domingo
    resultado.diasDeSemana++;

    const geral = feriadoGeralEm(feriados, data);
    if (geral) resultado.diasComFeriadoGeral++;

    for (const s of supervisores) {
      const padrao = padraoVigenteEm(padroes, s.id_supervisor, data);
      if (!padrao) {
        resultado.semPadrao++;
        continue;
      }

      const doPadrao = colunasParaAlocacao(padrao);
      if (!doPadrao) {
        // Linha de padrão sem unidade e sem situação não deveria existir (o
        // CHECK do banco impede). Se aparecer, é dado corrompido: ignorar é
        // melhor que gravar uma célula vazia por cima de algo bom.
        resultado.semPadrao++;
        continue;
      }

      const municipal = feriadoMunicipalEm(feriados, data, doPadrao, municipioDaUnidade);
      const alocacao: Alocacao =
        geral || municipal ? { tipo: "situacao", situacao: "Feriado" } : doPadrao;

      const existente = porChave.get(`${s.id_supervisor}|${data}`);

      if (!existente) {
        resultado.aCriar.push({ id_supervisor: s.id_supervisor, data, alocacao });
        continue;
      }

      // REGRA 1: mão humana não se sobrescreve.
      if (existente.origem === "manual") {
        resultado.preservados++;
        continue;
      }

      const atual = colunasParaAlocacao(existente);
      if (atual && mesmaAlocacao(atual, alocacao)) {
        resultado.jaCorretos++;
        continue;
      }

      resultado.aAtualizar.push({
        id_supervisor: s.id_supervisor,
        data,
        alocacao,
        id_dia: existente.id_dia,
      });
    }
  }

  return resultado;
}

/** As colunas do banco para uma linha gerada — sempre `origem = "padrao"`. */
export function linhaParaBanco(l: LinhaGerada, id_dia: string) {
  return {
    id_dia,
    id_supervisor: l.id_supervisor,
    data: l.data,
    ...alocacaoParaColunas(l.alocacao),
    origem: "padrao" as const,
    observacao: null,
  };
}
