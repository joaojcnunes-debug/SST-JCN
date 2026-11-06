// Consolidação › Liberar para o Comercial (0.3.233, refeita na 0.3.235, banco v322). Puro (sem tela,
// sem banco) para testar.
//
// A página mostra SÓ o que a Conciliação identificou (pedido do João em 05/11/2026): os pareceres
// Confirmar e Aprofundar com AET da última conciliação FECHADA de cada empresa, um risco por
// setor × fator. Em cada risco, uma ou mais intervenções com Modalidade, Responsável e Prazo.
//
// O vendedor só vê depois de CONCLUÍDO o atendimento; reabrir tira até concluir de novo, como a
// inspeção reaberta sai do Comercial. O que a inspeção e a AEP indicam não passa por aqui: continua
// indo direto às Oportunidades.

import type { DecisaoParecer, Questionario } from "@/lib/psico-consolidacao/conciliacao";
import { A_VENDER, empresaBase, type Cad, type EmpresaComercial, type Oportunidade, type Produto } from "@/lib/comercial/oportunidades";

export const MODALIDADES = ["EAD", "Presencial", "Ao vivo"] as const;

export type StatusAtendimento = "EM_ANDAMENTO" | "CONCLUIDO";
export type SituacaoEmpresa = "fila" | "andamento" | "concluida";

export interface AtendimentoComercial {
  id_empresa: string;
  status: StatusAtendimento;
  parecer: string | null;
  concluido_em: string | null;
  concluido_por: string | null;
  empresas?: Cad | null;
}

export interface IntervencaoIndicada {
  id_item: string;
  id_empresa: string;
  setor_chave: string;
  setor_nome: string;
  id_fator: string;
  fator_nome: string;
  id_intervencao: string | null;
  nome: string;
  modalidade: string | null;
  responsavel: string | null;
  prazo_dias: number | null;
  decidido_por?: string | null;
  decidido_em?: string | null;
}

/** O que importa aqui de cada item da foto do fechamento (ItemFechamento). */
export interface ItemConciliado {
  setor: string;
  setor_chave: string;
  id_fator: string;
  fator: string;
  questionario: Questionario;
  decisao: DecisaoParecer | null;
  classe?: string | null;
}

export interface ConciliacaoFechada {
  id_fechamento: string;
  id_empresa: string;
  fechado_em: string;
  fechado_por: string | null;
  itens: ItemConciliado[];
  empresas?: Cad | null;
}

export interface RiscoConciliado {
  chave: string;
  setorChave: string;
  setor: string;
  idFator: string;
  fator: string;
  questionarios: Questionario[];
  /** Algum parecer pediu Aprofundar com AET. */
  aet: boolean;
  /** Só tem intervenção gravada: saiu da última conciliação fechada. */
  foraDaConciliacao: boolean;
}

export const chaveRisco = (setorChave: string, idFator: string) => `${setorChave}|${idFator}`;

/** Os riscos de uma conciliação fechada: Confirmar e AET; o mesmo setor × fator vira um só. */
export function riscosDoFechamento(itens: readonly ItemConciliado[]): RiscoConciliado[] {
  const porChave = new Map<string, RiscoConciliado>();
  for (const i of itens) {
    if (i.decisao !== "CONFIRMAR" && i.decisao !== "AET") continue;
    const chave = chaveRisco(i.setor_chave, i.id_fator);
    const atual = porChave.get(chave);
    if (atual) {
      if (!atual.questionarios.includes(i.questionario)) atual.questionarios.push(i.questionario);
      atual.aet ||= i.decisao === "AET";
      continue;
    }
    porChave.set(chave, {
      chave,
      setorChave: i.setor_chave,
      setor: i.setor,
      idFator: i.id_fator,
      fator: i.fator,
      questionarios: [i.questionario],
      aet: i.decisao === "AET",
      foraDaConciliacao: false,
    });
  }
  return [...porChave.values()].sort(
    (a, b) => a.setor.localeCompare(b.setor, "pt-BR") || a.fator.localeCompare(b.fator, "pt-BR"),
  );
}

