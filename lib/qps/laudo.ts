// Montagem PURA do laudo da QAP (v226) — a mesma função alimenta o PDF
// (`/api/pdf/qps/[id]`, no servidor) e a prévia da tela Laudo (no navegador),
// para que os dois nunca divirjam: um bloco por setor com a conta da régua do
// DRPS (`calcularAnaliseSetor`), mais o consolidado ("*"), a caracterização
// dos trabalhadores e os textos que o psicólogo gravou na tela Análise.

import type {
  QpsAplicacao,
  QpsCategoria,
  QpsPergunta,
  QpsProbabilidade,
  QpsRespondente,
  QpsTipo,
} from "@/lib/supabase/types";
import {
  SETOR_TODA_APLICACAO,
  TODOS_OS_SETORES,
  calcularAnaliseSetor,
  listarSetoresQps,
  type CategoriaGravidade,
} from "./gravidade";
import { fontesEscolhidas, guardadasDe, textoFontes, type FontesPorSetor } from "@/lib/psicossocial/fontes";

/** Chave em `pdfs_assinados` / `pdfs_gerados` do laudo da aplicação (rota e tela Laudo usam a mesma). */
export const QPS_LAUDO_TABELA = "qps_aplicacoes_laudo";
/** `modulo` em pdfs_gerados / congelamento / anexos / textos_padrao. */
export const QPS_MODULO_PDF = "qps";

export interface BlocoSetorLaudo {
  /** Nome do setor; no consolidado, `TODOS_OS_SETORES`. */
  setor: string;
  ehConsolidado: boolean;
  totalRespondentes: number;
  /** Cargos declarados pelos respondentes do setor, separados por vírgula. */
  cargos: string;
  categorias: CategoriaGravidade[];
  agravos: string | null;
  medidas: string | null;
  /** HTML do RichTextEditor. */
  conclusao: string | null;
}

export interface DadosLaudoQps {
  aplicacao: QpsAplicacao;
  tipo: QpsTipo | null;
  /** Um bloco por setor com respondente, em ordem alfabética (pt-BR). */
  blocos: BlocoSetorLaudo[];
  /** O bloco "Todos os setores" (chave "*" nos textos) — a Conclusão Consolidada do laudo. */
  consolidado: BlocoSetorLaudo | null;
  totalRespondentes: number;
}

function cargosDe(respondentes: { cargo?: string | null }[]): string {
  const set = new Set<string>();
  for (const r of respondentes) {
    const c = (r.cargo ?? "").trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ");
}

/**
 * v262: troca a fonte geradora padrão da categoria pelas fontes escolhidas na
 * Análise para o setor ("*" = consolidado). Sem escolha guardada, fica o texto
 * da categoria intacto.
 */
export function aplicarFontesQps(
  analise: CategoriaGravidade[],
  fontes: FontesPorSetor | null | undefined,
  chaveSetor: string,
): CategoriaGravidade[] {
  if (!fontes) return analise;
  return analise.map((c) => {
    const guardadas = guardadasDe(fontes, chaveSetor, c.id_categoria);
    if (!guardadas) return c;
    return { ...c, fonteGeradora: textoFontes(fontesEscolhidas(guardadas, c.fonteGeradora)) || null };
  });
}

export function montarLaudoQps(args: {
  aplicacao: QpsAplicacao;
  tipo: QpsTipo | null | undefined;
  categorias: QpsCategoria[];
  perguntas: QpsPergunta[];
  respondentes: QpsRespondente[];
  probabilidades: QpsProbabilidade[];
}): DadosLaudoQps {
  const { aplicacao, categorias, perguntas, respondentes, probabilidades } = args;
  const tipo = args.tipo ?? null;
  const podeCalcular = !!tipo && categorias.length > 0;

  const textos = (mapa: Record<string, string> | null | undefined, chave: string) =>
    (mapa?.[chave] ?? "").trim() || null;

  const montarBloco = (setor: string): BlocoSetorLaudo => {
    const ehConsolidado = setor === TODOS_OS_SETORES;
    const chave = ehConsolidado ? SETOR_TODA_APLICACAO : setor;
    const recorte = ehConsolidado
      ? respondentes
      : respondentes.filter((r) => (r.setor ?? "").trim() === setor);
    return {
      setor,
      ehConsolidado,
      totalRespondentes: recorte.length,
      cargos: cargosDe(recorte),
      categorias: podeCalcular
        ? aplicarFontesQps(
            calcularAnaliseSetor(
              setor,
              categorias,
              perguntas,
              respondentes,
              probabilidades,
              tipo!.escala_min,
              tipo!.escala_max,
            ),
            aplicacao.fontes_por_setor,
            chave,
          )
        : [],
      agravos: textos(aplicacao.agravos_por_setor, chave),
      medidas: textos(aplicacao.medidas_por_setor, chave),
      conclusao: textos(aplicacao.conclusoes_por_setor, chave),
    };
  };

  const setores = listarSetoresQps(respondentes);
  const blocos = setores.map(montarBloco);
  const consolidado = respondentes.length > 0 ? montarBloco(TODOS_OS_SETORES) : null;

  return {
    aplicacao,
    tipo,
    blocos,
    consolidado,
    totalRespondentes: respondentes.length,
  };
}

/** Linha do Plano de Ação 5W2H como o template imprime (mesmo formato do DRPS). */
export interface PlanoAcaoLinhaLaudo {
  ordem: number;
  acao: string | null;
  justificativa: string | null;
  onde: string | null;
  prazo: string | null;
  responsavel: string | null;
  como: string | null;
  quanto_custa: string | null;
  status: string;
}

/** Uma linha do 5W2H só imprime se algum campo foi preenchido (igual ao DRPS). */
export function linhasPlanoComConteudo(linhas: PlanoAcaoLinhaLaudo[]): PlanoAcaoLinhaLaudo[] {
  return linhas.filter((l) =>
    [l.acao, l.justificativa, l.onde, l.prazo, l.responsavel, l.como, l.quanto_custa].some(
      (v) => (v ?? "").trim().length > 0,
    ),
  );
}
