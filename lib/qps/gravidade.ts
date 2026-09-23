// QPS — a régua do DRPS aplicada a um questionário (pedido do Sanmyo, 14/09/2026).
//
// Até aqui o QPS fazia o CONTRÁRIO do DRPS: a resposta virava PROBABILIDADE
// (média em %, cortes 34/67) e a severidade era fixa em 3 (`matriz.ts`). No DRPS
// a resposta define a GRAVIDADE, o psicólogo informa a PROBABILIDADE e a matriz
// 3×3 dá o risco (Baixo/Médio/Alto/Crítico). Este módulo faz o QPS seguir o DRPS
// IMPORTANDO as funções dele — não copiando a fórmula: se o DRPS mudar um corte,
// o QPS muda junto, e as duas telas nunca discordam por uma cópia esquecida.
//
// A conta, pergunta a pergunta (`pontuacaoCorrigida` do DRPS):
//   média das respostas → ROUNDUP → 4 − x se a pergunta é invertida → gravidade
//   (≥3 Alta · 2 Média · ≤1 Baixa). Por categoria: média das gravidades das
//   perguntas COM resposta → cortes 1,66 / 2,32 (`classificarGravidadeTopico`).
//
// ⚠️ Herança conhecida: o ROUNDUP acontece ANTES da inversão. Numa pergunta
// invertida, média 2,1 vira ⌈2,1⌉=3 → 4−3=1 → Baixa; a mesma média numa direta
// vira 3 → Alta. É assim na planilha original do DRPS e foi mostrado ao Sanmyo
// antes de ele pedir "a mesma régua" — copiar a régua copia a assimetria.
//
// Escala: o DRPS é 0–4 e a QAP também. Para um tipo com outra faixa (PER e o
// "2.0" são 1–5, e a v180 deixa cada pergunta ter a sua), a média é levada para
// o domínio 0–4 por regra de três ANTES de aplicar a régua — em 0–4 isso é a
// identidade, então a QAP sai exatamente como no DRPS.

import {
  CORES_MATRIZ,
  calcularMatriz as matrizDrps,
  classificarGravidade,
  classificarGravidadeTopico,
  pontuacaoCorrigida,
  rotuloProbabilidade,
} from "@/lib/drps/calculos";
import type {
  ClassificacaoGravidade,
  NivelMatriz,
  NivelProbabilidade,
} from "@/lib/drps/types";
import type { QpsCategoria, QpsPergunta, QpsProbabilidade } from "@/lib/supabase/types";
import { faixaPergunta } from "./matriz";

/**
 * Valor de `qps_probabilidades.setor` que guarda a probabilidade da categoria
 * para a APLICAÇÃO INTEIRA — o equivalente ao `drps_probabilidades` (uma por
 * tópico, por relatório). Uma linha com setor real continua valendo como
 * ajuste daquele setor, por cima da geral (mesmo desenho do override por
 * unidade do DRPS). Nenhum setor de respondente pode se chamar "*".
 */
export const SETOR_TODA_APLICACAO = "*";

/** Rótulo do consolidado (todos os setores) nas telas. */
export const TODOS_OS_SETORES = "Todos os setores";

export type OrigemProbabilidade = "setor" | "aplicacao" | "padrao";

export interface PerguntaGravidade {
  id_pergunta: string;
  ordem: number;
  texto: string;
  logica: "direta" | "invertida";
  /** Respondentes que responderam ESTA pergunta no recorte. */
  n: number;
  /** Média das respostas na escala da pergunta. */
  mediaBruta: number;
  /** A mesma média levada ao domínio 0–4 do DRPS (identidade em 0–4). */
  media04: number;
  /** Pontuação corrigida (ROUNDUP + inversão), como no DRPS. 0 quando n = 0. */
  corrigida: number;
  gravidade: ClassificacaoGravidade;
}

export interface CategoriaGravidade {
  id_categoria: string;
  nome: string;
  fonteGeradora: string | null;
  perguntas: PerguntaGravidade[];
  /** Média das gravidades (1–3) das perguntas com resposta. */
  mediaGravidade: number;
  /** null quando nenhuma pergunta da categoria tem resposta no recorte. */
  gravidade: ClassificacaoGravidade | null;
  semBase: boolean;
  probabilidade: 1 | 2 | 3;
  probabilidadeOrigem: OrigemProbabilidade;
  /** A geral da aplicação (setor "*"), mesmo quando o setor tem ajuste; null = não informada. */
  probabilidadeGeral: 1 | 2 | 3 | null;
  classificacaoProbabilidade: NivelProbabilidade;
  /** null quando semBase — não há gravidade para cruzar. */
  matriz: NivelMatriz | null;
  corMatriz: string | null;
}

/** Leva uma média na faixa [min,max] para o domínio 0–4 do DRPS. */
export function mediaParaDominioDrps(media: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((media - min) / (max - min)) * 4;
}

/**
 * Probabilidade efetiva de uma categoria num setor: ajuste do setor > geral
 * da aplicação (`setor = "*"`) > 1 (Baixa), o mesmo padrão do DRPS quando o
 * psicólogo ainda não informou.
 */
