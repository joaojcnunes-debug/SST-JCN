/**
 * Aviso antes de concluir um cartão que NÃO vai ser roteado (0.3.318, 23/11/2026 — pedido do João).
 *
 * As automações de roteamento (ex.: "[Roteamento] Empresa nova → unidade") rodam quando o cartão ENTRA numa coluna
 * (gatilho status_muda, condição status_para = coluna) e só se o campo combinar (ex.: Produtos é PGR, PCMSO…).
 * Quem conclui um cartão sem esse campo não via nada acontecer. Esta regra diz, antes de mover, o que falta para
 * cada automação que criaria tarefa em outro quadro: o campo da condição e, para o destino "quadro da unidade",
 * a Região (etiqueta da cidade). Puro; testado em aviso-roteamento.test.ts.
 *
 * Espelha o `in` do banco (gestao_automacao_condicao_ok, v301): lista de valores separada por vírgula (ou array);
 * campo em array casa se tiver qualquer um deles; campo texto casa se for igual a um deles.
 */

import { regiaoDasEtiquetas } from "@/lib/gestao/regiao-produtos";

type Clausula = { campo?: string; op?: string; valor?: unknown };
type Condicao = { all?: Clausula[]; any?: Clausula[] } & Clausula;
type Acao = { tipo?: string; id_quadro_destino?: string };

export interface AutomacaoRoteamento {
  nome: string;
  ativo: boolean;
  gatilho: string;
  condicao?: Condicao | null;
  acoes?: Acao[] | null;
}

export interface CartaoRoteamento {
  etiquetas?: readonly string[] | null;
  campos?: Record<string, unknown> | null;
}

const lista = (v: unknown): string[] =>
  (Array.isArray(v) ? v.map(String) : String(v ?? "").split(",")).map((s) => s.trim()).filter(Boolean);

function casaIn(valorCampo: unknown, valores: string[]): boolean {
  if (Array.isArray(valorCampo)) return valorCampo.some((x) => valores.includes(String(x)));
  return valorCampo != null && valores.includes(String(valorCampo));
}

export interface FaltaRoteamento {
  automacao: string;
  /** Ex.: "Produtos (um destes: PGR, PCMSO, LTCAT, LI, LP)" ou "Região". */
  falta: string[];
}

/**
 * O que falta, por automação, para o cartão ser roteado ao entrar em `statusPara`. Vazio = nada a avisar.
 * Só olha automações ATIVAS, de "muda de coluna" para esta coluna, que criam tarefa em outro quadro e cuja condição
 * é só "todas (E)" (com "qualquer (OU)" não dá para dizer com certeza o que falta — fica sem aviso).
 */
export function faltasParaRoteamento(
  cartao: CartaoRoteamento,
  statusPara: string,
  automacoes: readonly AutomacaoRoteamento[],
  nomeDoCampo: (id: string) => string,
): FaltaRoteamento[] {
  const out: FaltaRoteamento[] = [];
  for (const a of automacoes) {
    if (!a.ativo || a.gatilho !== "status_muda") continue;
    const acoes = (a.acoes ?? []).filter((x) => x.tipo === "criar_tarefa_quadro");
    if (!acoes.length) continue;
    const c = a.condicao ?? {};
    if (c.any?.length) continue;
    const todas: Clausula[] = c.all ?? (c.campo ? [c] : []);
    const paraEsta = todas.some((x) => x.campo === "status_para" && x.op === "=" && String(x.valor) === statusPara);
    if (!paraEsta) continue;
    const falta: string[] = [];
    for (const x of todas) {
      if (!x.campo?.startsWith("campo:") || x.op !== "in") continue;
      const id = x.campo.slice("campo:".length);
      const valores = lista(x.valor);
      if (!valores.length || casaIn(cartao.campos?.[id], valores)) continue;
      falta.push(`${nomeDoCampo(id)} (um destes: ${valores.join(", ")})`);
    }
    // Só a Região não basta para rodar a automação; se o campo já falta, ela nem chega a procurar a unidade.
    if (!falta.length && acoes.some((x) => x.id_quadro_destino === "@unidade") && !regiaoDasEtiquetas(cartao.etiquetas)) {
      falta.push("Região");
    }
    if (falta.length) out.push({ automacao: a.nome, falta });
  }
  return out;
}

/**
 * O aviso, numa frase — só quando NENHUMA automação de roteamento desta coluna vai rodar (se uma roda, o cartão
 * segue; as outras são de outros produtos). null = nada a avisar.
 */
export function avisoRoteamento(
  cartao: CartaoRoteamento,
  statusPara: string,
  automacoes: readonly AutomacaoRoteamento[],
  nomeDoCampo: (id: string) => string,
): string | null {
  const candidatas = automacoes.filter((a) => {
    if (!a.ativo || a.gatilho !== "status_muda" || !(a.acoes ?? []).some((x) => x.tipo === "criar_tarefa_quadro")) return false;
    const c = a.condicao ?? {};
    if (c.any?.length) return false;
    const todas: Clausula[] = c.all ?? (c.campo ? [c] : []);
    return todas.some((x) => x.campo === "status_para" && x.op === "=" && String(x.valor) === statusPara);
  });
  if (!candidatas.length) return null;
  const faltas = faltasParaRoteamento(cartao, statusPara, candidatas, nomeDoCampo);
  if (faltas.length < candidatas.length) return null; // alguma roda
  // Campos da condição que faltam (sem a Região) — pelo id, para saber se está vazio ou só sem valor que combine.
  const ids = new Set<string>();
  for (const a of candidatas) {
    for (const x of a.condicao?.all ?? []) if (x.campo?.startsWith("campo:") && x.op === "in") ids.add(x.campo.slice(6));
  }
  const vazio = (id: string) => {
    const v = cartao.campos?.[id];
    return v == null || v === "" || (Array.isArray(v) && v.length === 0);
  };
  const soRegiao = faltas.every((f) => f.falta.every((x) => x === "Região"));
  if (soRegiao) return "O encaminhamento para a unidade não vai rodar: falta a Região do cartão.";
  const partes = [...ids].map((id) => (vazio(id) ? `${nomeDoCampo(id)} está vazio` : `nenhum ${nomeDoCampo(id)} marcado tem encaminhamento`));
  return `Nenhum encaminhamento vai rodar ao entrar nesta coluna: ${partes.join(" e ")}.`;
}