/**
 * Os riscos da tela. Intervenção de um risco que saiu da conciliação fechada de novo não some:
 * aparece em linha própria, marcada, para a pessoa decidir.
 */
export function riscosComIntervencoes(riscos: readonly RiscoConciliado[], indicadas: readonly IntervencaoIndicada[]): RiscoConciliado[] {
  const conhecidas = new Set(riscos.map((r) => r.chave));
  const fora = new Map<string, RiscoConciliado>();
  for (const i of indicadas) {
    const chave = chaveRisco(i.setor_chave, i.id_fator);
    if (conhecidas.has(chave) || fora.has(chave)) continue;
    fora.set(chave, {
      chave,
      setorChave: i.setor_chave,
      setor: i.setor_nome,
      idFator: i.id_fator,
      fator: i.fator_nome,
      questionarios: [],
      aet: false,
      foraDaConciliacao: true,
    });
  }
  return [...riscos, ...fora.values()];
}

/**
 * As intervenções de um risco em ordem fixa: o banco devolve em ordem variável, e a linha trocava de
 * lugar logo depois de editada.
 */
export function intervencoesDoRisco(indicadas: readonly IntervencaoIndicada[], chave: string): IntervencaoIndicada[] {
  return indicadas
    .filter((i) => chaveRisco(i.setor_chave, i.id_fator) === chave)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id_item.localeCompare(b.id_item));
}

export interface ResumoEmpresa {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  situacao: SituacaoEmpresa;
  fechadoEm: string;
  riscos: number;
  semIntervencao: number;
  atendimento: AtendimentoComercial | null;
  /** Concluído, mas a conciliação foi fechada de novo depois: precisa reabrir. */
  conciliacaoNova: boolean;
}

/** Uma linha por empresa com conciliação fechada que tenha ao menos um risco. */
export function resumirEmpresas(
  conciliacoes: readonly ConciliacaoFechada[],
  atendimentos: readonly AtendimentoComercial[],
  indicadas: readonly IntervencaoIndicada[],
): ResumoEmpresa[] {
  const atend = new Map(atendimentos.map((a) => [a.id_empresa, a]));
  const linhas: ResumoEmpresa[] = [];
  for (const c of conciliacoes) {
    const riscos = riscosDoFechamento(c.itens ?? []);
    if (riscos.length === 0) continue;
    const a = atend.get(c.id_empresa) ?? null;
    const comItem = new Set(indicadas.filter((i) => i.id_empresa === c.id_empresa).map((i) => chaveRisco(i.setor_chave, i.id_fator)));
    const conciliacaoNova =
      a?.status === "CONCLUIDO" && !!a.concluido_em && new Date(c.fechado_em).getTime() > new Date(a.concluido_em).getTime();
    linhas.push({
      idEmpresa: c.id_empresa,
      nome: c.empresas?.nome_empresa ?? "Empresa sem cadastro",
      cnpj: c.empresas?.cnpj ?? null,
      municipio: c.empresas?.municipio ?? null,
      uf: c.empresas?.uf ?? null,
      situacao: a?.status === "EM_ANDAMENTO" ? "andamento" : a?.status === "CONCLUIDO" && !conciliacaoNova ? "concluida" : "fila",
      fechadoEm: c.fechado_em,
      riscos: riscos.length,
      semIntervencao: riscos.filter((r) => !comItem.has(r.chave)).length,
      atendimento: a,
      conciliacaoNova,
    });
  }
  return linhas.sort((x, y) => new Date(y.fechadoEm).getTime() - new Date(x.fechadoEm).getTime() || x.nome.localeCompare(y.nome, "pt-BR"));
}

/** O que falta para concluir o atendimento; null quando pode. */
export function faltaParaConcluir(parecer: string | null | undefined): string | null {
  return parecer?.trim() ? null : "Escreva o parecer.";
}

/** "Padaria · Sobrecarga: Treinamento X · EAD · Equipe EAD · 30 dias". */
export function textoIntervencao(i: IntervencaoIndicada): string {
  const partes = [i.nome, i.modalidade, i.responsavel, i.prazo_dias ? `${i.prazo_dias} ${i.prazo_dias === 1 ? "dia" : "dias"}` : null];
  return `${i.setor_nome} · ${i.fator_nome}: ${partes.filter(Boolean).join(" · ")}`;
}

