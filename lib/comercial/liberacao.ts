// Liberar para o Comercial, etapa da Conciliação DRPS/QPS × AEP (0.3.238; banco v321 a v325). Puro
// (sem tela, sem banco) para testar.
//
// Só vai o que a Conciliação identificou (pedido do João em 05/11/2026): os pareceres
// Confirmar e Aprofundar com AET da última conciliação FECHADA de cada empresa, um risco por
// setor × fator. Em cada risco, uma ou mais intervenções com Modalidade, Responsável e Prazo.
//
// O vendedor só vê depois de CONCLUÍDO o atendimento; reabrir tira até concluir de novo, como a
// inspeção reaberta sai do Comercial. O que a inspeção e a AEP indicam não passa por aqui: continua
// indo direto às Oportunidades.

import type { DecisaoParecer, Questionario } from "@/lib/psico-consolidacao/conciliacao";
import { A_VENDER, empresaBase, type Cad, type EmpresaComercial, juntarSetores, type Oportunidade, type Produto, type VendaFeita } from "@/lib/comercial/oportunidades";

/** As modalidades de partida. Desde a 0.3.240 a equipe pode inserir outras, que ficam no catálogo. */
export const MODALIDADES = ["EAD", "Presencial", "Ao vivo"] as const;

/** O que foi digitado, sem espaços sobrando. */
export const normalizarOpcao = (s: string) => s.trim().replace(/\s+/g, " ");

const mesmaOpcao = (a: string, b: string) => normalizarOpcao(a).toLocaleLowerCase("pt-BR") === normalizarOpcao(b).toLocaleLowerCase("pt-BR");

/** A grafia que já existe na lista, para "ead" não virar outra modalidade além de "EAD". */
export function acharNaLista(lista: readonly string[], valor: string): string | undefined {
  return lista.find((x) => mesmaOpcao(x, valor));
}

/** A lista com o valor no fim, se ainda não estiver lá. */
export function comOpcao(lista: readonly string[], valor: string): string[] {
  return acharNaLista(lista, valor) ? [...lista] : [...lista, normalizarOpcao(valor)];
}

/** A intervenção do catálogo com esse nome, sem olhar maiúsculas: o banco não aceita nome repetido. */
export function acharIntervencao<T extends { nome: string }>(catalogo: readonly T[], nome: string): T | undefined {
  return catalogo.find((c) => mesmaOpcao(c.nome, nome));
}

/** Coluna da página Intervenções que guarda tópicos próprios (0.3.242, banco v328). */
export type ColunaTopico = "MODALIDADE" | "RESPONSAVEL";

/** Tópico inserido pelo título da coluna: existe mesmo antes de estar em alguma intervenção. */
export interface TopicoIntervencao {
  id_topico: string;
  coluna: ColunaTopico;
  valor: string;
}

/**
 * O que os campos Modalidade e Responsável oferecem: as modalidades de partida, tudo o que já está no
 * catálogo e os tópicos inseridos pelo título da coluna (0.3.242), sem repetir.
 */
export function opcoesDoCatalogo(
  catalogo: readonly { modalidades: readonly string[]; responsaveis: readonly string[] }[],
  topicos: readonly { coluna: ColunaTopico; valor: string }[] = [],
) {
  const juntar = (base: readonly string[], listas: (readonly string[])[]) => listas.flat().reduce<string[]>((acc, v) => comOpcao(acc, v), [...base]);
  const daColuna = (c: ColunaTopico) => topicos.filter((t) => t.coluna === c).map((t) => t.valor);
  return {
    modalidades: juntar(MODALIDADES, [...catalogo.map((c) => c.modalidades), daColuna("MODALIDADE")]),
    responsaveis: juntar([], [...catalogo.map((c) => c.responsaveis), daColuna("RESPONSAVEL")]),
  };
}

/** Em quantas intervenções o tópico aparece, sem olhar maiúsculas. */
export function contarUsos(listas: readonly (readonly string[])[], valor: string): number {
  return listas.filter((l) => acharNaLista(l, valor) !== undefined).length;
}

export type StatusAtendimento = "EM_ANDAMENTO" | "CONCLUIDO";

export interface AtendimentoComercial {
  id_empresa: string;
  status: StatusAtendimento;
  parecer: string | null;
  concluido_em: string | null;
  concluido_por: string | null;
  empresas?: Cad | null;
  /** v0.3.290: o atendimento veio da Conciliação por grupo (aplicarGrupos), com o nome do grupo. */
  nome_grupo?: string | null;
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
  /** Só no grupo (v356): as empresas do grupo em que o setor aparece — o vendedor vê a intervenção nelas. */
  empresas?: string[];
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
  /** Só no grupo (v0.3.290): as empresas do grupo em que o setor aparece. */
  id_empresas?: string[];
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
  /** 0.3.321: o questionário e a AEP concordam que há risco (sem parecer: não precisava). */
  convergente?: boolean;
  /** Só tem intervenção gravada: saiu da última conciliação fechada. */
  foraDaConciliacao: boolean;
}

