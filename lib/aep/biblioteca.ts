/**
 * Biblioteca psicossocial — BASE DE OPÇÕES do inventário de risco
 * (2026-10-06; v272 + v276).
 *
 * Cada tópico do inventário é uma lista de opções selecionáveis
 * (`psi_biblioteca_itens`):
 *   • por fator: perigo, fonte geradora, evidência, descrição do risco, danos
 *     à saúde, medida de controle (existente e recomendada — v277), sugestão
 *     inicial e ação;
 *   • comuns a todos os fatores (fator null): meio de propagação, situação e
 *     tempo de exposição — o padrão de cada fator fica em
 *     `psi_biblioteca_fatores` (meio_propagacao, situacao_padrao,
 *     tempo_exposicao_padrao).
 * `padrao` = a opção já vem marcada no inventário.
 *
 * Quem inclui: o Admin, direto; o técnico SUGERE (status 'pendente') e o
 * Admin aprova ou recusa. Só itens 'ativo' aparecem para seleção.
 *
 * Única para o sistema (sem empresa): a AEP usa hoje, o DRPS/QPS podem usar
 * depois. Módulo PURO: tela, laudo, rota do PDF e inventário usam o mesmo.
 */

export type TopicoBib =
  | "perigo"
  | "fonte"
  | "evidencia"
  | "descricao"
  | "danos"
  | "medida"
  | "medida_recomendada"
  | "sugestao"
  | "acao"
  | "meio"
  | "situacao"
  | "tempo";

export const TOPICOS_COMUNS: TopicoBib[] = ["meio", "situacao", "tempo"];

export const ROTULO_TOPICO: Record<TopicoBib, string> = {
  perigo: "Perigo",
  fonte: "Fontes geradoras",
  evidencia: "Evidências",
  descricao: "Descrição do risco",
  danos: "Danos à saúde",
  medida: "Medidas de controle existentes",
  medida_recomendada: "Medidas de controle recomendadas",
  sugestao: "Sugestões iniciais",
  acao: "Ações",
  meio: "Meio de propagação",
  situacao: "Situação",
  tempo: "Tempo de exposição",
};

/** Ordem dos tópicos por fator na tela da biblioteca. */
export const TOPICOS_DO_FATOR: TopicoBib[] = [
  "perigo",
  "fonte",
  "evidencia",
  "descricao",
  "danos",
  "medida",
  "medida_recomendada",
  "sugestao",
  "acao",
];

export type StatusItem = "ativo" | "pendente" | "recusado";

export interface ItemBiblioteca {
  id_item: string;
  fator: string | null;
  topico: TopicoBib;
  texto: string;
  codigo: string | null;
  ordem: number;
  padrao: boolean;
  status: StatusItem;
  sugerido_por?: string | null;
  sugerido_em?: string | null;
  revisado_por?: string | null;
  revisado_em?: string | null;
}

/** Linha de `psi_biblioteca_fatores`: ordem e padrão de meio/situação/tempo. */
export interface FatorBiblioteca {
  fator: string;
  ordem: number;
  meio_propagacao: string;
  situacao_padrao: string;
  tempo_exposicao_padrao: string;
}

export interface Biblioteca {
  fatores: Record<string, FatorBiblioteca>;
  itens: ItemBiblioteca[];
}

const txt = (v: unknown) => (typeof v === "string" ? v : "");
const TOPICOS = Object.keys(ROTULO_TOPICO) as TopicoBib[];

export function normalizarItem(raw: unknown): ItemBiblioteca | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id_item !== "string" || !TOPICOS.includes(r.topico as TopicoBib) || !txt(r.texto).trim()) return null;
  return {
    id_item: r.id_item,
    fator: typeof r.fator === "string" ? r.fator : null,
    topico: r.topico as TopicoBib,
    texto: txt(r.texto),
    codigo: typeof r.codigo === "string" && r.codigo ? r.codigo : null,
    ordem: typeof r.ordem === "number" ? r.ordem : 0,
    padrao: r.padrao === true,
    status: r.status === "pendente" || r.status === "recusado" ? r.status : "ativo",
    sugerido_por: typeof r.sugerido_por === "string" ? r.sugerido_por : null,
    sugerido_em: typeof r.sugerido_em === "string" ? r.sugerido_em : null,
    revisado_por: typeof r.revisado_por === "string" ? r.revisado_por : null,
    revisado_em: typeof r.revisado_em === "string" ? r.revisado_em : null,
  };
}

export function montarBiblioteca(rowsFatores: unknown[] | null | undefined, rowsItens: unknown[] | null | undefined): Biblioteca {
  const fatores: Record<string, FatorBiblioteca> = {};
  for (const r of rowsFatores ?? []) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.fator !== "string") continue;
    fatores[o.fator] = {
      fator: o.fator,
      ordem: typeof o.ordem === "number" ? o.ordem : 0,
      meio_propagacao: txt(o.meio_propagacao),
      situacao_padrao: txt(o.situacao_padrao),
      tempo_exposicao_padrao: txt(o.tempo_exposicao_padrao),
    };
  }
  const itens = (rowsItens ?? []).map(normalizarItem).filter((x): x is ItemBiblioteca => !!x);
  itens.sort((a, b) => a.ordem - b.ordem || a.texto.localeCompare(b.texto, "pt-BR"));
  return { fatores, itens };
}

const ehComum = (t: TopicoBib) => TOPICOS_COMUNS.includes(t);

/** Opções de um tópico (ativas, por padrão) — comuns ignoram o fator. */
export function itensDe(
  b: Biblioteca | null | undefined,
  fator: string,
  topico: TopicoBib,
  status: StatusItem[] = ["ativo"],
): ItemBiblioteca[] {
  return (b?.itens ?? []).filter(
    (i) => i.topico === topico && status.includes(i.status) && (ehComum(topico) ? i.fator === null : i.fator === fator),
  );
}

/** Texto padrão do fator para meio/situação/tempo (em psi_biblioteca_fatores). */
export function padraoComum(b: Biblioteca | null | undefined, fator: string, topico: TopicoBib): string {
  const f = b?.fatores?.[fator];
  if (!f) return "";
  return topico === "meio" ? f.meio_propagacao : topico === "situacao" ? f.situacao_padrao : topico === "tempo" ? f.tempo_exposicao_padrao : "";
}

/** Ids marcados por padrão num tópico do fator. */
export function idsPadrao(b: Biblioteca | null | undefined, fator: string, topico: TopicoBib): string[] {
  const opcoes = itensDe(b, fator, topico);
  if (ehComum(topico)) {
    const alvo = padraoComum(b, fator, topico).trim().toLowerCase();
    return opcoes.filter((i) => i.texto.trim().toLowerCase() === alvo).map((i) => i.id_item);
  }
  return opcoes.filter((i) => i.padrao).map((i) => i.id_item);
}

/** "1.3 — texto" quando a opção tem código (fontes geradoras). */
export const rotuloItem = (i: Pick<ItemBiblioteca, "codigo" | "texto">) => (i.codigo ? `${i.codigo} — ${i.texto}` : i.texto);

/** Já existe opção (qualquer status) com o mesmo texto no tópico? */
export function existeNaBiblioteca(b: Biblioteca | null | undefined, fator: string, topico: TopicoBib, texto: string) {
  const t = texto.trim().toLowerCase();
  return itensDe(b, fator, topico, ["ativo", "pendente", "recusado"]).find((i) => i.texto.trim().toLowerCase() === t) ?? null;
}
