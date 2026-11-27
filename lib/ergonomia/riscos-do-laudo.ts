/**
 * Riscos da AEP/AET levados para a aba Riscos da inspeção (0.3.308, banco v363, 19/11/2026 — pedido do João: "quando
 * uma AEP ou AET é realizada, os riscos não aparecem nos setores como os demais riscos").
 *
 * A AEP/AET guarda os riscos DENTRO do laudo, por setor:
 *   - `setores[].riscos` (AEP e AET): tipo, nome do risco, classificação e medida (AET também intensidade e técnica);
 *   - na AEP, os fatores organizacionais marcados "Sim" com o resultado AIHA (`aiha_organizacional`: probabilidade,
 *     severidade e nível, na mesma matriz dos riscos da inspeção).
 * O botão "Trazer riscos da AEP/AET" mostra a prévia que sai daqui e grava riscos comuns, com `origem` e
 * `origem_chave` (v363) para trazer de novo sem duplicar e atualizar o que mudou no laudo.
 *
 * Funções puras (testadas em riscos-do-laudo.test.ts); a busca e a gravação estão em lib/hooks/useRiscosDoLaudo.ts.
 */

import { AGENTE_SGG } from "@/lib/psico-consolidacao/lancamento-pgr";
import type { NivelRisco, TipoRisco } from "@/lib/supabase/types";

export type OrigemLaudo = "AEP" | "AET";

/** O que o laudo tem de cada setor (só o que importa aqui; AepSetor e AetSetor cabem nisto). */
export interface SetorDoLaudo {
  id: string;
  nome_setor: string;
  riscos?: ReadonlyArray<{
    id: string;
    tipo?: string | null;
    risco?: string | null;
    classificacao_risco?: string | null;
    medida_preventiva?: string | null;
    intensidade_concentracao?: string | null;
    tecnica_metodologia?: string | null;
  }>;
  checklist_organizacional?: Record<string, string> | null;
  aiha_organizacional?: Record<string, { probabilidade?: string | null; severidade?: string | null; nivel?: string | null }> | null;
}

export interface SetorDaInspecao {
  id_setor: string;
  setor_ghe: string;
}

/** Risco já gravado na inspeção (só os campos comparados). */
export interface RiscoGravado {
  id_risco: string;
  id_setor: string | null;
  origem_chave?: string | null;
  tipo_risco: string | null;
  agente: string | null;
  nivel_risco: string | null;
  probabilidade: string | null;
  severidade: string | null;
  medidas_recomendadas: string | null;
  concentracao_exposicao?: string | null;
  tecnica_utilizada?: string | null;
}

/** Campos do risco que vêm do laudo (e que trazer de novo atualiza). */
export interface DadosDoLaudo {
  tipo_risco: TipoRisco;
  agente: string;
  nivel_risco: NivelRisco | null;
  probabilidade: string | null;
  severidade: string | null;
  medidas_recomendadas: string | null;
  concentracao_exposicao: string | null;
  tecnica_utilizada: string | null;
}

export type Situacao = "novo" | "atualizar" | "igual";

export interface ItemDoLaudo {
  chave: string;
  origem: OrigemLaudo;
  /** Nome do setor como está no laudo. */
  setorLaudo: string;
  /** Setor da inspeção onde o risco fica (o do risco já gravado, ou o de mesmo nome). null = escolher na prévia. */
  idSetor: string | null;
  /** Veio de fator organizacional (AIHA) da AEP. */
  fator: boolean;
  dados: DadosDoLaudo;
  situacao: Situacao;
  /** Risco já gravado com esta chave. */
  idRisco: string | null;
  /** Campos que mudaram no laudo desde a última vez (situação "atualizar"). */
  mudou: (keyof DadosDoLaudo)[];
}

/** Classificação da AEP/AET → nível da inspeção (escala de 5 dos dois lados). */
export const NIVEL_DA_CLASSIFICACAO: Record<string, NivelRisco> = {
  Trivial: "Trivial",
  "De Atenção": "Baixo",
  Moderado: "Moderado",
  Alto: "Alto",
  Crítico: "Muito Alto",
};

/** Tipo da AEP/AET → tipo da inspeção (só "Acidentes" muda de nome). */
export function tipoDaInspecao(tipo: string | null | undefined): TipoRisco {
  const t = (tipo ?? "").trim();
  if (t === "Acidentes") return "Acidente";
  if (["Ergonômico", "Físico", "Químico", "Biológico", "Acidente", "Psicossocial"].includes(t)) return t as TipoRisco;
  return "Ergonômico";
}