export const chaveRisco = (setorChave: string, idFator: string) => `${setorChave}|${idFator}`;

/**
 * Os riscos de uma conciliação fechada: Confirmar, AET e (0.3.321) o convergente sem parecer — o questionário e a AEP
 * concordam que há risco, então a conciliação não pede parecer, mas ele é risco. Descartado fica de fora. O mesmo
 * setor × fator vira um só.
 */
export function riscosDoFechamento(itens: readonly ItemConciliado[]): RiscoConciliado[] {
  const porChave = new Map<string, RiscoConciliado>();
  for (const i of itens) {
    const convergente = i.decisao == null && i.classe === "Convergente";
    if (i.decisao !== "CONFIRMAR" && i.decisao !== "AET" && !convergente) continue;
    const chave = chaveRisco(i.setor_chave, i.id_fator);
    const atual = porChave.get(chave);
    if (atual) {
      if (!atual.questionarios.includes(i.questionario)) atual.questionarios.push(i.questionario);
      atual.aet ||= i.decisao === "AET";
      if (convergente) atual.convergente = true;
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
      ...(convergente ? { convergente: true } : {}),
      foraDaConciliacao: false,
    });
  }
  return [...porChave.values()].sort(
    (a, b) => a.setor.localeCompare(b.setor, "pt-BR") || a.fator.localeCompare(b.fator, "pt-BR"),
  );
}

/**
 * 0.3.321: fechamento feito antes de a foto guardar os convergentes — o resumo conta convergentes, mas a foto não tem
 * nenhum. Devolve quantos faltam (0 = nada a avisar). Reabrir e fechar de novo traz os riscos para Intervenções.
 */
