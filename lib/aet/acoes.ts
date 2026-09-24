/**
 * Regras puras do Plano de Ação 5W2H do laudo AET (tabela `aet_acoes`, v207).
 *
 * Moram aqui, e não na tela, porque a MESMA ordem e o MESMO agrupamento têm
 * que sair na tela, na prévia do laudo e no PDF — os três leem daqui. Foi a
 * duplicação entre prévia e PDF que fez o AET divergir antes (v0.3.525).
 */
import { htmlParaTexto } from "@/lib/texto-rico";
import { gerarId } from "@/lib/utils";
import type { Acao5W2H, AetAcao } from "@/lib/supabase/types";

/** O mínimo que as três telas sabem de um setor do AET. */
export interface SetorPlanoLike {
  id: string;
  nome_setor?: string | null;
  descricao_atividade?: string | null;
  parecer_tecnico?: string | null;
  recomendacoes?: string | null;
}

export interface GrupoAcoes<S extends SetorPlanoLike> {
  /** null = "Ações gerais": sem setor, ou setor que já foi apagado do laudo. */
  setor: S | null;
  acoes: AetAcao[];
}

/** Rótulo do grupo sem setor — o mesmo nos três lugares. */
export const ROTULO_ACOES_GERAIS = "Ações gerais do laudo";

/**
 * Agrupa as ações na ORDEM DOS SETORES DO LAUDO (não na ordem de criação):
 * o técnico monta o plano setor a setor, e o laudo imprime setor a setor.
 * Dentro do grupo vale `ordem`. Setor sem ação não gera grupo. Ação cujo
 * `id_setor` não existe mais (setor apagado depois) cai nas gerais — não some.
 */
export function agruparAcoesPorSetor<S extends SetorPlanoLike>(
  acoes: AetAcao[],
  setores: S[],
): GrupoAcoes<S>[] {
  const ordenadas = [...acoes].sort((a, b) => a.ordem - b.ordem);
  const ids = new Set(setores.map((s) => s.id));
  const grupos: GrupoAcoes<S>[] = [];
  for (const setor of setores) {
    const doSetor = ordenadas.filter((a) => a.id_setor === setor.id);
    if (doSetor.length) grupos.push({ setor, acoes: doSetor });
  }
  const gerais = ordenadas.filter((a) => !a.id_setor || !ids.has(a.id_setor));
  if (gerais.length) grupos.push({ setor: null, acoes: gerais });
  return grupos;
}

/** Ação do plano quando ela não tem texto — usada na criação e no `onBlur`. */
export const ACAO_PADRAO = "Nova ação";

/**
 * Contexto que vai para o assistente `gerar-acao-ia` (Groq). A rota foi feita
 * para o risco de INSPEÇÃO; aqui o "risco" é o setor inteiro do AET, e o que
 * pesa é a recomendação do ergonomista, que entra como `medidasRecomendadas`
 * (texto limpo — a recomendação é HTML do editor).
 *
 * Só monta; quem chama é a tela. Sem setor (ação geral) vai só a empresa.
 */
export function contextoIaDaAcao(params: {
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  setor: SetorPlanoLike | null;
  parcial: Record<string, string | null>;
}) {
  const { empresa, setor, parcial } = params;
  const recomendacao = htmlParaTexto(setor?.recomendacoes);
  const parecer = htmlParaTexto(setor?.parecer_tecnico);
  return {
    empresa: { nome: empresa?.nome ?? null, cnpj: empresa?.cnpj ?? null },
    setor: setor
      ? { nome: setor.nome_setor ?? null, descricao: htmlParaTexto(setor.descricao_atividade) || null }
      : null,
    risco: setor
      ? {
          tipo: "Ergonômico",
          agente: "Condições ergonômicas do setor (AET / NR-17)",
          fonte: parecer ? `Parecer técnico: ${parecer}` : null,
          medidasRecomendadas: recomendacao || null,
        }
      : null,
    parcial,
  };
}

/**
 * O assistente devolve o prazo em DIAS (`when_prazo_dias`). No `/acoes` central
 * isso vira data; aqui a coluna é texto livre, então vira "30 dias". Fora da
 * faixa que o próprio prompt promete (7–180) ou não numérico → vazio, e o
 * técnico escreve.
 */
export function prazoIaParaTexto(dias: unknown): string {
  if (typeof dias !== "number" || !Number.isFinite(dias)) return "";
  const n = Math.round(dias);
  if (n < 1 || n > 365) return "";
  return n === 1 ? "1 dia" : `${n} dias`;
}

// ─── Porta para o Plano de Ação do PGR (acoes_5w2h central) — v208 ──────────

