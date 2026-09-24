/**
 * Conversão RISCO da inspeção → ação 5W2H do Plano de Ação central.
 *
 * Mora aqui, e não dentro do componente, pelo mesmo motivo de
 * `lib/dashboard/inspecoes.ts` e `lib/aet/consolidar-psi.ts`: regra copiada em
 * duas telas é regra que diverge em silêncio. Aqui ela é pura — entra risco,
 * sai objeto — e por isso tem teste.
 *
 * O CORTE (decisão do Sanmyo, 2026-08-26): só `Alto` e `Muito Alto` viram
 * ação. Medido na produção: 349 riscos dos 12.317 cadastrados. Incluir
 * `Moderado` levaria o plano a 3.694 linhas e ele deixaria de ser um plano.
 * Os demais continuam registrados no laudo — não somem, só não viram
 * pendência formal.
 */

import { gerarId, parseMedidas } from "@/lib/utils";
import type {
  Acao5W2H,
  AcaoPrioridade,
  NivelRisco,
  Risco,
  Setor,
} from "@/lib/supabase/types";

/** Níveis que viram ação. Fora daqui, o risco fica só no laudo. */
export const NIVEIS_QUE_VIRAM_ACAO: NivelRisco[] = ["Alto", "Muito Alto"];

export function riscoViraAcao(r: Risco): boolean {
  return (
    r.nivel_risco != null &&
    NIVEIS_QUE_VIRAM_ACAO.includes(r.nivel_risco as NivelRisco)
  );
}

/** Nível do risco → prioridade da ação. */
const PRIORIDADE_POR_NIVEL: Record<string, AcaoPrioridade> = {
  "Muito Alto": "Critica",
  Alto: "Alta",
};

/**
 * O texto do "O quê". Sai das medidas recomendadas que o técnico já digitou
 * — em 337 dos 349 riscos do corte elas existem (medido). Quando não existem,
 * a ação NÃO pode nascer vazia (`what_acao` é NOT NULL e é o que o cliente lê),
 * então nasce nomeando o risco a tratar, para alguém completar na tela.
 */
export function textoDaAcao(r: Risco, nomeSetor: string | null): string {
  const medidas = parseMedidas(r.medidas_recomendadas);
  if (medidas.length > 0) return medidas.join("; ");

  const alvo = [r.agente, r.tipo_risco].find(
    (x) => x != null && String(x).trim() !== ""
  );
  const onde = nomeSetor ? ` no setor ${nomeSetor}` : "";
  return `Definir medida de controle para o risco ${alvo ?? "identificado"}${onde} (sem medida recomendada registrada na inspeção).`;
}

/** O "Por quê": o retrato do risco como ele foi avaliado. */
export function justificativaDaAcao(r: Risco): string {
  const partes: string[] = [];
  const cabeca = [r.tipo_risco, r.agente]
    .filter((x) => x != null && String(x).trim() !== "")
    .join(" — ");
  if (cabeca) partes.push(`Risco ${cabeca}`);
  if (r.nivel_risco) partes.push(`nível ${r.nivel_risco}`);
  if (r.probabilidade && r.severidade) {
    partes.push(`${r.probabilidade} / ${r.severidade}`);
  }
  const fontes = parseMedidas(r.fonte_geradora);
  if (fontes.length > 0) partes.push(`fonte: ${fontes.join("; ")}`);
  return partes.join(" · ");
}

export interface OpcoesConversao {
  idInspecao: string;
  /** Nome legível da inspeção para a linha "Origem:" nas observações. */
  referenciaInspecao: string;
  /** Setores da inspeção, para traduzir id_setor em nome. */
  setores: Setor[];
  /** E-mail de quem clicou. */
  createdBy: string | null;
}

/**
 * Converte um risco em ação 5W2H.
 *
 * Nasce SEM prazo, SEM responsável, SEM método e SEM custo, de propósito
 * (decisão do Sanmyo, 2026-08-26): a equipe usa o assistente de IA da própria
 * tela de ações para completar. Prazo inventado num documento que vai ao
 * cliente é pior que campo vazio.
 */
export function acaoDeRisco(r: Risco, opts: OpcoesConversao): Acao5W2H {
  const nomeSetor =
    opts.setores.find((s) => s.id_setor === r.id_setor)?.setor_ghe ?? null;

  return {
    id_acao: gerarId("ACA"),
    id_empresa: r.id_empresa,
    id_setor: r.id_setor,
    id_risco: r.id_risco,
    id_inspecao: opts.idInspecao,
    id_apreciacao_item: null,
    id_apreciacao_acao: null,
    id_risco_origem: r.id_risco,
    id_aet_acao: null,
    what_acao: textoDaAcao(r, nomeSetor),
    why_justificativa: justificativaDaAcao(r) || null,
    where_local: nomeSetor,
    when_prazo: null,
    who_responsavel: null,
    how_metodo: null,
    how_much_custo: null,
    status: "Pendente",
    prioridade: PRIORIDADE_POR_NIVEL[r.nivel_risco ?? ""] ?? "Alta",
    data_conclusao: null,
    observacoes: `Origem: Inspeção — ${opts.referenciaInspecao}`,
    created_by: opts.createdBy,
  };
}

/** Os riscos da inspeção que o botão vai enviar, na ordem em que aparecem. */
export function riscosElegiveis(riscos: Risco[]): Risco[] {
  return riscos.filter(riscoViraAcao);
}