export function convergentesForaDaFoto(resumo: unknown, itens: readonly { classe?: string | null }[]): number {
  if (itens.some((i) => i.classe === "Convergente")) return 0;
  const totais = (resumo as { totais?: Record<string, Record<string, number>> } | null)?.totais ?? {};
  return Object.values(totais).reduce((s, t) => s + (t?.Convergente ?? 0), 0);
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

/** 0.3.321: um tema (intervenção) dentro de um risco agrupado — o item de cada setor que já o tem. */
export interface TemaDoFator {
  chave: string;
  nome: string;
  /** chave do risco (setor × fator) → item gravado. */
  itens: Map<string, IntervencaoIndicada>;
}

/** 0.3.321: o mesmo fator em vários setores. */
export interface RiscoPorFator {
  idFator: string;
  fator: string;
  riscos: RiscoConciliado[];
  temas: TemaDoFator[];
}

/**
 * 0.3.321 (pedido do João, 26/11): "mostrar por risco" — agrupa os riscos pelo fator. Cada tema (a intervenção, pelo
 * catálogo ou pelo nome) reúne os itens dos setores que já o têm; na tela ele vale para todos os setores do risco.
 */
export function agruparPorRisco(riscos: readonly RiscoConciliado[], indicadas: readonly IntervencaoIndicada[]): RiscoPorFator[] {
  const grupos = new Map<string, RiscoPorFator>();
  for (const r of riscos) {
    const g = grupos.get(r.idFator) ?? { idFator: r.idFator, fator: r.fator, riscos: [], temas: [] };
    g.riscos.push(r);
    grupos.set(r.idFator, g);
  }
  for (const g of grupos.values()) {
    const chaves = new Set(g.riscos.map((r) => r.chave));
    const temas = new Map<string, TemaDoFator>();
    for (const i of indicadas) {
      const chaveR = chaveRisco(i.setor_chave, i.id_fator);
      if (!chaves.has(chaveR)) continue;
      const chave = i.id_intervencao ?? `nome:${i.nome.trim().toLowerCase()}`;
      const t = temas.get(chave) ?? { chave, nome: i.nome, itens: new Map<string, IntervencaoIndicada>() };
      if (!t.itens.has(chaveR)) t.itens.set(chaveR, i);
      temas.set(chave, t);
    }
    g.riscos.sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
    g.temas = [...temas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  return [...grupos.values()].sort((a, b) => a.fator.localeCompare(b.fator, "pt-BR"));
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

export type SituacaoComercial = "falta-fechar" | "reaberta" | "sem-risco" | "para-liberar" | "em-andamento" | "liberado" | "fechada-de-novo";

export const ROTULO_SITUACAO_COMERCIAL: Record<SituacaoComercial, string> = {
  "falta-fechar": "Falta fechar",
  reaberta: "Reaberta",
  "sem-risco": "Sem risco confirmado",
  "para-liberar": "Para liberar",
  "em-andamento": "Em andamento",
  liberado: "Liberado",
  "fechada-de-novo": "Fechada de novo",
};

/** Em que ponto a empresa está no caminho até o Comercial. Coluna da lista e faixa de etapas. */
export function situacaoComercial(p: {
  ultimoFechamento: { fechado_em: string; reaberta: boolean } | null;
  atendimento: Pick<AtendimentoComercial, "status" | "parecer" | "concluido_em"> | null;
  riscos: number;
  intervencoes: number;
}): SituacaoComercial {
  const { ultimoFechamento: f, atendimento: a } = p;
  if (!f) return "falta-fechar";
  if (f.reaberta) return "reaberta";
  if (a?.status === "CONCLUIDO") {
    // Registros de antes da 0.3.238: dava para fechar de novo com o atendimento concluído.
    return a.concluido_em && new Date(f.fechado_em).getTime() > new Date(a.concluido_em).getTime() ? "fechada-de-novo" : "liberado";
  }
  if (p.riscos === 0) return "sem-risco";
  return p.intervencoes > 0 || !!a?.parecer?.trim() ? "em-andamento" : "para-liberar";
}

/** O que falta para concluir o atendimento; null quando pode. */
export function faltaParaConcluir(parecer: string | null | undefined): string | null {
  return parecer?.trim() ? null : "Escreva o parecer para liberar.";
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
  /** v329: intervenção psicossocial vendida sozinha; vazio (ou ausente) = o serviço inteiro. */
  id_item?: string | null;
  observacao: string | null;
  vendido_por: string;
  vendido_por_email: string;
  vendido_em: string;
  nome_empresa?: string | null;
  cnpj?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

const vendaFeita = (v: VendaRegistrada): VendaFeita => ({
  por: v.vendido_por,
  porEmail: v.vendido_por_email,
  em: v.vendido_em,
  observacao: v.observacao,
});

/**
 * Marca as oportunidades vendidas. Com o documento já em andamento ou feito, a situação dele continua
 * valendo, porque diz mais do que a venda; a informação da venda segue junto.
 * 0.3.247 (v329): a intervenção psicossocial também se vende uma a uma; o serviço só vira "vendida"
 * quando todas as intervenções foram vendidas (ou quando a venda é do serviço inteiro, como antes).
 */
export function aplicarVendas(lista: readonly EmpresaComercial[], vendas: readonly VendaRegistrada[]): EmpresaComercial[] {
  const doServico = new Map(vendas.filter((v) => !v.id_item).map((v) => [`${v.id_empresa}|${v.produto}`, v]));
  const porItem = new Map(vendas.filter((v) => v.id_item).map((v) => [`${v.id_empresa}|${v.produto}|${v.id_item}`, v]));
  return lista.map((c) => ({
    ...c,
    oportunidades: c.oportunidades.map((o) => {
      let r: Oportunidade = o;
      if (o.intervencoes?.length) {
        const linhas = o.intervencoes.map((l) => {
          const vi = porItem.get(`${c.empresa.idEmpresa}|${o.produto}|${l.idItem}`);
          return vi ? { ...l, venda: vendaFeita(vi) } : l;
        });
        r = { ...r, intervencoes: linhas };
        if (linhas.every((l) => l.venda) && A_VENDER.includes(r.situacao)) r = { ...r, situacao: "vendida" };
      }
      const v = doServico.get(`${c.empresa.idEmpresa}|${o.produto}`);
      if (!v) return r;
      return {
        ...r,
        situacao: A_VENDER.includes(r.situacao) ? ("vendida" as const) : r.situacao,
        venda: vendaFeita(v),
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
            o.produto === "AET"
              ? {
                  ...o,
                  origens: [...o.origens, "Conciliação" as const],
                  detalhes: [...o.detalhes, ...detalhes],
                  setoresIndicados: juntarSetores(o.setoresIndicados ?? [], aet.map((r) => r.setor)),
                }
              : o,
          )
        : [
            ...oportunidades,
            { produto: "AET", situacao: "aberta", origens: ["Conciliação"], detalhes, setores: [], setoresIndicados: juntarSetores(aet.map((r) => r.setor)) },
          ];
    }
    if (dela.length > 0) {
      oportunidades = [
        ...oportunidades,
        {
          produto: "Intervenção psicossocial",
          situacao: "aberta",
          origens: ["Conciliação"],
          detalhes: dela.map(textoIntervencao),
          setores: [],
          setoresIndicados: juntarSetores(dela.map((i) => i.setor_nome)),
          intervencoes: dela
            .map((i) => ({
              idItem: i.id_item,
              setor: i.setor_nome,
              risco: i.fator_nome,
              intervencao: i.nome,
              modalidade: i.modalidade,
              responsavel: i.responsavel,
              prazoDias: i.prazo_dias,
              idIntervencao: i.id_intervencao,
            }))
            .sort((x, y) => x.setor.localeCompare(y.setor, "pt-BR") || x.risco.localeCompare(y.risco, "pt-BR")),
        },
      ];
    }
    resultado.set(id, {
      ...base,
      oportunidades,
      ...(a.parecer ? { parecerEquipe: a.parecer } : {}),
      ...(a.nome_grupo ? { liberadaPeloGrupo: a.nome_grupo } : {}),
    });
  }
  return [...resultado.values()];
}

// ── Conciliação por grupo › Liberar (v0.3.290, banco v356) ──────────────────────

/** Um atendimento de grupo como vem de comercial_dados().grupos. */
export interface AtendimentoGrupo {
  id_grupo: string;
  nome_grupo: string;
  status: StatusAtendimento;
  parecer: string | null;
  concluido_em: string | null;
  concluido_por: string | null;
  /** A última conciliação do grupo está fechada (não reaberta). */
  fechada: boolean;
  empresas: Array<Cad & { id_empresa: string }>;
  intervencoes: Array<IntervencaoIndicada & { id_grupo: string }>;
  itens: ItemConciliado[];
}

/**
 * O que o grupo liberado vira para o Comercial, por empresa (decisões do João em 16/11/2026):
 *  • o vendedor vê POR EMPRESA — cada empresa do grupo ganha um atendimento concluído com o parecer do grupo, as
 *    intervenções dos setores dela (as do item em que ela está) e os riscos dos setores dela;
 *  • O GRUPO SUBSTITUI: a empresa coberta por um grupo liberado perde, no Comercial, o atendimento, as intervenções e a
 *    conciliação próprios (que continuam guardados no banco e no histórico).
 * Só conta o grupo CONCLUÍDO com a conciliação fechada. O resultado entra direto em `visaoDoVendedor`.
 */
export function aplicarGrupos(
  atendimentos: readonly AtendimentoComercial[],
  indicadas: readonly IntervencaoIndicada[],
  conciliacoes: readonly ConciliacaoFechada[],
  grupos: readonly AtendimentoGrupo[],
): { atendimentos: AtendimentoComercial[]; indicadas: IntervencaoIndicada[]; conciliacoes: ConciliacaoFechada[] } {
  const liberados = grupos.filter((g) => g.status === "CONCLUIDO" && g.fechada);
  const cobertas = new Set(liberados.flatMap((g) => g.empresas.map((e) => e.id_empresa)));
  const out = {
    atendimentos: atendimentos.filter((a) => !cobertas.has(a.id_empresa)),
    indicadas: indicadas.filter((i) => !cobertas.has(i.id_empresa)),
    conciliacoes: conciliacoes.filter((c) => !cobertas.has(c.id_empresa)),
  };
  for (const g of liberados) {
    for (const e of g.empresas) {
      const { id_empresa, ...cad } = e;
      // Item sem a lista de empresas (fechamento antigo): vale para todas as empresas do grupo.
      const dela = (lista?: string[]) => !lista || lista.length === 0 || lista.includes(id_empresa);
      out.atendimentos.push({
        id_empresa,
        status: "CONCLUIDO",
        parecer: g.parecer,
        concluido_em: g.concluido_em,
        concluido_por: g.concluido_por,
        empresas: cad,
        nome_grupo: g.nome_grupo,
      });
      for (const i of g.intervencoes) if (dela(i.empresas)) out.indicadas.push({ ...i, id_empresa });
      out.conciliacoes.push({
        id_fechamento: `grupo:${g.id_grupo}`,
        id_empresa,
        fechado_em: g.concluido_em ?? "",
        fechado_por: null,
        itens: g.itens.filter((it) => dela(it.id_empresas)),
        empresas: cad,
      });
    }
  }
  return out;
}

/**
 * 0.3.334 (pedido do usuário): por que a etapa Intervenções está só para leitura — a tela dizia só "Nenhuma intervenção
 * indicada" e o campo de inserir sumia, sem explicar. null = pode alterar. Só vale com a conciliação fechada (aberta já
 * tem o seu aviso).
 */
export function motivoSoLeitura(p: { podeEditar: boolean; podeLiberar: boolean; sessaoAberta: boolean; liberado: boolean }): string | null {
  if (!p.podeEditar || !p.podeLiberar) return "O seu perfil não pode alterar as intervenções.";
  if (p.liberado) return "Já liberado ao Comercial: reabra a liberação para alterar as intervenções.";
  if (!p.sessaoAberta) return "O tempo não está rodando: clique em Iniciar ou Retomar no relógio do canto para inserir ou alterar as intervenções.";
  return null;
}
