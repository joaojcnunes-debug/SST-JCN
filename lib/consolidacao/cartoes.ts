/**
 * Consolidação › Grupos de empresas e Por empresa em cartões (0.3.336, pedido do usuário em 27/11/2026). As telas abriam
 * vazias, só com o seletor; agora cada grupo (ou consolidação salva) é um cartão com a situação do registro, os documentos
 * usados e os avisos, antes de abrir.
 *
 * Módulo **puro** (sem React/Supabase), testado em `cartoes.test.ts`.
 */

import type { OrigemFonte } from "@/lib/psico-consolidacao/fatores";

// ── Situação do registro (fase 7: registrar a consolidação e a validação do cliente) ───────────────────────────────────

export type SituacaoRegistro = "sem-registro" | "aguardando" | "validando" | "validada";

export const ROTULO_SITUACAO_REGISTRO: Record<SituacaoRegistro, string> = {
  "sem-registro": "Sem registro",
  aguardando: "Registrada, aguardando validação",
  validando: "Validação em andamento",
  validada: "Validada",
};

export interface ResumoRegistro {
  situacao: SituacaoRegistro;
  /** Data do último registro. */
  ultimoEm: string | null;
  /** Empresas que já validaram o último registro (validação é por empresa). */
  validadas: number;
}

/**
 * A situação pelo ÚLTIMO registro: sem registro; registrado sem validação; validado por parte das empresas; validado por
 * todas. `empresas` = quantas empresas o grupo tem (as que precisam validar).
 */
export function resumirRegistro(
  execucoes: readonly { id_execucao: string; criado_em: string }[],
  validacoes: readonly { id_execucao: string; id_empresa: string }[],
  empresas: number,
): ResumoRegistro {
  if (execucoes.length === 0) return { situacao: "sem-registro", ultimoEm: null, validadas: 0 };
  const ultimo = [...execucoes].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
  const validadas = new Set(validacoes.filter((v) => v.id_execucao === ultimo.id_execucao).map((v) => v.id_empresa)).size;
  const situacao: SituacaoRegistro = validadas === 0 ? "aguardando" : validadas >= Math.max(1, empresas) ? "validada" : "validando";
  return { situacao, ultimoEm: ultimo.criado_em, validadas };
}

// ── Documentos e avisos ───────────────────────────────────────────────────────────────────────────────────────────────

export interface MembroCartao {
  id: string;
  nome: string;
  /** false = empresa fora do acesso de quem olha. */
  visivel: boolean;
}

export type DocsDaEmpresa = Partial<Record<OrigemFonte, { data: string | null }>>;

export interface ResumoDocs {
  /** Empresas (visíveis) com AEP. */
  comAep: number;
  /** Empresas (visíveis) com DRPS ou QPS. */
  comQuestionario: number;
  /** Data do documento mais recente. */
  maisRecente: string | null;
}

export function resumirDocs(membros: readonly MembroCartao[], docs: ReadonlyMap<string, DocsDaEmpresa>): ResumoDocs {
  let comAep = 0;
  let comQuestionario = 0;
  let maisRecente: string | null = null;
  for (const m of membros) {
    if (!m.visivel) continue;
    const d = docs.get(m.id) ?? {};
    if (d.AEP) comAep++;
    if (d.DRPS || d.QPS) comQuestionario++;
    for (const x of Object.values(d)) if (x?.data && (!maisRecente || x.data > maisRecente)) maisRecente = x.data;
  }
  return { comAep, comQuestionario, maisRecente };
}

/** Meses inteiros entre duas datas "AAAA-MM-DD…". */
function meses(de: string, ate: string): number {
  const [a1, m1, d1] = de.slice(0, 10).split("-").map(Number);
  const [a2, m2, d2] = ate.slice(0, 10).split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

export interface AvisoCartao {
  tipo: "sem-documento" | "sem-aep" | "sem-questionario" | "documento-antigo" | "fora-do-acesso";
  texto: string;
  /** Os nomes das empresas (para o título do aviso). */
  empresas: string[];
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * O que olhar antes de abrir: empresa sem AEP nem DRPS/QPS, só sem AEP, só sem questionário, documento com 24 meses ou
 * mais (a régua da Conciliação, NR-01 1.5.4.4.6) e empresa fora do acesso (não dá para consolidar o grupo inteiro).
 */
export function avisosDoCartao(membros: readonly MembroCartao[], docs: ReadonlyMap<string, DocsDaEmpresa>, hoje: string, mesesRevisao = 24): AvisoCartao[] {
  const semNada: string[] = [];
  const semAep: string[] = [];
  const semQuest: string[] = [];
  const antigo: string[] = [];
  const fora: string[] = [];
  for (const m of membros) {
    if (!m.visivel) {
      fora.push(m.nome);
      continue;
    }
    const d = docs.get(m.id) ?? {};
    const temQ = !!(d.DRPS || d.QPS);
    if (!d.AEP && !temQ) semNada.push(m.nome);
    else if (!d.AEP) semAep.push(m.nome);
    else if (!temQ) semQuest.push(m.nome);
    if (Object.values(d).some((x) => x?.data && meses(x.data, hoje) >= mesesRevisao)) antigo.push(m.nome);
  }
  const out: AvisoCartao[] = [];
  if (semNada.length) out.push({ tipo: "sem-documento", texto: `${plural(semNada.length, "empresa", "empresas")} sem AEP nem DRPS/QPS`, empresas: semNada });
  if (semAep.length) out.push({ tipo: "sem-aep", texto: `${plural(semAep.length, "empresa", "empresas")} sem AEP`, empresas: semAep });
  if (semQuest.length) out.push({ tipo: "sem-questionario", texto: `${plural(semQuest.length, "empresa", "empresas")} sem DRPS/QPS`, empresas: semQuest });
  if (antigo.length) out.push({ tipo: "documento-antigo", texto: `Documento com mais de ${mesesRevisao / 12} anos em ${plural(antigo.length, "empresa", "empresas")}`, empresas: antigo });
  if (fora.length) out.push({ tipo: "fora-do-acesso", texto: `${plural(fora.length, "empresa", "empresas")} fora do seu acesso`, empresas: fora });
  return out;
}
