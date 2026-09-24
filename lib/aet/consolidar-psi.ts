/**
 * Consolidação dos fatores psicossociais do AET (v135).
 *
 * Desde a v135 há UMA linha por (setor, fator) em aet_laudo_fatores_psi — antes
 * era uma por laudo, e o texto de um setor vazava para todos os outros.
 *
 * Server-safe de propósito (sem "use client"): é usado tanto pela página de
 * laudo (client) quanto pelo template de PDF (render no servidor). Manter a
 * regra AQUI, num lugar só, evita que as duas telas divirjam — foi justamente
 * a duplicação entre elas que deixou o bug original passar batido num dos lados.
 */
import type { ZonaPsi } from "@/lib/supabase/types";

export const ZONA_SEVERIDADE: Record<ZonaPsi, number> = {
  verde: 0,
  amarela: 1,
  laranja: 2,
  vermelha: 3,
};

/**
 * Zona de risco a partir da média (nota alta = condição boa).
 *
 * Era a MESMA régua escrita duas vezes — uma em `lib/hooks/useAet.ts` (que o
 * gerador de PDF não pode importar, é "use client") e uma cópia no próprio
 * template. Idênticas por sorte, não por construção. Agora `useAet` reexporta
 * esta.
 */
export function zonaFromMedia(media: number | null): ZonaPsi | null {
  if (media === null) return null;
  if (media >= 4.0) return "verde";
  if (media >= 3.0) return "amarela";
  if (media >= 2.0) return "laranja";
  return "vermelha";
}

/** Forma mínima de uma linha de aet_laudo_fatores_psi. */
export interface FatorPsiLinha {
  id_setor: string;
  codigo_fator: string;
  avaliado?: boolean;
  media?: number | null;
  zona?: ZonaPsi | null;
  observacao?: string | null;
  pergunta_critica?: string | null;
}

// ── Média de um fator num setor ──────────────────────────────────────────────
//
// A MESMA conta em quatro lugares: as duas telas de preenchimento (setores e
// psicossocial), a prévia do laudo e o template do PDF. Estava copiada em cada
// um — e as cópias divergiram: as telas de preenchimento percorriam as
// PERGUNTAS do fator, a prévia e o PDF percorriam as RESPOSTAS gravadas.
//
// A diferença aparece quando existe resposta ÓRFÃ: linha cujo `pergunta_ordem`
// não pertence ao fator no conjunto de perguntas em vigor (sobra de quando
// `aet_13fatores_perguntas` tinha outro conjunto — hoje a tabela está vazia e
// vale o fallback de lib/aet/perguntas-default.ts, com outra divisão de ordens
// por fator). Percorrendo as respostas, a órfã não acha pergunta, `logica` sai
// undefined e a nota entra CRUA, sem o 6−nota da lógica direta — derrubando a
// média. No laudo da NOVAPARECIDA isso pintava de amarelo o F02 e o F03 do
// setor ADMINISTRATIVO, verdes no preenchimento e verdes no que está gravado.
//
// Vale a versão das telas de preenchimento: quem manda são as perguntas do
// fator, resposta órfã é ignorada.

export interface PerguntaFatorLike {
  codigo_fator: string;
  ordem: number;
  logica?: string | null;
}

/**
 * Núcleo da conta. `respostaDe(ordem)` devolve a nota (1..5) daquela pergunta
 * no setor, ou null/undefined se não foi respondida.
 *
 * Arredonda para 2 casas ANTES de classificar: sem isso uma média de 3,999…
 * cairia numa zona na tela e em outra no PDF.
 */
