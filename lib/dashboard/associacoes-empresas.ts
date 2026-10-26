/**
 * Documentos associados — contado em EMPRESAS por pessoa, mês a mês (pedido de 26/10/2026).
 *
 * A pergunta: "quantas empresas foram associadas àquela pessoa no mês", seja porque ela mesma se
 * associou, seja porque outra pessoa a associou — sem acumular o mês anterior. E, num gráfico à
 * parte, o acumulado mês a mês.
 *
 * Fontes de um EVENTO (pessoa recebe um documento numa data):
 *  - `inspecao_associados`: a linha da associação (`created_at`, `nome`). Quem associou não importa;
 *  - `dashboard_assuncoes()` (v295): quando o documento ganhou responsável pelo botão "Assumir
 *    elaboração" — a data vem da auditoria (que só existe a partir de quando foi ligada). Documento assumido antes disso
 *    e sem linha de associação continua sem data: não entra em mês nenhum (e a tela diz quantos são).
 *
 * Regras:
 *  1. Por pessoa e documento vale o PRIMEIRO evento — associar em setembro e clicar em "Assumir" em
 *     outubro não conta a mesma empresa duas vezes.
 *  2. Por pessoa e mês conta EMPRESA distinta: dois documentos da mesma empresa no mês = 1.
 *  3. O acumulado de um mês é a soma dos meses anteriores e dele — a mesma conta das barras mensais,
 *     só somada. Assim acumulado − acumulado do mês anterior = a barra do mês.
 *
 * Puro (sem consulta): testado em associacoes-empresas.test.ts.
 */

import { chaveNome } from "./documentos";

export interface LinhaAssociacao {
  id_inspecao: string;
  nome: string | null;
  created_at: string | null;
}

export interface LinhaAssuncao {
  id_inspecao: string;
  responsavel: string | null;
  assumido_em: string | null;
  /**
   * v297: "assuncao" = botão "Assumir elaboração"; "associacao_removida" = associação que já foi
   * excluída (a auditoria guarda a linha). Ela conta no mês em que aconteceu: o histórico não some
   * quando alguém desfaz a associação depois.
   */
  origem?: "assuncao" | "associacao_removida" | null;
}

export interface DocumentoDaEmpresa {
  id_inspecao: string;
  status: string;
  id_empresa: string | null;
  nome_empresa?: string | null;
}

/** Uma empresa associada a uma pessoa num mês. */
export interface EventoEmpresa {
  /** Chave da pessoa (sem caixa/acento) — agrupa grafias. */
  chave: string;
  /** Grafia exibida. */
  pessoa: string;
  id_empresa: string;
  nome_empresa: string;
  id_inspecao: string;
  /** Instante do evento (ISO). */
  em: string;
  /** Mês absoluto do evento. */
  mes: number;
  origem: "associacao" | "assuncao";
}

/**
 * Os eventos (pessoa, documento) → 1º evento de cada par. Documentos excluídos e sem empresa ficam
 * de fora. `mesDe` converte o instante em mês absoluto (fuso de São Paulo, lib/dashboard/mes).
 */
export function eventosDeAssociacao(
  associacoes: readonly LinhaAssociacao[],
  assuncoes: readonly LinhaAssuncao[],
  documentos: readonly DocumentoDaEmpresa[],
  mesDe: (iso: string) => number,
): EventoEmpresa[] {
  const docs = new Map(documentos.filter((d) => d.status !== "DELETADA" && d.id_empresa).map((d) => [d.id_inspecao, d]));
  const primeiro = new Map<string, EventoEmpresa>();
  const somar = (idInspecao: string, nome: string | null, em: string | null, origem: EventoEmpresa["origem"]) => {
    const pessoa = (nome ?? "").replace(/\s+/g, " ").trim();
    const d = docs.get(idInspecao);
    if (!pessoa || !em || !d) return;
    const chave = chaveNome(pessoa);
    const k = `${chave}|${idInspecao}`;
    const atual = primeiro.get(k);
    if (atual && atual.em <= em) return;
    primeiro.set(k, {
      chave,
      pessoa,
      id_empresa: d.id_empresa!,
      nome_empresa: d.nome_empresa ?? "—",
      id_inspecao: idInspecao,
      em,
      mes: mesDe(em),
      origem,
    });
  };
  for (const a of associacoes) somar(a.id_inspecao, a.nome, a.created_at, "associacao");
  for (const a of assuncoes)
    somar(a.id_inspecao, a.responsavel, a.assumido_em, a.origem === "associacao_removida" ? "associacao" : "assuncao");
  return [...primeiro.values()];
}

