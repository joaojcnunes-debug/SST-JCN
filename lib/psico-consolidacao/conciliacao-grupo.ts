// Conciliação DRPS/QPS × AEP por GRUPO de empresas (12/11/2026, v0.3.285, banco v354).
//
// No grupo econômico os trabalhadores transitam entre as empresas, e muitas vezes um CNPJ tem só a AEP e
// outro só o questionário. Aqui o grupo inteiro é conciliado de uma vez, com a MESMA régua da conciliação
// por empresa (`conciliarEmpresa`): entram a AEP mais recente de cada empresa e o DRPS/QPS mais recente de
// cada empresa. No mesmo setor × fator vale o pior nível, e a tela mostra de qual empresa ele veio.
//
// Função pura, testada em conciliacao-grupo.test.ts.

import {
  CLASSES,
  chaveParecer,
  MESES_DISTANCIA,
  MESES_REVISAO,
  contarPareceres,
  itensDoFechamento,
  mesesEntre,
  type AlertaRevisao,
  type ClasseConciliacao,
  type ContagemPareceres,
  type ItemFechamento,
  type ParecerConciliacao,
  type Questionario,
  type ResultadoConciliacao,
} from "./conciliacao";
import type { OrigemFonte } from "./fatores";
import { documentosPadrao, type DocumentoFonte } from "./fontes";

export const ORIGENS_GRUPO: OrigemFonte[] = ["AEP", "DRPS", "QPS"];

/** Empresa do grupo, como a conciliação precisa. */
export interface EmpresaDoGrupo {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
}

/** Documento usado, como fica na foto do fechamento do grupo. */
export interface DocumentoFechamentoGrupo {
  origem: OrigemFonte;
  id: string;
  titulo: string;
  data: string | null;
  id_empresa: string;
}

/** Item da foto do grupo: o da empresa, as empresas em que o setor aparece e todas as ações do parecer. */
export interface ItemFechamentoGrupo extends ItemFechamento {
  empresas?: string[];
  id_acoes?: string[];
}

/** Os documentos que entram por padrão: o mais recente de cada empresa do grupo, em cada origem. */
export function documentosDoGrupo(docs: readonly DocumentoFonte[], idsEmpresa: readonly string[]): DocumentoFonte[] {
  const ids = new Set(idsEmpresa);
  const doGrupo = docs.filter((d) => ids.has(d.idEmpresa));
  const padrao = documentosPadrao(doGrupo);
  return doGrupo.filter((d) => padrao.has(d.id)).sort((a, b) => ORIGENS_GRUPO.indexOf(a.origem) - ORIGENS_GRUPO.indexOf(b.origem) || (b.data ?? "").localeCompare(a.data ?? ""));
}

/** Os documentos por origem (mais recente primeiro). */
export function porOrigem(docs: readonly DocumentoFonte[]): Partial<Record<OrigemFonte, DocumentoFonte[]>> {
  const out: Partial<Record<OrigemFonte, DocumentoFonte[]>> = {};
  for (const d of docs) (out[d.origem] ??= []).push(d);
  for (const o of ORIGENS_GRUPO) out[o]?.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  return out;
}

/**
 * Rótulo curto da empresa dentro do grupo: a parte da filial do CNPJ ("0006-51"), que distingue as
 * empresas de uma mesma rede; sem CNPJ de 14 dígitos, o nome.
 */