const NIVEIS: readonly string[] = ["Trivial", "Baixo", "Moderado", "Alto", "Muito Alto"];

/** Nome do setor para casar laudo × inspeção: sem acento, sem caixa, espaços únicos. */
export function chaveSetor(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const vazio = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t ? t : null;
};

/** Os riscos que o laudo tem, um por item, com a chave de origem. */
export function riscosDoLaudo(origem: OrigemLaudo, setores: readonly SetorDoLaudo[]): { chave: string; setor: SetorDoLaudo; fator: boolean; dados: DadosDoLaudo }[] {
  const tipo = origem.toLowerCase();
  const out: { chave: string; setor: SetorDoLaudo; fator: boolean; dados: DadosDoLaudo }[] = [];
  for (const s of setores) {
    for (const r of s.riscos ?? []) {
      const agente = vazio(r.risco);
      if (!agente) continue;
      out.push({
        chave: `${tipo}:${s.id}:${r.id}`,
        setor: s,
        fator: false,
        dados: {
          tipo_risco: tipoDaInspecao(r.tipo),
          agente,
          nivel_risco: NIVEL_DA_CLASSIFICACAO[r.classificacao_risco ?? ""] ?? null,
          probabilidade: null,
          severidade: null,
          medidas_recomendadas: vazio(r.medida_preventiva),
          concentracao_exposicao: vazio(r.intensidade_concentracao),
          tecnica_utilizada: vazio(r.tecnica_metodologia),
        },
      });
    }
    // Fatores organizacionais "Sim" da AEP, com o resultado AIHA.
    for (const [fator, aiha] of Object.entries(s.aiha_organizacional ?? {})) {
      if ((s.checklist_organizacional ?? {})[fator] !== "sim") continue;
      const nivel = aiha?.nivel && NIVEIS.includes(aiha.nivel) ? (aiha.nivel as NivelRisco) : null;
      out.push({
        chave: `${tipo}:${s.id}:org:${fator}`,
        setor: s,
        fator: true,
        dados: {
          tipo_risco: "Psicossocial",
          agente: AGENTE_SGG[fator] ?? fator,
          nivel_risco: nivel,
          probabilidade: vazio(aiha?.probabilidade),
          severidade: vazio(aiha?.severidade),
          medidas_recomendadas: null,
          concentracao_exposicao: null,
          tecnica_utilizada: null,
        },
      });
    }
  }
  return out;
}

const CAMPOS: (keyof DadosDoLaudo)[] = [
  "tipo_risco", "agente", "nivel_risco", "probabilidade", "severidade", "medidas_recomendadas", "concentracao_exposicao", "tecnica_utilizada",
];

/**
 * A prévia: cada item do laudo com o setor da inspeção e se é novo, se mudou ou se já está igual; e os riscos trazidos
 * antes (desta origem) que não estão mais no laudo.
 */
export function previaDoLaudo(
  origem: OrigemLaudo,
  setoresLaudo: readonly SetorDoLaudo[],
  setoresInspecao: readonly SetorDaInspecao[],
  riscosInspecao: readonly RiscoGravado[],
): { itens: ItemDoLaudo[]; foraDoLaudo: RiscoGravado[] } {
  const porNome = new Map<string, string>();
  for (const s of setoresInspecao) {
    const k = chaveSetor(s.setor_ghe);
    if (k && !porNome.has(k)) porNome.set(k, s.id_setor);
  }
  const porChave = new Map<string, RiscoGravado>();
  for (const r of riscosInspecao) if (r.origem_chave) porChave.set(r.origem_chave, r);

  const itens = riscosDoLaudo(origem, setoresLaudo).map((x): ItemDoLaudo => {
    const gravado = porChave.get(x.chave) ?? null;
    const mudou = gravado
      ? CAMPOS.filter((c) => (vazio(gravado[c] as string | null) ?? null) !== (x.dados[c] ?? null))
      : [];
    return {
      chave: x.chave,
      origem,
      setorLaudo: x.setor.nome_setor,
      idSetor: gravado?.id_setor ?? porNome.get(chaveSetor(x.setor.nome_setor)) ?? null,
      fator: x.fator,
      dados: x.dados,
      situacao: !gravado ? "novo" : mudou.length ? "atualizar" : "igual",
      idRisco: gravado?.id_risco ?? null,
      mudou,
    };
  });
  const prefixo = `${origem.toLowerCase()}:`;
  const noLaudo = new Set(itens.map((i) => i.chave));
  const foraDoLaudo = riscosInspecao.filter((r) => r.origem_chave?.startsWith(prefixo) && !noLaudo.has(r.origem_chave));
  return { itens, foraDoLaudo };
}