/** Grafia mais usada de cada pessoa (chave → nome exibido). */
function grafias(eventos: readonly EventoEmpresa[]): Map<string, string> {
  const cont = new Map<string, Map<string, number>>();
  for (const e of eventos) {
    const m = cont.get(e.chave) ?? new Map<string, number>();
    m.set(e.pessoa, (m.get(e.pessoa) ?? 0) + 1);
    cont.set(e.chave, m);
  }
  const out = new Map<string, string>();
  for (const [k, m] of cont) out.set(k, [...m.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
  return out;
}

/** Empresas distintas por (pessoa, mês): chave → mês → conjunto de empresas. */
function empresasPorPessoaMes(eventos: readonly EventoEmpresa[]): Map<string, Map<number, Set<string>>> {
  const out = new Map<string, Map<number, Set<string>>>();
  for (const e of eventos) {
    const porMes = out.get(e.chave) ?? new Map<number, Set<string>>();
    const s = porMes.get(e.mes) ?? new Set<string>();
    s.add(e.id_empresa);
    porMes.set(e.mes, s);
    out.set(e.chave, porMes);
  }
  return out;
}

/** Barras do mês: soma, sobre as pessoas, das empresas distintas de cada uma no mês. */
export function empresasAssociadasPorMes(
  eventos: readonly EventoEmpresa[],
  mesAtual: number,
  nMeses: number,
): { chave: number; total: number }[] {
  const primeiro = mesAtual - (nMeses - 1);
  const meses = Array.from({ length: nMeses }, (_, i) => ({ chave: primeiro + i, total: 0 }));
  for (const porMes of empresasPorPessoaMes(eventos).values()) {
    for (const [mes, s] of porMes) {
      const i = mes - primeiro;
      if (i >= 0 && i < nMeses) meses[i].total += s.size;
    }
  }
  return meses;
}

export interface PessoaEmpresas {
  pessoa: string;
  total: number;
}

const ordenar = (a: PessoaEmpresas, b: PessoaEmpresas) => b.total - a.total || a.pessoa.localeCompare(b.pessoa, "pt-BR");

/**
 * Empresas por pessoa NO mês `mes` (sem acumular). Com `mes = null`, a soma de todos os meses (a
 * mesma conta, sem recorte) — a tela rotula como "todos os meses".
 */
export function empresasPorPessoa(eventos: readonly EventoEmpresa[], mes: number | null): PessoaEmpresas[] {
  const nomes = grafias(eventos);
  const out: PessoaEmpresas[] = [];
  for (const [chave, porMes] of empresasPorPessoaMes(eventos)) {
    let total = 0;
    for (const [m, s] of porMes) if (mes === null || m === mes) total += s.size;
    if (total > 0) out.push({ pessoa: nomes.get(chave) ?? chave, total });
  }
  return out.sort(ordenar);
}

/** Acumulado até `ateMes` (inclusive): a soma das barras mensais da pessoa até lá. */
export function acumuladoPorPessoa(eventos: readonly EventoEmpresa[], ateMes: number): PessoaEmpresas[] {
  const nomes = grafias(eventos);
  const out: PessoaEmpresas[] = [];
  for (const [chave, porMes] of empresasPorPessoaMes(eventos)) {
    let total = 0;
    for (const [m, s] of porMes) if (m <= ateMes) total += s.size;
    if (total > 0) out.push({ pessoa: nomes.get(chave) ?? chave, total });
  }
  return out.sort(ordenar);
}

/** Documentos com responsável de elaboração que não têm data de entrada (nem associação nem auditoria). */
export function semDataDeAssociacao(
  documentos: readonly (DocumentoDaEmpresa & { elaboracao_responsavel?: string | null })[],
  eventos: readonly EventoEmpresa[],
): number {
  const comEvento = new Set(eventos.map((e) => e.id_inspecao));
  return documentos.filter(
    (d) => d.status !== "DELETADA" && (d.elaboracao_responsavel ?? "").trim() !== "" && !comEvento.has(d.id_inspecao),
  ).length;
}