export function probabilidadeEfetiva(
  probabilidades: QpsProbabilidade[],
  setor: string | null,
  idCategoria: string,
): { probabilidade: 1 | 2 | 3; origem: OrigemProbabilidade } {
  if (setor && setor !== TODOS_OS_SETORES) {
    const doSetor = probabilidades.find(
      (p) => p.setor === setor && p.id_categoria === idCategoria,
    );
    if (doSetor) return { probabilidade: doSetor.probabilidade, origem: "setor" };
  }
  const geral = probabilidades.find(
    (p) => p.setor === SETOR_TODA_APLICACAO && p.id_categoria === idCategoria,
  );
  if (geral) return { probabilidade: geral.probabilidade, origem: "aplicacao" };
  return { probabilidade: 1, origem: "padrao" };
}

export function calcularPerguntaGravidade(
  pergunta: QpsPergunta,
  respondentes: { respostas: Record<string, number> }[],
  escalaMin: number,
  escalaMax: number,
): PerguntaGravidade {
  const vals: number[] = [];
  for (const r of respondentes) {
    const v = r.respostas?.[pergunta.id_pergunta];
    if (v === undefined || v === null) continue;
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    vals.push(num);
  }
  const n = vals.length;
  const mediaBruta = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
  const faixa = faixaPergunta(pergunta, escalaMin, escalaMax);
  const media04 = n ? mediaParaDominioDrps(mediaBruta, faixa.min, faixa.max) : 0;
  // Mesma guarda do `calcularTopico` do DRPS: sem resposta não inverte, senão
  // uma pergunta invertida com média 0 sairia com gravidade 4 (Alta).
  const corrigida = n === 0 ? 0 : pontuacaoCorrigida(media04, pergunta.logica);
  return {
    id_pergunta: pergunta.id_pergunta,
    ordem: pergunta.ordem,
    texto: pergunta.texto,
    logica: pergunta.logica,
    n,
    mediaBruta,
    media04,
    corrigida,
    gravidade: classificarGravidade(corrigida),
  };
}

/**
 * A análise de UM recorte (um setor, ou `null` = todos os setores): uma linha
 * por categoria com gravidade (pela resposta), probabilidade (informada) e
 * matriz — o que a tabela "Classificação de Risco Psicossocial" do DRPS mostra.
 */
export function calcularAnaliseSetor(
  setor: string | null,
  categorias: QpsCategoria[],
  perguntas: QpsPergunta[],
  respondentes: { setor: string; respostas: Record<string, number> }[],
  probabilidades: QpsProbabilidade[],
  escalaMin: number,
  escalaMax: number,
): CategoriaGravidade[] {
  const recorte =
    setor && setor !== TODOS_OS_SETORES
      ? respondentes.filter((r) => (r.setor ?? "").trim() === setor.trim())
      : respondentes;

  return [...categorias]
    .sort((a, b) => a.ordem - b.ordem)
    .map((cat) => {
      const pergsCat = perguntas
        .filter((p) => p.id_categoria === cat.id_categoria)
        .sort((a, b) => a.ordem - b.ordem)
        .map((p) => calcularPerguntaGravidade(p, recorte, escalaMin, escalaMax));
      // Só perguntas COM resposta entram na média: "ninguém respondeu" não é
      // "Baixa". (No DRPS as 50 colunas sempre existem, então lá isso não
      // aparece; aqui uma pergunta pode vir vazia de uma importação parcial.)
      const comDado = pergsCat.filter((p) => p.n > 0);
      const mediaGravidade = comDado.length
        ? comDado.reduce((s, p) => s + p.gravidade.num, 0) / comDado.length
        : 0;
      const gravidade = comDado.length ? classificarGravidadeTopico(mediaGravidade) : null;
      const { probabilidade, origem } = probabilidadeEfetiva(
        probabilidades,
        setor,
        cat.id_categoria,
      );
      const matriz = gravidade ? matrizDrps(gravidade.num, probabilidade) : null;
      const geral = probabilidadeEfetiva(probabilidades, null, cat.id_categoria);
      return {
        id_categoria: cat.id_categoria,
        nome: cat.nome,
        fonteGeradora: cat.fonte_geradora ?? null,
        perguntas: pergsCat,
        mediaGravidade,
        gravidade,
        semBase: !gravidade,
        probabilidade,
        probabilidadeOrigem: origem,
        probabilidadeGeral: geral.origem === "aplicacao" ? geral.probabilidade : null,
        classificacaoProbabilidade: rotuloProbabilidade(probabilidade),
        matriz,
        corMatriz: matriz ? CORES_MATRIZ[matriz] : null,
      };
    });
}

/** Setores dos respondentes, únicos, sem espaço sobrando, em ordem pt-BR. */
export function listarSetoresQps(respondentes: { setor: string }[]): string[] {
  const set = new Set<string>();
  for (const r of respondentes) {
    const s = (r.setor ?? "").trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