/** Venda registrada pelo vendedor (v323), como vem do comercial_dados. */
export interface VendaRegistrada {
  id_empresa: string;
  produto: Produto;
  observacao: string | null;
  vendido_por: string;
  vendido_por_email: string;
  vendido_em: string;
  nome_empresa?: string | null;
  cnpj?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

/**
 * Marca as oportunidades vendidas. Com o documento já em andamento ou feito, a situação dele continua
 * valendo, porque diz mais do que a venda; a informação da venda segue junto.
 */
export function aplicarVendas(lista: readonly EmpresaComercial[], vendas: readonly VendaRegistrada[]): EmpresaComercial[] {
  const porChave = new Map(vendas.map((v) => [`${v.id_empresa}|${v.produto}`, v]));
  return lista.map((c) => ({
    ...c,
    oportunidades: c.oportunidades.map((o) => {
      const v = porChave.get(`${c.empresa.idEmpresa}|${o.produto}`);
      if (!v) return o;
      return {
        ...o,
        situacao: A_VENDER.includes(o.situacao) ? ("vendida" as const) : o.situacao,
        venda: { por: v.vendido_por, porEmail: v.vendido_por_email, em: v.vendido_em, observacao: v.observacao },
      };
    }),
  }));
}

/**
 * O que o vendedor vê: as oportunidades da inspeção e da AEP, como sempre, mais o que saiu de
 * atendimento CONCLUÍDO: as intervenções, os riscos que pediram AET e o parecer.
 */
export function visaoDoVendedor(
  lista: readonly EmpresaComercial[],
  atendimentos: readonly AtendimentoComercial[],
  indicadas: readonly IntervencaoIndicada[],
  conciliacoes: readonly ConciliacaoFechada[],
): EmpresaComercial[] {
  const resultado = new Map(lista.map((c) => [c.empresa.idEmpresa, c]));
  const fechadas = new Map(conciliacoes.map((c) => [c.id_empresa, c]));

  for (const a of atendimentos) {
    if (a.status !== "CONCLUIDO") continue;
    const id = a.id_empresa;
    // Conciliação reaberta: sai do vendedor até fechar de novo (v324; o banco já filtra para ele).
    if (!fechadas.has(id)) continue;
    const dela = indicadas.filter((i) => i.id_empresa === id);
    const aet = riscosDoFechamento(fechadas.get(id)?.itens ?? []).filter((r) => r.aet);
    if (dela.length === 0 && aet.length === 0 && !resultado.has(id)) continue;

    const base: EmpresaComercial = resultado.get(id) ?? {
      empresa: empresaBase(id, a.empresas ?? {}),
      telefone: a.empresas?.telefone?.trim() || null,
      email: a.empresas?.email?.trim() || null,
      oportunidades: [],
      expostosAet: 0,
      temAep: false,
      inspecao: null,
      aepLiberadaEm: null,
      aepLiberadaPor: null,
    };
    let oportunidades: Oportunidade[] = base.oportunidades;

    if (aet.length > 0) {
      const detalhes = aet.map((r) => `${r.setor} · ${r.fator} (Conciliação: aprofundar com AET)`);
      oportunidades = oportunidades.some((o) => o.produto === "AET")
        ? oportunidades.map((o) =>
            o.produto === "AET" ? { ...o, origens: [...o.origens, "Conciliação" as const], detalhes: [...o.detalhes, ...detalhes] } : o,
          )
        : [...oportunidades, { produto: "AET", situacao: "aberta", origens: ["Conciliação"], detalhes, setores: [] }];
    }
    if (dela.length > 0) {
      oportunidades = [
        ...oportunidades,
        { produto: "Intervenção psicossocial", situacao: "aberta", origens: ["Conciliação"], detalhes: dela.map(textoIntervencao), setores: [] },
      ];
    }
    resultado.set(id, { ...base, oportunidades, ...(a.parecer ? { parecerEquipe: a.parecer } : {}) });
  }
  return [...resultado.values()];
}