export function mediaFator(
  perguntas: PerguntaFatorLike[],
  codigoFator: string,
  respostaDe: (ordem: number) => number | null | undefined,
): number | null {
  const doFator = perguntas.filter((p) => p.codigo_fator === codigoFator);
  if (doFator.length === 0) return null;
  const scores: number[] = [];
  for (const p of doFator) {
    const nota = respostaDe(p.ordem);
    if (nota == null) continue;
    scores.push(p.logica === "direta" ? 6 - nota : nota);
  }
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

/** Forma mínima de uma linha de aet_laudo_qps_respostas. */
export interface RespostaQpsLike {
  id_setor: string;
  codigo_fator: string;
  pergunta_ordem: number;
  resposta: number;
}

/** Adaptador para quem tem as respostas em LINHAS (prévia do laudo e PDF). */
export function mediaFatorDeLinhas(
  perguntas: PerguntaFatorLike[],
  respostas: RespostaQpsLike[],
  idSetor: string,
  codigoFator: string,
): number | null {
  return mediaFator(perguntas, codigoFator, (ordem) =>
    respostas.find(
      (r) => r.id_setor === idSetor && r.codigo_fator === codigoFator && r.pergunta_ordem === ordem,
    )?.resposta,
  );
}

/**
 * Devolve as linhas com `media` e `zona` RECALCULADAS das respostas gravadas.
 *
 * ⚠️ POR QUE ISTO EXISTE — dois defeitos, uma cura:
 *
 * 1. `aet_laudo_fatores_psi.media` era **numeric(3,1)** na produção. O cabeçalho
 *    da v135 registra que o schema real divergiu da v55 (que declarava
 *    `numeric(4,2)`). O app calcula e grava 4.25, o banco guardava **4.3** — e o
 *    quadro geral, o único lugar que IMPRIMIA o valor gravado, saía "4.30"
 *    onde as outras quatro telas mostram "4.25". Medido em 11/09 na produção:
 *    das 351 linhas com resposta, **99 estavam arredondadas** assim. No laudo
 *    do setor CONDOMÍNIO isso fez F03 (17/4 = 4.25) e F05 (13/3 = 4.33)
 *    saírem com a MESMA média, 4.30 — foi por aí que o defeito apareceu.
 *    (A **v245**, de 22/09/2026, alargou a coluna para `numeric(4,2)`. O
 *    recálculo continua valendo: ele resolve o defeito 2, que é outro.)
 *
 * 2. O valor gravado é um RETRATO: só é reescrito quando alguém clica
 *    "Salvar Fxx". Mexer nas respostas depois deixava o número congelado.
 *    Três linhas da base divergiam por mais que arredondamento — uma por
 *    **2,0 pontos** (F01 gravado 2.0/laranja com 1 de 5 perguntas respondidas;
 *    o exato é 4.0/verde), e essa mentia até no Nível PGR.
 *
 * Recalcular alinha o quadro geral à tabela por setor do MESMO documento, que
 * sempre recalculou (`mediaFatorDeLinhas`), e resolve os dois de uma vez.
 *
 * A zona vem recalculada junto, de propósito: se só a média mudasse, a linha
 * do F01 acima imprimiria "4.00 · Laranja" — contra a própria legenda da
 * tabela (≥ 4,0 é verde). Média e zona saem sempre do MESMO valor.
 *
 * **Sem resposta nenhuma, o fator sai "—" (média e zona nulas).** Até 22/09/2026
 * esta função devolvia a linha GRAVADA nesse caso, com o argumento de que
 * repetir o último número conhecido era melhor que inventar um. O argumento
 * estava meio certo — inventar é ruim —, mas "—" não é invenção: é "não
 * medido", que é a verdade. E era o que a **tabela por setor do mesmo
 * documento** já fazia (`laudo/page.tsx`: `if (media === null) return null`,
 * e o fator simplesmente some da tabela). O laudo dizia duas coisas sobre o
 * mesmo par (setor, fator): nada em cima, número com tarja colorida embaixo.
 *
 * Pior: o quadro geral é o PIOR CASO entre os setores. Um fantasma "laranja"
 * ganhava de um "verde" real de outro setor e subia o **Nível PGR** com ele.
 * Medido na produção em 22/09 (simulação sobre os 11 laudos, com as respostas
 * reais): 15 linhas assim, e o único laudo em que apareciam era um RASCUNHO de
 * teste — onde o F01 imprimia **2,00 · Laranja · Alto** valendo **4,00 · Verde
 * · Trivial**. Nenhum laudo real muda com esta correção.
 *
 * De onde vinham: o backfill da **v135** replicou cada fator do laudo para
 * TODOS os setores, inclusive os que nunca responderam aquele fator. E podem
 * voltar a nascer se o conjunto de perguntas mudar — resposta gravada com
 * `pergunta_ordem` que não pertence mais ao fator não entra na conta, e o fator
 * inteiro cai aqui. Ver a nota de resposta órfã em `mediaFator`.
 *
 * **F13 continua fora do recálculo**: não tem média e a zona é escolhida à mão
 * pelo técnico — ali o gravado é mesmo tudo que existe.
 *
 * Rodar ANTES de `consolidarPiorCaso`: quem escolhe o pior setor tem de olhar
 * o valor exato, senão o retrato velho de um setor ganha do real de outro.
 */
export function recalcularDasRespostas<T extends FatorPsiLinha>(
  linhas: T[],
  perguntas: PerguntaFatorLike[],
  respostas: RespostaQpsLike[],
): T[] {
  return linhas.map((l) => {
    if (l.codigo_fator === "F13") return l;
    const media = mediaFatorDeLinhas(perguntas, respostas, l.id_setor, l.codigo_fator);
    // Sem resposta que sustente o número, o fator sai "—": média E zona zeradas
    // juntas. Zerar só a média deixaria uma tarja de zona órfã, colorindo o
    // laudo a partir de nada — exatamente o que esta correção veio tirar.
    if (media === null) return { ...l, media: null, zona: null };
    return { ...l, media, zona: zonaFromMedia(media) };
  });
}

/** Zona mais grave entre duas (nulos são ignorados). */
export function piorZona(a: ZonaPsi | null, b: ZonaPsi | null): ZonaPsi | null {
  if (!a) return b;
  if (!b) return a;
  return ZONA_SEVERIDADE[b] > ZONA_SEVERIDADE[a] ? b : a;
}

/**
 * Descarta linhas de setores que não existem mais no laudo.
 *
 * `id_setor` não tem FK (os setores vivem no JSONB aet_relatorios.setores), então
 * excluir um setor deixa as linhas dele para trás. Sem este filtro, um setor já
 * apagado ainda puxaria o quadro geral para a pior zona.
 */
export function apenasSetoresExistentes<T extends FatorPsiLinha>(
  linhas: T[],
  idsSetores: string[],
): T[] {
  const validos = new Set(idsSetores);
  return linhas.filter((l) => validos.has(l.id_setor));
}

/** `a` representa uma condição pior que `b`? Zona manda; média desempata. */
function ehPior(a: FatorPsiLinha, b: FatorPsiLinha): boolean {
  const sa = a.zona ? ZONA_SEVERIDADE[a.zona] : -1;
  const sb = b.zona ? ZONA_SEVERIDADE[b.zona] : -1;
  if (sa !== sb) return sa > sb;
  // Empate de zona: média MENOR é a pior (>= 4.0 verde … < 2.0 vermelha).
  return (a.media ?? Infinity) < (b.media ?? Infinity);
}

/**
 * Consolida os vários setores num quadro geral: cada fator é apresentado na
 * condição MAIS DESFAVORÁVEL encontrada entre os setores — critério conservador,
 * o único defensável num laudo de SST (se um setor está em zona vermelha, o
 * quadro geral não pode exibir verde).
 *
 * Devolve a própria linha do pior setor, então média e zona saem do MESMO
 * registro gravado, sem recálculo: ficam coerentes entre si, e um laudo de um
 * único setor sai idêntico ao que saía antes da v135.
 */
export function consolidarPiorCaso<T extends FatorPsiLinha>(avaliados: T[]): T[] {
  const porCodigo = new Map<string, T>();
  for (const linha of avaliados) {
    const atual = porCodigo.get(linha.codigo_fator);
    if (!atual || ehPior(linha, atual)) porCodigo.set(linha.codigo_fator, linha);
  }
  return [...porCodigo.values()].sort((a, b) => a.codigo_fator.localeCompare(b.codigo_fator));
}