/** As ações do AET que o botão envia: tudo que não foi cancelado. */
export function acoesEnviaveis(acoes: AetAcao[]): AetAcao[] {
  return acoes.filter((a) => a.status !== "Cancelada");
}

/** yyyy-mm-dd a partir de um Date em UTC — sem passar por fuso. */
function isoUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * O prazo do AET é TEXTO LIVRE; o do plano central é `date` (o Portal do
 * Cliente calcula "atrasado" em cima dele). Converte só o que é inequívoco:
 *
 *   "2026-10-15" / "15/10/2026"      → a própria data
 *   "30 dias" / "em 30 dias." / "2 semanas" / "3 meses" → contado de `hoje`
 *   "imediato", "na próxima parada"  → null (o texto vai para as observações)
 *
 * Nunca inventa data: quem não casa sai null, e o texto original é preservado
 * por `acaoCentralDeAetAcao`. `hoje` entra por parâmetro (ISO) para o teste
 * não depender do relógio nem do fuso.
 */
export function prazoTextoParaData(texto: string | null | undefined, hoje: string): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const rel = /^(?:em\s+)?(\d{1,3})\s*(dia|dias|semana|semanas|m[eê]s|meses)(?:\s+corridos?)?\.?$/i.exec(t);
  if (!rel) return null;
  const n = Number(rel[1]);
  const unidade = rel[2].toLowerCase();
  const [y, m, d] = hoje.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  if (unidade.startsWith("dia")) base.setUTCDate(base.getUTCDate() + n);
  else if (unidade.startsWith("semana")) base.setUTCDate(base.getUTCDate() + n * 7);
  else base.setUTCMonth(base.getUTCMonth() + n);
  return isoUtc(base);
}

export interface OpcoesEnvioCentral {
  idEmpresa: string;
  /** Como o laudo é citado nas observações, ex.: "AET 6d2ef44c de 02/09/2026". */
  referencia: string;
  setores: SetorPlanoLike[];
  createdBy: string | null;
  /** ISO yyyy-mm-dd; a data de hoje, para o prazo relativo ("30 dias"). */
  hoje: string;
  /** Gerador do id — injetável para o teste ser determinístico. */
  gerarIdAcao?: () => string;
}

/**
 * Cópia de uma ação do AET para o `acoes_5w2h` central — o Plano de Ação do
 * PGR. É CÓPIA, como as portas da Apreciação (v67) e da Inspeção (v184): a
 * partir do envio as duas vivem separadas; editar no AET não muda o central.
 * A origem fica em `id_aet_acao` (índice único parcial no banco = envio único).
 *
 * `id_setor` vai null de propósito: os setores do AET são JSONB do laudo, não
 * a tabela `setores` que o central referencia. O nome do setor vai no "Onde"
 * (quando o técnico não preencheu) e nas observações.
 */
export function acaoCentralDeAetAcao(a: AetAcao, opts: OpcoesEnvioCentral): Acao5W2H {
  const setor = a.id_setor ? opts.setores.find((s) => s.id === a.id_setor) ?? null : null;
  const nomeSetor = setor?.nome_setor?.trim() || null;
  const prazoTexto = (a.when_prazo ?? "").trim();
  const prazoData = prazoTextoParaData(prazoTexto, opts.hoje);
  const prazoEraData = !!prazoTexto && /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/.test(prazoTexto);

  const obs: string[] = [`Origem: ${opts.referencia}`];
  if (nomeSetor) obs.push(`Setor: ${nomeSetor}`);
  if (prazoTexto && !prazoEraData) {
    obs.push(
      prazoData
        ? `Prazo na AET: "${prazoTexto}" (contado a partir de ${formatarDataBr(opts.hoje)})`
        : `Prazo combinado na AET: "${prazoTexto}"`,
    );
  }
  if (a.observacoes?.trim()) obs.push(a.observacoes.trim());

  return {
    id_acao: (opts.gerarIdAcao ?? (() => gerarId("ACA")))(),
    id_empresa: opts.idEmpresa,
    id_setor: null,
    id_risco: null,
    id_inspecao: null,
    id_apreciacao_item: null,
    id_apreciacao_acao: null,
    id_risco_origem: null,
    id_aet_acao: a.id_acao,
    what_acao: a.what_acao,
    why_justificativa: a.why_justificativa,
    where_local: a.where_local?.trim() || nomeSetor,
    when_prazo: prazoData,
    who_responsavel: a.who_responsavel,
    how_metodo: a.how_metodo,
    how_much_custo: a.how_much_custo,
    status: a.status,
    prioridade: a.prioridade,
    data_conclusao: a.data_conclusao,
    observacoes: obs.join("\n"),
    created_by: opts.createdBy,
  };
}

function formatarDataBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