// ── 0.3.331 (pedido do João, 27/11/2026): o setor do laudo casado automaticamente ─────────────────────────────────────

/** Semelhança de 0 a 1 entre dois nomes de setor (sem acento e sem caixa): 1 = igual; um contido no outro vale 0.9. */
export function semelhancaSetor(a: string, b: string): number {
  const x = chaveSetor(a), y = chaveSetor(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return 0.9;
  // distância de edição (Levenshtein) normalizada
  const m = x.length, n = y.length;
  let ant = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    for (let j = 1; j <= n; j++) atual[j] = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    ant = atual;
  }
  return 1 - ant[n] / Math.max(m, n);
}

/** Para onde vai um setor do laudo: um setor que a inspeção já tem, ou criar um novo com este nome. */
export type DestinoSetor = { tipo: "existente"; idSetor: string } | { tipo: "criar"; nome: string; descricao: string | null };

export interface CasamentoSetor {
  /** Nome do setor como está no laudo. */
  setorLaudo: string;
  /** Quantos riscos do laudo são deste setor. */
  riscos: number;
  /** "igual": mesmo nome na inspeção; "parecido": nome parecido (conferir); "novo": a inspeção não tem. */
  como: "igual" | "parecido" | "novo";
  /** O destino sugerido. */
  sugestao: DestinoSetor;
  /** A empresa já tem um setor com este nome em outra inspeção (o pré-cadastro). */
  doCadastro: { nome: string; descricao: string } | null;
}

/**
 * Casa cada setor do laudo com os setores da inspeção: nome igual (sem acento e sem caixa) vai direto; nome parecido
 * (semelhança ≥ 0,8) vem sugerido para conferir; sem nenhum, a sugestão é criar o setor com o nome do laudo — com a
 * descrição do pré-cadastro da empresa (setor de mesmo nome em outra inspeção), se houver.
 */
export function casarSetoresDoLaudo(
  itens: readonly Pick<ItemDoLaudo, "setorLaudo">[],
  setoresInspecao: readonly SetorDaInspecao[],
  cadastroEmpresa: readonly { nome: string; descricao: string }[],
): CasamentoSetor[] {
  const contagem = new Map<string, { nome: string; n: number }>();
  for (const i of itens) {
    const k = chaveSetor(i.setorLaudo);
    const c = contagem.get(k) ?? { nome: i.setorLaudo.trim(), n: 0 };
    c.n++;
    contagem.set(k, c);
  }
  return [...contagem.values()].map(({ nome, n }): CasamentoSetor => {
    const doCadastro = cadastroEmpresa.find((c) => chaveSetor(c.nome) === chaveSetor(nome)) ?? null;
    const igual = setoresInspecao.find((s) => chaveSetor(s.setor_ghe) === chaveSetor(nome));
    if (igual) return { setorLaudo: nome, riscos: n, como: "igual", sugestao: { tipo: "existente", idSetor: igual.id_setor }, doCadastro };
    let melhor: { s: SetorDaInspecao; nota: number } | null = null;
    for (const s of setoresInspecao) {
      const nota = semelhancaSetor(nome, s.setor_ghe);
      if (nota >= 0.8 && (!melhor || nota > melhor.nota)) melhor = { s, nota };
    }
    if (melhor) return { setorLaudo: nome, riscos: n, como: "parecido", sugestao: { tipo: "existente", idSetor: melhor.s.id_setor }, doCadastro };
    return {
      setorLaudo: nome,
      riscos: n,
      como: "novo",
      sugestao: { tipo: "criar", nome: doCadastro?.nome ?? nome, descricao: doCadastro?.descricao || null },
      doCadastro,
    };
  }).sort((a, b) => a.setorLaudo.localeCompare(b.setorLaudo, "pt-BR"));
}

// ── 0.3.332 (pedido do usuário, 27/11/2026): risco da AEP/AET Trivial ou Baixo não entra no PGR ───────────────────────────

/** O risco veio da AEP/AET e está classificado como Trivial ou Baixo: o relatório avisa que ele não deve entrar no PGR. */
export function laudoForaDoPgr(r: { origem?: string | null; nivel_risco?: NivelRisco | string | null }): boolean {
  const o = (r.origem ?? "").toUpperCase();
  return (o === "AEP" || o === "AET") && (r.nivel_risco === "Trivial" || r.nivel_risco === "Baixo");
}