export function rotuloEmpresa(e: Pick<EmpresaDoGrupo, "nome" | "cnpj">): string {
  const d = (e.cnpj ?? "").replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(8, 12)}-${d.slice(12)}`;
  return e.nome;
}

/** Resumo de um grupo para a lista (o mesmo desenho do resumo da empresa). */
export interface ResumoGrupo {
  idGrupo: string;
  documentos: DocumentoFonte[];
  porOrigem: Partial<Record<OrigemFonte, DocumentoFonte[]>>;
  /** Empresas do grupo que entraram com algum documento. */
  empresasComDocumento: number;
  falta: Array<"AEP" | "Questionário">;
  fonteUnica: boolean;
  fontes: Questionario[];
  semSetorEmComum: boolean;
  convergentes: number;
  divergencias: number;
  porClasse: Record<ClasseConciliacao, number>;
  pareceres: ContagemPareceres;
}

export function resumirGrupo(
  idGrupo: string,
  docs: readonly DocumentoFonte[],
  r: ResultadoConciliacao,
  pareceres: ReadonlyMap<string, ParecerConciliacao> = new Map(),
): ResumoGrupo {
  const porClasse = Object.fromEntries(CLASSES.map((c) => [c, 0])) as Record<ClasseConciliacao, number>;
  for (const q of r.questionarios) for (const c of CLASSES) porClasse[c] += r.totais[q]?.[c] ?? 0;
  const origens = porOrigem(docs);
  const falta: ResumoGrupo["falta"] = [];
  if (!origens.AEP?.length) falta.push("AEP");
  if (!origens.DRPS?.length && !origens.QPS?.length) falta.push("Questionário");
  return {
    idGrupo,
    documentos: [...docs],
    porOrigem: origens,
    empresasComDocumento: new Set(docs.map((d) => d.idEmpresa)).size,
    falta,
    fonteUnica: r.fonteUnica,
    fontes: r.questionarios,
    semSetorEmComum: falta.length === 0 && r.setoresEmComum === 0,
    convergentes: porClasse.Convergente,
    divergencias: porClasse["Nível divergente"] + porClasse["Só questionário"] + porClasse["Só AEP"],
    porClasse,
    pareceres: contarPareceres(r, pareceres),
  };
}

/** A foto do grupo: os itens da empresa, com as empresas em que cada setor aparece. */
export function itensDoFechamentoGrupo(
  r: ResultadoConciliacao,
  pareceres: ReadonlyMap<string, ParecerConciliacao>,
  nomeFator: (id: string) => string,
  rotulo: (idEmpresa: string) => string,
): ItemFechamentoGrupo[] {
  const empresasDoSetor = new Map(r.setores.map((s) => [s.chave, empresasDoSetorConciliado(s.empresas)]));
  return itensDoFechamento(r, pareceres, nomeFator).map((i) => ({
    ...i,
    empresas: (empresasDoSetor.get(i.setor_chave) ?? []).map(rotulo),
    id_acoes: pareceres.get(chaveParecer(i.setor_chave, i.id_fator, i.questionario))?.id_acoes ?? (i.id_acao ? [i.id_acao] : []),
  }));
}

/** Todas as empresas em que o setor apareceu, em qualquer fonte, sem repetir. */
export function empresasDoSetorConciliado(empresas: Partial<Record<OrigemFonte, string[]>>): string[] {
  const out: string[] = [];
  for (const o of ORIGENS_GRUPO) for (const e of empresas[o] ?? []) if (!out.includes(e)) out.push(e);
  return out;
}

const dataBr = (s: string) => s.slice(0, 10).split("-").reverse().join("/");
const ROTULO_ORIGEM: Record<OrigemFonte, string> = { AEP: "A AEP", DRPS: "O DRPS", QPS: "O QPS" };

/**
 * O que pede revisão na conciliação do grupo (as mesmas regras da empresa):
 *  • documento-antigo         — documento usado com 2 anos ou mais (NR-01, 1.5.4.4.6), dizendo a empresa;
 *  • documentos-distantes     — a AEP mais recente e o questionário mais recente do grupo com 1 ano ou mais de diferença;
 *  • fechamento-desatualizado — os documentos de agora não são os do último fechamento.
 */
export function alertasRevisaoGrupo(p: {
  documentos: readonly DocumentoFonte[];
  ultimoFechamento?: { fechado_em: string; documentos: ReadonlyArray<{ id: string }> } | null;
  hoje: string;
  rotulo: (idEmpresa: string) => string;
}): AlertaRevisao[] {
  const out: AlertaRevisao[] = [];
  for (const d of p.documentos) {
    const m = mesesEntre(d.data, p.hoje);
    if (d.data && m != null && m >= MESES_REVISAO) {
      out.push({
        tipo: "documento-antigo",
        texto: `${ROTULO_ORIGEM[d.origem]} da empresa ${p.rotulo(d.idEmpresa)} é de ${dataBr(d.data)}, há mais de ${MESES_REVISAO / 12} anos: a avaliação de riscos deve ser revista (NR-01, 1.5.4.4.6).`,
      });
    }
  }
  const origens = porOrigem(p.documentos);
  const aep = origens.AEP?.[0];
  for (const q of ["DRPS", "QPS"] as const) {
    const d = origens[q]?.[0];
    const m = mesesEntre(aep?.data, d?.data);
    if (aep?.data && d?.data && m != null && Math.abs(m) >= MESES_DISTANCIA) {
      out.push({
        tipo: "documentos-distantes",
        texto: `A AEP mais recente do grupo (${dataBr(aep.data)}) e o ${q} mais recente (${dataBr(d.data)}) têm ${Math.abs(m)} meses de diferença: comparam momentos diferentes. Avalie atualizar o mais antigo.`,
      });
    }
  }
  const f = p.ultimoFechamento;
  if (f) {
    const agora = new Set(p.documentos.map((d) => d.id));
    const antes = new Set((f.documentos ?? []).map((d) => d.id));
    const mudou = agora.size !== antes.size || [...agora].some((id) => !antes.has(id));
    if (mudou) {
      out.push({
        tipo: "fechamento-desatualizado",
        texto: `Os documentos de agora não são os do último fechamento (${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(f.fechado_em))}): concilie e feche de novo para o registro do PGR ficar em dia.`,
      });
    }
  }
  return out;
}
